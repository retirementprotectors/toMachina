#!/usr/bin/env npx tsx
/**
 * Bulk loader: Phase 2 remaining data — opportunities, revenue, campaigns, operational
 * Loads from PRODASH_MATRIX, SENTINEL_MATRIX, and RAPID_MATRIX into Firestore.
 *
 * Usage: npx tsx scripts/load-remaining.ts
 *
 * Requires: Application Default Credentials (gcloud auth application-default login)
 *           PRODASH_MATRIX_ID env var
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
const PRODASH_MATRIX_ID = process.env.PRODASH_MATRIX_ID || ''
const SENTINEL_MATRIX_ID = '1K_DLb-txoI4F1dLrUyoFOuFc0xwsH1iW5eff3pQ_o6E'
const RAPID_MATRIX_ID = '1nnSY-J3n6DtVvKqyC40zpEt1sROtHkIEqmSwG-5d9dU'

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
        docId = `row_${rowIdx + 2}`
      }

      // Sanitize: Firestore doc IDs cannot contain forward slashes
      docId = docId.replace(/\//g, '_')

      return { docId, data: obj }
    })
    .filter(({ data }) => Object.keys(data).length > 0)

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

/**
 * Subcollection loader: reads a tab, groups rows by a parent ID field,
 * then writes each row into {parentCollection}/{parentId}/{subcollectionName}/{docId}.
 */
async function loadSubcollection(
  spreadsheetId: string,
  tabName: string,
  parentCollection: string,
  parentIdField: string,
  subcollectionName: string,
  idField: string
): Promise<number> {
  console.log(`\n--- Loading ${tabName} -> ${parentCollection}/{id}/${subcollectionName} (parent: ${parentIdField}, key: ${idField}) ---`)

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

  const parentIdIndex = headers.indexOf(parentIdField)
  if (parentIdIndex === -1) {
    console.warn(`   WARNING: Parent ID field "${parentIdField}" not found in headers. Available: ${headers.join(', ')}`)
    console.warn(`   Skipping subcollection load — cannot determine parent document.`)
    return 0
  }

  const idIndex = headers.indexOf(idField)

  // Convert rows to objects with parent grouping
  const docs = dataRows
    .map((row: string[], rowIdx: number) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header: string, i: number) => {
        const val = row[i] ?? ''
        if (val !== '') {
          obj[header] = val
        }
      })

      const parentId = row[parentIdIndex] ? String(row[parentIdIndex]).trim() : ''

      let docId: string
      if (idIndex !== -1 && row[idIndex] && String(row[idIndex]).trim() !== '') {
        docId = String(row[idIndex]).trim()
      } else {
        docId = `row_${rowIdx + 2}`
      }

      // Sanitize slashes
      docId = docId.replace(/\//g, '_')

      return { parentId, docId, data: obj }
    })
    .filter(({ data, parentId }) => Object.keys(data).length > 0 && parentId !== '')

  console.log(`   ${docs.length} non-empty rows with valid parent IDs`)

  // Write to Firestore in batches of 500
  const BATCH_SIZE = 500
  let written = 0

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docs.slice(i, i + BATCH_SIZE)

    for (const { parentId, docId, data } of chunk) {
      const doc = {
        ...data,
        _migrated_at: new Date().toISOString(),
        _source: 'sheets_migration',
      }

      const ref = db
        .collection(parentCollection)
        .doc(parentId.replace(/\//g, '_'))
        .collection(subcollectionName)
        .doc(docId)
      batch.set(ref, doc, { merge: true })
    }

    await batch.commit()
    written += chunk.length
    console.log(`   Wrote batch ${Math.floor(i / BATCH_SIZE) + 1}: ${written}/${docs.length}`)
  }

  console.log(`   Done: ${written} docs in "${parentCollection}/*/  ${subcollectionName}"`)
  return written
}

/**
 * Nested collection loader for flow/* pattern.
 * Writes to flow/{subcollectionName}/{docId} — uses a parent document 'config' as anchor.
 */
