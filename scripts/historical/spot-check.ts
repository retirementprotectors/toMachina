#!/usr/bin/env npx tsx
/**
 * Spot-check: verify 10 random docs per collection against source Sheets.
 *
 * For each collection, pulls 10 random Firestore docs and checks that
 * key fields match the source Sheet row (by PK lookup).
 *
 * Usage: npx tsx scripts/spot-check.ts
 *
 * Requires: Application Default Credentials
 *           PRODASH_MATRIX_ID, RAPID_MATRIX_ID, SENTINEL_MATRIX_ID env vars
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type DocumentData } from 'firebase-admin/firestore'
import { google } from 'googleapis'

const PROJECT_ID = 'claude-mcp-484718'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

const PRODASH_MATRIX_ID = process.env.PRODASH_MATRIX_ID || ''
const SENTINEL_MATRIX_ID = process.env.SENTINEL_MATRIX_ID || '1K_DLb-txoI4F1dLrUyoFOuFc0xwsH1iW5eff3pQ_o6E'
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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return response.data.values || []
}

/**
 * Build a lookup map from sheet data: PK value -> row object
 */
function buildSheetLookup(rows: string[][], pkField: string): Map<string, Record<string, string>> {
  if (rows.length < 2) return new Map()

  const headers = rows[0].map((h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const pkIndex = headers.indexOf(pkField)
  if (pkIndex === -1) return new Map()

  const map = new Map<string, Record<string, string>>()
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const pk = row[pkIndex]?.trim()
    if (!pk) continue

    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] ?? '').trim()
    })
    map.set(pk, obj)
  }
  return map
}

/**
 * Get 10 random docs from a Firestore collection.
 */
async function getRandomDocs(collection: string, count: number = 10): Promise<DocumentData[]> {
  // Firestore doesn't have a native random query.
  // Strategy: get total count, then pick random offsets.
  const countSnap = await db.collection(collection).count().get()
  const total = countSnap.data().count

  if (total === 0) return []
  if (total <= count) {
    const snap = await db.collection(collection).limit(count).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // Get all IDs, pick random subset
  const allSnap = await db.collection(collection).select().get()
  const allIds = allSnap.docs.map(d => d.id)

  // Fisher-Yates shuffle, pick first `count`
  for (let i = allIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allIds[i], allIds[j]] = [allIds[j], allIds[i]]
  }
  const selectedIds = allIds.slice(0, count)

  const docs: DocumentData[] = []
  for (const id of selectedIds) {
    const doc = await db.collection(collection).doc(id).get()
    if (doc.exists) {
      docs.push({ id: doc.id, ...doc.data() })
    }
  }
  return docs
}

interface CheckConfig {
  collection: string
  spreadsheetId: string
  tabName: string
  pkField: string
  checkFields: string[] // Fields to compare between Firestore and Sheets
}

async function spotCheck(config: CheckConfig): Promise<{
  collection: string
  total: number
  checked: number
  matched: number
  mismatches: { docId: string; field: string; firestore: string; sheets: string }[]
  missing: string[]
}> {
  const { collection, spreadsheetId, tabName, pkField, checkFields } = config
  console.log(`\n--- Spot-checking ${collection} against ${tabName} ---`)

  // Count Firestore docs
  const countSnap = await db.collection(collection).count().get()
  const total = countSnap.data().count
  console.log(`   Firestore: ${total} docs`)

  if (total === 0) {
    return { collection, total: 0, checked: 0, matched: 0, mismatches: [], missing: [] }
  }

  // Get random docs
  const docs = await getRandomDocs(collection, 10)
  console.log(`   Sampling ${docs.length} random docs`)

  // Read source sheet
  const rows = await readSheet(spreadsheetId, tabName)
  const lookup = buildSheetLookup(rows, pkField)
  console.log(`   Sheet: ${rows.length - 1} rows`)

  const mismatches: { docId: string; field: string; firestore: string; sheets: string }[] = []
  const missing: string[] = []
  let matched = 0

  for (const doc of docs) {
    const docId = doc.id as string
    const sheetRow = lookup.get(docId)

    if (!sheetRow) {
      missing.push(docId)
      continue
    }

    let docMatches = true
    for (const field of checkFields) {
      const fsVal = String(doc[field] ?? '').trim()
      const sheetVal = String(sheetRow[field] ?? '').trim()

      // Loose comparison: both empty counts as match
      if (fsVal === '' && sheetVal === '') continue
      if (fsVal !== sheetVal) {
        mismatches.push({ docId, field, firestore: fsVal, sheets: sheetVal })
        docMatches = false
      }
    }

    if (docMatches) matched++
  }

  console.log(`   Result: ${matched}/${docs.length} docs fully match`)
  if (missing.length > 0) {
    console.log(`   Missing from Sheets: ${missing.length} docs (may be new or migrated differently)`)
  }
  if (mismatches.length > 0) {
    console.log(`   Mismatches:`)
    for (const m of mismatches.slice(0, 5)) {
      console.log(`      ${m.docId}.${m.field}: FS="${m.firestore}" vs Sheet="${m.sheets}"`)
    }
    if (mismatches.length > 5) {
      console.log(`      ... and ${mismatches.length - 5} more`)
    }
  }

  return { collection, total, checked: docs.length, matched, mismatches, missing }
}

