#!/usr/bin/env npx tsx
/**
 * Bulk loader: Google Sheets -> Firestore
 * Reads _CLIENT_MASTER from PRODASH_MATRIX and writes to Firestore.
 *
 * Usage: npx tsx scripts/load-clients.ts
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key,
 * OR uses Application Default Credentials (gcloud auth application-default login)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

// GCP project
const PROJECT_ID = 'claude-mcp-484718'

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

// Sheets config - PRODASH_MATRIX spreadsheet
// We need to get this ID. Let's use the RAPID_CORE pattern.
// For now, read from the MCP execute_script approach.

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

async function loadClients() {
  console.log('Starting client migration to Firestore...')

  // Step 1: Get PRODASH_MATRIX spreadsheet ID
  // This is stored in RAPID_CORE Script Properties as PRODASH_MATRIX_ID
  // We'll need to pass it as an env var or read it from somewhere
  const matrixId = process.env.PRODASH_MATRIX_ID
  if (!matrixId) {
    console.error('Set PRODASH_MATRIX_ID environment variable')
    console.error('   Get it from RAPID_CORE Script Properties or the spreadsheet URL')
    process.exit(1)
  }

  // Step 2: Read _CLIENT_MASTER sheet
  console.log('Reading _CLIENT_MASTER from Sheets...')
  const rows = await readSheet(matrixId, '_CLIENT_MASTER')

  if (rows.length < 2) {
    console.error('No data found in _CLIENT_MASTER')
    process.exit(1)
  }

  // First row is headers
  const headers = rows[0].map((h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const dataRows = rows.slice(1)

  console.log(`Found ${dataRows.length} clients, ${headers.length} columns`)
  console.log(`   Headers: ${headers.slice(0, 10).join(', ')}...`)

  // Step 3: Convert rows to objects
  const clients = dataRows.map((row: string[]) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((header: string, i: number) => {
      const val = row[i] ?? ''
      // Skip empty values to keep Firestore docs clean
      if (val !== '') {
        obj[header] = val
      }
    })
    return obj
  })

  // Step 4: Filter out deleted/merged clients (same dedup logic as PRODASH_MatrixCache.gs)
  const activeClients = clients.filter((c: Record<string, unknown>) => {
    const status = String(c.status || c.client_status || '').toLowerCase()
    if (status === 'deleted') return false
    if (status === 'inactive - merged') return false
    return true
  })

  console.log(`${activeClients.length} active clients (filtered ${clients.length - activeClients.length} deleted/merged)`)

  // Step 5: Write to Firestore in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500
  let written = 0

  for (let i = 0; i < activeClients.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = activeClients.slice(i, i + BATCH_SIZE)

    for (const client of chunk) {
      // Use client_id as document ID, fallback to ghl_contact_id
      const docId = String(client.client_id || client.ghl_contact_id || `auto_${i + chunk.indexOf(client)}`)

      // Add timestamps
      const doc = {
        ...client,
        _migrated_at: new Date().toISOString(),
        _source: 'sheets_migration',
      }

      const ref = db.collection('clients').doc(docId)
      batch.set(ref, doc, { merge: true })
    }

    await batch.commit()
    written += chunk.length
    console.log(`   Wrote batch ${Math.floor(i / BATCH_SIZE) + 1}: ${written}/${activeClients.length}`)
  }

  console.log(`\nMigration complete! ${written} clients in Firestore.`)

  // Step 6: Verify
  const snapshot = await db.collection('clients').count().get()
  console.log(`   Firestore client count: ${snapshot.data().count}`)
}

// Also load accounts
async function loadAccounts() {
  const matrixId = process.env.PRODASH_MATRIX_ID
  if (!matrixId) return

  const accountTabs = [
    { sheet: '_ACCOUNT_ANNUITY', type: 'annuity' },
    { sheet: '_ACCOUNT_LIFE', type: 'life' },
    { sheet: '_ACCOUNT_MEDICARE', type: 'medicare' },
    { sheet: '_ACCOUNT_BDRIA', type: 'bdria' },
    { sheet: '_ACCOUNT_BANKING', type: 'banking' },
  ]

  for (const { sheet, type } of accountTabs) {
    console.log(`\nReading ${sheet}...`)

    try {
      const rows = await readSheet(matrixId, sheet)
      if (rows.length < 2) {
        console.log(`   No data in ${sheet}`)
        continue
      }

      const headers = rows[0].map((h: string) => h.trim().toLowerCase().replace(/\s+/g, '_'))
      const dataRows = rows.slice(1)
      console.log(`   Found ${dataRows.length} ${type} accounts`)

      const accounts = dataRows.map((row: string[]) => {
        const obj: Record<string, unknown> = { account_type_category: type }
        headers.forEach((header: string, i: number) => {
          const val = row[i] ?? ''
          if (val !== '') obj[header] = val
        })
        return obj
      })

      // Write as subcollections under clients
      const BATCH_SIZE = 500
      let written = 0

      for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        const batch = db.batch()
        const chunk = accounts.slice(i, i + BATCH_SIZE)

        for (const account of chunk) {
          const clientId = String(account.client_id || '')
          const accountId = String(account.account_id || account.policy_number || `auto_${type}_${i + chunk.indexOf(account)}`)

          if (!clientId) continue

          const doc = {
            ...account,
            _migrated_at: new Date().toISOString(),
            _source: 'sheets_migration',
          }

          const ref = db.collection('clients').doc(clientId).collection('accounts').doc(accountId)
          batch.set(ref, doc, { merge: true })
        }

        await batch.commit()
        written += chunk.length
      }

      console.log(`   Wrote ${written} ${type} accounts`)
    } catch (err) {
      console.error(`   Error reading ${sheet}: ${err}`)
    }
  }
}

async function main() {
  try {
    await loadClients()
    await loadAccounts()
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

main()
