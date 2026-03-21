/**
 * Share all client ACF folders with the Cloud Run service account.
 * One-time script — gives tm-api Editor access to existing ACF folders.
 *
 * Usage: npx tsx src/scripts/share-acf-folders.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}

const SERVICE_ACCOUNT = '365181509090-compute@developer.gserviceaccount.com'
const db = getFirestore()

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
    projectId: 'claude-mcp-484718',
  })
  const drive = google.drive({ version: 'v3', auth })

  // Get all clients with acf_folder_id
  const snap = await db.collection('clients')
    .where('acf_folder_id', '!=', '')
    .select('first_name', 'last_name', 'acf_folder_id')
    .get()

  console.log(`Found ${snap.size} clients with ACF folder IDs`)

  let shared = 0
  let skipped = 0
  let errors = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const folderId = data.acf_folder_id as string
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim()

    try {
      // Check if already shared
      const perms = await drive.permissions.list({
        fileId: folderId,
        fields: 'permissions(emailAddress,role)',
      })
      const already = (perms.data.permissions || []).some(
        p => p.emailAddress === SERVICE_ACCOUNT
      )
      if (already) {
        skipped++
        continue
      }

      // Add editor permission
      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: SERVICE_ACCOUNT,
        },
        sendNotificationEmail: false,
      })
      shared++
      if (shared % 50 === 0) console.log(`  Shared ${shared} so far...`)
    } catch (e) {
      errors++
      if (errors <= 5) {
        console.log(`  Error on ${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  console.log(`\nDone: ${shared} shared, ${skipped} already had access, ${errors} errors`)
}

main().catch(console.error)
