#!/usr/bin/env npx tsx
/**
 * Bulk loader: _ACTIVITY_LOG -> activities collection (top-level, keyed by entity)
 *              _COMMUNICATION_LOG -> communications collection
 *
 * _ACTIVITY_LOG: stored as top-level `activities` collection, keyed by activity_id.
 *   Each doc has entity_id + entity_type fields for cross-entity queries.
 *   This differs from the subcollection approach in load-remaining.ts which puts
 *   activities under clients/{client_id}/activities.
 *   Both approaches coexist — the top-level collection enables entity-agnostic queries.
 *
 * _COMMUNICATION_LOG: top-level `communications` collection.
 *
 * Usage: npx tsx scripts/load-activities-comms.ts
 *
 * Requires: Application Default Credentials (gcloud auth application-default login)
 *           PRODASH_MATRIX_ID / RAPID_MATRIX_ID env vars
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

const PROJECT_ID = 'claude-mcp-484718'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

const PRODASH_MATRIX_ID = process.env.PRODASH_MATRIX_ID || ''
const RAPID_MATRIX_ID = process.env.RAPID_MATRIX_ID || '1nnSY-J3n6DtVvKqyC40zpEt1sROtHkIEqmSwG-5d9dU'

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return auth.getClient()
}

async function readSheet(spreadsheetId: string, range: string) {
  const auth = await getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth: auth as any })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  })
  return response.data.values || []
}

/**
 * Generic top-level loader.
 */
async function loadTopLevel(
  spreadsheetId: string,
  tabName: string,
  collection: string,
  idField: string
): Promise<number> {
  console.log(`\n--- Loading ${tabName} -> ${collection} (key: ${idField}) ---`)

  const rows = await readSheet(spreadsheetId, tabName)
  if (rows.length < 2) {
    console.log(`   No data found in ${tabName}`)
    return 0
  }

  const headers = rows[0].map((h: string) =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  )
  const dataRows = rows.slice(1)

  console.log(`   Found ${dataRows.length} rows, ${headers.length} columns`)
  console.log(`   Headers: ${headers.slice(0, 8).join(', ')}${headers.length > 8 ? '...' : ''}`)

  const idIndex = headers.indexOf(idField)
  if (idIndex === -1) {
    console.warn(`   WARNING: ID field "${idField}" not found. Using row index.`)
  }

  const docs = dataRows
    .map((row: string[], rowIdx: number) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header: string, i: number) => {
        const val = row[i] ?? ''
        if (val !== '') {
          obj[header] = val
        }
      })

      let docId: string
      if (idIndex !== -1 && row[idIndex] && String(row[idIndex]).trim() !== '') {
        docId = String(row[idIndex]).trim()
      } else {
        docId = `row_${rowIdx + 2}`
      }
      docId = docId.replace(/\//g, '_')

      return { docId, data: obj }
    })
    .filter(({ data }) => Object.keys(data).length > 0)

  console.log(`   ${docs.length} non-empty rows to write`)

  const BATCH_SIZE = 500
  let written = 0

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docs.slice(i, i + BATCH_SIZE)

    for (const { docId, data } of chunk) {
      const doc = {
        ...data,
        _migrated_at: new Date().toISOString(),
        _source: 'sheets_migration_r2',
      }
      const ref = db.collection(collection).doc(docId)
      batch.set(ref, doc, { merge: true })
    }

    await batch.commit()
    written += chunk.length
    console.log(`   Wrote batch ${Math.floor(i / BATCH_SIZE) + 1}: ${written}/${docs.length}`)
  }

  console.log(`   Done: ${written} docs in "${collection}"`)
  return written
}

async function main() {
  console.log('=== toMachina Activity + Communication Loader ===')
  console.log(`   Firestore project: ${PROJECT_ID}`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  if (!PRODASH_MATRIX_ID) {
    console.error('ERROR: Set PRODASH_MATRIX_ID environment variable')
    console.error('   export PRODASH_MATRIX_ID=<your-spreadsheet-id>')
    process.exit(1)
  }

  const results: { tab: string; collection: string; count: number }[] = []

  // _ACTIVITY_LOG -> top-level activities collection
  // This creates the entity-level index. activity_id is PK, entity_id + entity_type for filtering.
  try {
    const count = await loadTopLevel(PRODASH_MATRIX_ID, '_ACTIVITY_LOG', 'activities', 'activity_id')
    results.push({ tab: '_ACTIVITY_LOG', collection: 'activities', count })
  } catch (err: any) {
    console.error(`\n   ERROR loading _ACTIVITY_LOG: ${err.message || err}`)
    results.push({ tab: '_ACTIVITY_LOG', collection: 'activities', count: 0 })
  }

  // _COMMUNICATION_LOG -> communications collection
  // Try PRODASH first (where it lived in load-remaining), then RAPID
  try {
    let count = 0
    try {
      count = await loadTopLevel(PRODASH_MATRIX_ID, '_COMMUNICATION_LOG', 'communications', 'communication_id')
    } catch {
      console.log('   _COMMUNICATION_LOG not in PRODASH_MATRIX, trying RAPID_MATRIX...')
      count = await loadTopLevel(RAPID_MATRIX_ID, '_COMMUNICATION_LOG', 'communications', 'communication_id')
    }
    results.push({ tab: '_COMMUNICATION_LOG', collection: 'communications', count })
  } catch (err: any) {
    console.error(`\n   ERROR loading _COMMUNICATION_LOG: ${err.message || err}`)
    results.push({ tab: '_COMMUNICATION_LOG', collection: 'communications', count: 0 })
  }

  // ========== SUMMARY ==========
  console.log('\n=== Migration Summary ===')
  console.log('+--------------------------+----------------------+--------+')
  console.log('| Sheet Tab                | Firestore Collection | Count  |')
  console.log('+--------------------------+----------------------+--------+')
  for (const r of results) {
    const tab = r.tab.padEnd(24)
    const col = r.collection.padEnd(20)
    const cnt = String(r.count).padStart(6)
    console.log(`| ${tab} | ${col} | ${cnt} |`)
  }
  console.log('+--------------------------+----------------------+--------+')

  const total = results.reduce((sum, r) => sum + r.count, 0)
  console.log(`\nTotal: ${total} documents across ${results.length} collections`)

  // Verification
  console.log('\n=== Firestore Verification ===')
  for (const r of results) {
    try {
      const snapshot = await db.collection(r.collection).count().get()
      console.log(`   ${r.collection}: ${snapshot.data().count} docs`)
    } catch (err: any) {
      console.log(`   ${r.collection}: verification failed — ${err.message || err}`)
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
