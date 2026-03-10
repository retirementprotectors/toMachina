#!/usr/bin/env npx tsx
/**
 * Bulk loader: Reference data from Google Sheets -> Firestore
 * Loads carrier, product, user, org, agent, and producer reference data
 * from RAPID_MATRIX and SENTINEL_MATRIX into Firestore collections.
 *
 * Usage: npx tsx scripts/load-reference.ts
 *
 * Requires: Application Default Credentials (gcloud auth application-default login)
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

// GCP project
const PROJECT_ID = 'claude-mcp-484718'

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

// Matrix spreadsheet IDs
const RAPID_MATRIX_ID = '1nnSY-J3n6DtVvKqyC40zpEt1sROtHkIEqmSwG-5d9dU'
const SENTINEL_MATRIX_ID = '1K_DLb-txoI4F1dLrUyoFOuFc0xwsH1iW5eff3pQ_o6E'

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
 * Generic loader: reads a tab from a Google Sheet and writes to a Firestore collection.
 *
 * @param spreadsheetId - The Google Sheets spreadsheet ID
 * @param tabName - The sheet tab name (e.g., '_CARRIER_MASTER')
 * @param collection - The Firestore collection name (e.g., 'carriers')
 * @param idField - The column to use as document ID (e.g., 'carrier_id')
 * @returns Number of documents written
 */
async function loadTab(
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

  // First row = headers, normalize to snake_case
  const headers = rows[0].map((h: string) =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  )
  const dataRows = rows.slice(1)

  console.log(`   Found ${dataRows.length} rows, ${headers.length} columns`)
  console.log(`   Headers: ${headers.slice(0, 8).join(', ')}${headers.length > 8 ? '...' : ''}`)

  // Verify the ID field exists in headers
  const idIndex = headers.indexOf(idField)
  if (idIndex === -1 && idField !== '_row_index') {
    console.warn(`   WARNING: ID field "${idField}" not found in headers. Available: ${headers.join(', ')}`)
    console.warn(`   Falling back to row index as document ID.`)
  }

  // Convert rows to objects
  const docs = dataRows
    .map((row: string[], rowIdx: number) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header: string, i: number) => {
        const val = row[i] ?? ''
        if (val !== '') {
          obj[header] = val
        }
      })

      // Determine document ID
      let docId: string
      if (idIndex !== -1 && row[idIndex] && String(row[idIndex]).trim() !== '') {
        docId = String(row[idIndex]).trim()
      } else {
        docId = `row_${rowIdx + 2}` // +2 because row 1 is headers, and Sheets is 1-indexed
      }

      // Sanitize: Firestore doc IDs cannot contain forward slashes
      docId = docId.replace(/\//g, '_')

      return { docId, data: obj }
    })
    .filter(({ data }) => {
      // Skip completely empty rows
      return Object.keys(data).length > 0
    })

  console.log(`   ${docs.length} non-empty rows to write`)

  // Write to Firestore in batches of 500
  const BATCH_SIZE = 500
  let written = 0

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docs.slice(i, i + BATCH_SIZE)

    for (const { docId, data } of chunk) {
      const doc = {
        ...data,
        _migrated_at: new Date().toISOString(),
        _source: 'sheets_migration',
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
  console.log('=== toMachina Reference Data Loader (Batch 1) ===')
  console.log(`   Firestore project: ${PROJECT_ID}`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  const results: { collection: string; tab: string; count: number }[] = []

  // Define all tabs to load
  const tabs: { spreadsheetId: string; tab: string; collection: string; idField: string }[] = [
    // RAPID_MATRIX reference data
    { spreadsheetId: RAPID_MATRIX_ID, tab: '_CARRIER_MASTER', collection: 'carriers', idField: 'carrier_id' },
    { spreadsheetId: RAPID_MATRIX_ID, tab: '_PRODUCT_MASTER', collection: 'products', idField: 'product_id' },
    { spreadsheetId: RAPID_MATRIX_ID, tab: '_USER_HIERARCHY', collection: 'users', idField: 'email' },
    { spreadsheetId: RAPID_MATRIX_ID, tab: '_COMPANY_STRUCTURE', collection: 'org', idField: 'entity_id' },
    // SENTINEL_MATRIX reference data (_PRODUCER_MASTER uses agent_id as primary key)
    { spreadsheetId: SENTINEL_MATRIX_ID, tab: '_PRODUCER_MASTER', collection: 'agents', idField: 'agent_id' },
  ]

  for (const { spreadsheetId, tab, collection, idField } of tabs) {
    try {
      results.push({
        tab,
        collection,
        count: await loadTab(spreadsheetId, tab, collection, idField),
      })
    } catch (err) {
      console.error(`\n   ERROR loading ${tab}: ${err}`)
      results.push({ tab, collection, count: 0 })
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===')
  console.log('┌─────────────────────────┬──────────────┬────────┐')
  console.log('│ Sheet Tab               │ Collection   │  Count │')
  console.log('├─────────────────────────┼──────────────┼────────┤')
  for (const r of results) {
    const tab = r.tab.padEnd(23)
    const col = r.collection.padEnd(12)
    const cnt = String(r.count).padStart(6)
    console.log(`│ ${tab} │ ${col} │ ${cnt} │`)
  }
  console.log('└─────────────────────────┴──────────────┴────────┘')

  const total = results.reduce((sum, r) => sum + r.count, 0)
  console.log(`\nTotal: ${total} documents across ${results.length} collections`)

  // Verify counts from Firestore
  console.log('\n=== Firestore Verification ===')
  for (const r of results) {
    const snapshot = await db.collection(r.collection).count().get()
    console.log(`   ${r.collection}: ${snapshot.data().count} docs`)
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