async function loadNestedCollection(
  spreadsheetId: string,
  tabName: string,
  parentDoc: string,
  subcollectionName: string,
  idField: string
): Promise<number> {
  console.log(`\n--- Loading ${tabName} -> ${parentDoc}/${subcollectionName} (key: ${idField}) ---`)

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

  const idIndex = headers.indexOf(idField)

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

  // parentDoc format: "flow" -> writes to flow/config/{subcollectionName}/{docId}
  const [collName] = parentDoc.split('/')

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docs.slice(i, i + BATCH_SIZE)

    for (const { docId, data } of chunk) {
      const doc = {
        ...data,
        _migrated_at: new Date().toISOString(),
        _source: 'sheets_migration',
      }

      const ref = db
        .collection(collName)
        .doc('config')
        .collection(subcollectionName)
        .doc(docId)
      batch.set(ref, doc, { merge: true })
    }

    await batch.commit()
    written += chunk.length
    console.log(`   Wrote batch ${Math.floor(i / BATCH_SIZE) + 1}: ${written}/${docs.length}`)
  }

  console.log(`   Done: ${written} docs in "${collName}/config/${subcollectionName}"`)
  return written
}

async function main() {
  console.log('=== toMachina Remaining Data Loader (Batch 3 + 4) ===')
  console.log(`   Firestore project: ${PROJECT_ID}`)
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  if (!PRODASH_MATRIX_ID) {
    console.error('ERROR: Set PRODASH_MATRIX_ID environment variable')
    console.error('   export PRODASH_MATRIX_ID=1byyXMJDpjzgqkhTjJ2GdvTclaGYMDKQ1BQEnz61Eg-w')
    process.exit(1)
  }

  const results: { tab: string; collection: string; count: number; type: string }[] = []

  // ========== BATCH 3: Dependent Data ==========
  console.log('\n========== BATCH 3: Dependent Data ==========')

  // --- Top-level collections from PRODASH_MATRIX ---
  const batch3Tabs: { spreadsheetId: string; tab: string; collection: string; idField: string }[] = [
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_OPPORTUNITIES', collection: 'opportunities', idField: 'opportunity_id' },
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_PIPELINES', collection: 'pipelines', idField: 'pipeline_id' },
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_CASE_TASKS', collection: 'case_tasks', idField: 'task_id' },
  ]

  for (const { spreadsheetId, tab, collection, idField } of batch3Tabs) {
    try {
      const count = await loadTab(spreadsheetId, tab, collection, idField)
      results.push({ tab, collection, count, type: 'collection' })
    } catch (err: any) {
      console.error(`\n   ERROR loading ${tab}: ${err.message || err}`)
      results.push({ tab, collection, count: 0, type: 'collection' })
    }
  }

  // --- Subcollections under clients from PRODASH_MATRIX ---
  const batch3Subs: { spreadsheetId: string; tab: string; parentCollection: string; parentIdField: string; subcollectionName: string; idField: string }[] = [
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_RELATIONSHIPS', parentCollection: 'clients', parentIdField: 'client_id', subcollectionName: 'relationships', idField: 'relationship_id' },
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_ACTIVITY_LOG', parentCollection: 'clients', parentIdField: 'client_id', subcollectionName: 'activities', idField: 'activity_id' },
  ]

  for (const { spreadsheetId, tab, parentCollection, parentIdField, subcollectionName, idField } of batch3Subs) {
    try {
      const count = await loadSubcollection(spreadsheetId, tab, parentCollection, parentIdField, subcollectionName, idField)
      results.push({ tab, collection: `${parentCollection}/*/${subcollectionName}`, count, type: 'subcollection' })
    } catch (err: any) {
      console.error(`\n   ERROR loading ${tab}: ${err.message || err}`)
      results.push({ tab, collection: `${parentCollection}/*/${subcollectionName}`, count: 0, type: 'subcollection' })
    }
  }

  // --- SENTINEL_MATRIX collections ---
  const sentinelTabs: { spreadsheetId: string; tab: string; collection: string; idField: string }[] = [
    { spreadsheetId: SENTINEL_MATRIX_ID, tab: 'Opportunities', collection: 'opportunities', idField: 'opportunity_id' },
    { spreadsheetId: SENTINEL_MATRIX_ID, tab: '_REVENUE_MASTER', collection: 'revenue', idField: 'revenue_id' },
  ]

  for (const { spreadsheetId, tab, collection, idField } of sentinelTabs) {
    try {
      const count = await loadTab(spreadsheetId, tab, collection, idField)
      results.push({ tab: `SENTINEL:${tab}`, collection, count, type: 'collection' })
    } catch (err: any) {
      console.error(`\n   ERROR loading SENTINEL:${tab}: ${err.message || err}`)
      results.push({ tab: `SENTINEL:${tab}`, collection, count: 0, type: 'collection' })
    }
  }

  // ========== BATCH 4: Campaign/Operational Data ==========
  console.log('\n========== BATCH 4: Campaign/Operational Data ==========')

  const batch4Tabs: { spreadsheetId: string; tab: string; collection: string; idField: string }[] = [
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_CAMPAIGNS', collection: 'campaigns', idField: 'campaign_id' },
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_TEMPLATES', collection: 'templates', idField: 'template_id' },
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_CONTENT_BLOCKS', collection: 'content_blocks', idField: 'block_id' },
    { spreadsheetId: PRODASH_MATRIX_ID, tab: '_COMMUNICATION_LOG', collection: 'communications', idField: 'communication_id' },
  ]

  for (const { spreadsheetId, tab, collection, idField } of batch4Tabs) {
    try {
      const count = await loadTab(spreadsheetId, tab, collection, idField)
      results.push({ tab, collection, count, type: 'collection' })
    } catch (err: any) {
      console.error(`\n   ERROR loading ${tab}: ${err.message || err}`)
      results.push({ tab, collection, count: 0, type: 'collection' })
    }
  }

  // --- RAPID_MATRIX flow collections ---
  const flowTabs: { spreadsheetId: string; tab: string; subcollectionName: string; idField: string }[] = [
    { spreadsheetId: RAPID_MATRIX_ID, tab: '_FLOW_PIPELINES', subcollectionName: 'pipelines', idField: 'pipeline_id' },
    { spreadsheetId: RAPID_MATRIX_ID, tab: '_FLOW_INSTANCES', subcollectionName: 'instances', idField: 'instance_id' },
  ]

  for (const { spreadsheetId, tab, subcollectionName, idField } of flowTabs) {
    try {
      const count = await loadNestedCollection(spreadsheetId, tab, 'flow', subcollectionName, idField)
      results.push({ tab, collection: `flow/config/${subcollectionName}`, count, type: 'nested' })
    } catch (err: any) {
      console.error(`\n   ERROR loading ${tab}: ${err.message || err}`)
      results.push({ tab, collection: `flow/config/${subcollectionName}`, count: 0, type: 'nested' })
    }
  }

  // ========== SUMMARY ==========
  console.log('\n=== Migration Summary ===')
  console.log('┌────────────────────────────┬────────────────────────────────┬────────┐')
  console.log('│ Sheet Tab                  │ Firestore Path                 │  Count │')
  console.log('├────────────────────────────┼────────────────────────────────┼────────┤')
  for (const r of results) {
    const tab = r.tab.padEnd(26)
    const col = r.collection.padEnd(30)
    const cnt = String(r.count).padStart(6)
    console.log(`│ ${tab} │ ${col} │ ${cnt} │`)
  }
  console.log('└────────────────────────────┴────────────────────────────────┴────────┘')

  const total = results.reduce((sum, r) => sum + r.count, 0)
  const successful = results.filter(r => r.count > 0).length
  const failed = results.filter(r => r.count === 0).length
  console.log(`\nTotal: ${total} documents across ${successful} collections (${failed} empty/failed)`)

  // Verify top-level collection counts
  console.log('\n=== Firestore Verification (top-level collections) ===')
  const topLevelCollections = [...new Set(results.filter(r => r.type === 'collection').map(r => r.collection))]
  for (const col of topLevelCollections) {
    try {
      const snapshot = await db.collection(col).count().get()
      console.log(`   ${col}: ${snapshot.data().count} docs`)
    } catch (err: any) {
      console.log(`   ${col}: verification failed — ${err.message || err}`)
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