async function main() {
  console.log('=== toMachina Spot-Check: Firestore vs Sheets ===')
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  if (!PRODASH_MATRIX_ID) {
    console.error('ERROR: Set PRODASH_MATRIX_ID environment variable')
    process.exit(1)
  }

  const checks: CheckConfig[] = [
    {
      collection: 'clients',
      spreadsheetId: PRODASH_MATRIX_ID,
      tabName: '_CLIENT_MASTER',
      pkField: 'client_id',
      checkFields: ['first_name', 'last_name', 'email', 'phone', 'state', 'client_status'],
    },
    {
      collection: 'agents',
      spreadsheetId: SENTINEL_MATRIX_ID,
      tabName: '_AGENT_MASTER',
      pkField: 'agent_id',
      checkFields: ['first_name', 'last_name', 'email', 'status'],
    },
    {
      collection: 'carriers',
      spreadsheetId: RAPID_MATRIX_ID,
      tabName: '_CARRIER_MASTER',
      pkField: 'carrier_id',
      checkFields: ['carrier_name', 'carrier_type', 'status'],
    },
    {
      collection: 'products',
      spreadsheetId: RAPID_MATRIX_ID,
      tabName: '_PRODUCT_MASTER',
      pkField: 'product_id',
      checkFields: ['product_name', 'product_type', 'carrier_name'],
    },
    {
      collection: 'opportunities',
      spreadsheetId: PRODASH_MATRIX_ID,
      tabName: '_OPPORTUNITIES',
      pkField: 'opportunity_id',
      checkFields: ['client_id', 'opportunity_type', 'status'],
    },
    {
      collection: 'revenue',
      spreadsheetId: SENTINEL_MATRIX_ID,
      tabName: '_REVENUE_MASTER',
      pkField: 'revenue_id',
      checkFields: ['agent_id', 'carrier_name', 'product_type', 'premium'],
    },
    {
      collection: 'activities',
      spreadsheetId: PRODASH_MATRIX_ID,
      tabName: '_ACTIVITY_LOG',
      pkField: 'activity_id',
      checkFields: ['entity_id', 'entity_type', 'activity_type'],
    },
    {
      collection: 'communications',
      spreadsheetId: RAPID_MATRIX_ID,
      tabName: '_COMMUNICATION_LOG',
      pkField: 'communication_id',
      checkFields: ['client_id', 'channel', 'direction', 'status'],
    },
    {
      collection: 'campaigns',
      spreadsheetId: PRODASH_MATRIX_ID,
      tabName: '_CAMPAIGNS',
      pkField: 'campaign_id',
      checkFields: ['campaign_name', 'campaign_type', 'status'],
    },
    {
      collection: 'users',
      spreadsheetId: RAPID_MATRIX_ID,
      tabName: '_USER_HIERARCHY',
      pkField: 'email',
      checkFields: ['first_name', 'last_name', 'user_level', 'status'],
    },
  ]

  const results: Awaited<ReturnType<typeof spotCheck>>[] = []

  for (const check of checks) {
    try {
      const result = await spotCheck(check)
      results.push(result)
    } catch (err: any) {
      console.error(`   SKIP ${check.collection}: ${err.message || err}`)
      results.push({
        collection: check.collection,
        total: -1,
        checked: 0,
        matched: 0,
        mismatches: [],
        missing: [],
      })
    }
  }

  // ========== SUMMARY ==========
  console.log('\n=== Spot-Check Summary ===')
  console.log('+----------------------+--------+---------+---------+---------+')
  console.log('| Collection           |  Total | Checked | Matched | Missing |')
  console.log('+----------------------+--------+---------+---------+---------+')
  for (const r of results) {
    const col = r.collection.padEnd(20)
    const total = r.total >= 0 ? String(r.total).padStart(6) : ' ERROR'
    const checked = String(r.checked).padStart(7)
    const matched = String(r.matched).padStart(7)
    const miss = String(r.missing.length).padStart(7)
    console.log(`| ${col} | ${total} | ${checked} | ${matched} | ${miss} |`)
  }
  console.log('+----------------------+--------+---------+---------+---------+')

  const totalMismatches = results.reduce((sum, r) => sum + r.mismatches.length, 0)
  const totalMissing = results.reduce((sum, r) => sum + r.missing.length, 0)
  console.log(`\nField mismatches: ${totalMismatches} | Docs missing from Sheets: ${totalMissing}`)

  if (totalMismatches === 0 && totalMissing === 0) {
    console.log('All spot-checks PASSED.')
  } else {
    console.log('Some discrepancies found — review above.')
  }
}

main().catch((err) => {
  console.error('Spot-check failed:', err)
  process.exit(1)
})
