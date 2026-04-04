/**
 * seed-clean-tracker-titles.ts
 *
 * Cleans up tracker_items with INT-new / INT-classified status:
 * - Strips prefix patterns like "INT-0042: " or "FP-015: "
 * - Replaces underscores with spaces
 * - Title-cases the result
 * - Writes the cleaned title back to Firestore
 *
 * Run: npx tsx services/api/src/scripts/seed-clean-tracker-titles.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

function humanize(raw: string): string {
  // Strip item-id prefix (e.g., "INT-0042: ", "FP-015: ", "RSP-003: ")
  const stripped = raw.replace(/^[A-Z]+-\d+:\s*/, '')
  // Replace underscores, title-case words
  return stripped
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

async function main() {
  const snapshot = await db
    .collection('tracker_items')
    .where('status', 'in', ['INT-new', 'INT-classified', 'open', 'in_progress'])
    .get()

  console.log(`Found ${snapshot.size} tracker items to check`)

  let updated = 0
  const batch = db.batch()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const original = String(data.title || '')
    const cleaned = humanize(original)

    if (cleaned !== original && cleaned.length > 0) {
      batch.update(doc.ref, {
        title: cleaned,
        _original_title: original,
        updated_at: new Date().toISOString(),
      })
      console.log(`  [CLEAN] "${original}" → "${cleaned}"`)
      updated++
    }
  }

  if (updated > 0) {
    await batch.commit()
    console.log(`\nUpdated ${updated} titles`)
  } else {
    console.log('\nAll titles already clean — no updates needed')
  }
}

main().catch(console.error)
