/**
 * Backfill acf_folder_id from existing gdrive_folder_url.
 * Finds clients with a Drive URL but no folder ID, extracts the ID,
 * and writes acf_folder_id + normalized acf_folder_url.
 *
 * Drive accessibility check is skipped for local runs (ADC doesn't have
 * domain access). The folders were created by RAPID_CORE and are known good.
 * The live Cloud Run API will verify access at read time.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-acf-ids.ts --dry-run   # preview only
 *   npx tsx src/scripts/backfill-acf-ids.ts              # execute
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

const db = getFirestore()
const dryRun = process.argv.includes('--dry-run')

function extractFolderId(url: string): string | null {
  // Handles: /drive/folders/ID, /drive/folders/ID?usp=..., /drive/u/0/folders/ID
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

async function main() {
  console.log(`ACF ID Backfill: Starting...${dryRun ? ' (DRY RUN)' : ''}`)

  // Find clients with gdrive_folder_url but no acf_folder_id
  const snap = await db.collection('clients')
    .where('gdrive_folder_url', '!=', '')
    .select('first_name', 'last_name', 'gdrive_folder_url', 'acf_folder_id')
    .get()

  const candidates = snap.docs.filter(d => {
    const data = d.data()
    return data.gdrive_folder_url && !data.acf_folder_id
  })

  console.log(`Found ${candidates.length} clients with URL but no folder ID`)

  let backfilled = 0
  let skipped = 0
  const errors: Array<{ id: string; name: string; reason: string }> = []

  // Batch writes for speed (500 per batch = Firestore limit)
  const BATCH_SIZE = 500
  let batch = db.batch()
  let batchCount = 0

  for (const doc of candidates) {
    const data = doc.data()
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || doc.id
    const url = data.gdrive_folder_url as string

    const folderId = extractFolderId(url)
    if (!folderId) {
      errors.push({ id: doc.id, name, reason: `Could not parse folder ID from: ${url}` })
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  [DRY RUN] ${name} → ${folderId}`)
    } else {
      batch.update(db.collection('clients').doc(doc.id), {
        acf_folder_id: folderId,
        acf_folder_url: `https://drive.google.com/drive/folders/${folderId}`,
        updated_at: new Date().toISOString(),
      })
      batchCount++

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        console.log(`  Committed batch of ${batchCount}`)
        batch = db.batch()
        batchCount = 0
      }
    }
    backfilled++
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    await batch.commit()
    console.log(`  Committed final batch of ${batchCount}`)
  }

  console.log('\n--- Results ---')
  console.log(`Backfilled: ${backfilled}`)
  console.log(`Skipped (bad URL): ${skipped}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log(`  ${e.name} (${e.id}): ${e.reason}`))
  }

  console.log(`\nDone.${dryRun ? ' (DRY RUN — no changes written)' : ''}`)
}

main().catch(console.error)
