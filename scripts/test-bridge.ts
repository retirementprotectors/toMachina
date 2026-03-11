#!/usr/bin/env npx tsx
/**
 * Bridge integration test script.
 *
 * Step 1: Verify test doc in Firestore
 * Step 2: Read _CARRIER_MASTER headers from Sheets to understand structure
 * Step 3: Start bridge, insert test doc, verify both stores
 * Step 4: Clean up test doc from both stores
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

const PROJECT_ID = 'claude-mcp-484718'
const RAPID_MATRIX_ID = '1nnSY-J3n6DtVvKqyC40zpEt1sROtHkIEqmSwG-5d9dU'
const TEST_DOC_ID = 'TEST_BRIDGE_001'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return auth.getClient()
}

async function main() {
  const mode = process.argv[2] || 'check'

  if (mode === 'check') {
    // Check if test doc exists in Firestore
    console.log('=== Checking Firestore for test doc ===')
    const doc = await db.collection('carriers').doc(TEST_DOC_ID).get()
    if (doc.exists) {
      console.log('  FOUND in Firestore:')
      console.log('  ', JSON.stringify(doc.data(), null, 2))
    } else {
      console.log('  NOT found in Firestore')
    }

    // Check Sheets headers
    console.log('\n=== Reading _CARRIER_MASTER headers from RAPID_MATRIX ===')
    const auth = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth: auth as any })

    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: RAPID_MATRIX_ID,
      range: '_CARRIER_MASTER!1:1',
    })
    const headers = headerResp.data.values?.[0] || []
    console.log('  Headers:', headers.join(', '))
    console.log('  Column count:', headers.length)

    // Check for test row in Sheets
    console.log('\n=== Checking _CARRIER_MASTER for test row ===')
    const colAResp = await sheets.spreadsheets.values.get({
      spreadsheetId: RAPID_MATRIX_ID,
      range: '_CARRIER_MASTER!A:A',
    })
    const colA = colAResp.data.values || []
    let testRowNum = -1
    for (let i = 0; i < colA.length; i++) {
      if (colA[i]?.[0] === TEST_DOC_ID) {
        testRowNum = i + 1
        break
      }
    }
    if (testRowNum > 0) {
      console.log(`  FOUND test row at row ${testRowNum}`)
      // Read that row
      const rowResp = await sheets.spreadsheets.values.get({
        spreadsheetId: RAPID_MATRIX_ID,
        range: `_CARRIER_MASTER!${testRowNum}:${testRowNum}`,
      })
      console.log('  Row data:', rowResp.data.values?.[0])
    } else {
      console.log('  NOT found in Sheets')
    }

    // Count total rows
    console.log(`\n  Total rows in column A: ${colA.length} (including header)`)
  }

  if (mode === 'cleanup') {
    console.log('=== Cleaning up test doc ===')

    // Delete from Firestore
    console.log('  Deleting from Firestore...')
    await db.collection('carriers').doc(TEST_DOC_ID).delete()
    console.log('  Firestore: deleted')

    // Delete from Sheets
    console.log('  Checking Sheets for test row...')
    const auth = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth: auth as any })

    const colAResp = await sheets.spreadsheets.values.get({
      spreadsheetId: RAPID_MATRIX_ID,
      range: '_CARRIER_MASTER!A:A',
    })
    const colA = colAResp.data.values || []
    let testRowNum = -1
    for (let i = 0; i < colA.length; i++) {
      if (colA[i]?.[0] === TEST_DOC_ID) {
        testRowNum = i + 1
        break
      }
    }

    if (testRowNum > 0) {
      // Get sheet ID for _CARRIER_MASTER
      const ssResp = await sheets.spreadsheets.get({
        spreadsheetId: RAPID_MATRIX_ID,
        fields: 'sheets.properties',
      })
      const carrierSheet = ssResp.data.sheets?.find(
        s => s.properties?.title === '_CARRIER_MASTER'
      )
      if (carrierSheet?.properties?.sheetId != null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: RAPID_MATRIX_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: carrierSheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: testRowNum - 1, // 0-based
                  endIndex: testRowNum,
                },
              },
            }],
          },
        })
        console.log(`  Sheets: deleted row ${testRowNum}`)
      }
    } else {
      console.log('  Sheets: no test row found (already clean)')
    }

    console.log('  Cleanup complete')
  }

  if (mode === 'insert-direct') {
    // Insert test row directly into Sheets to verify Sheets API works
    console.log('=== Direct Sheets insert test ===')
    const auth = await getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth: auth as any })

    // Read headers first
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: RAPID_MATRIX_ID,
      range: '_CARRIER_MASTER!1:1',
    })
    const headers = (headerResp.data.values?.[0] || []).map((h: string) =>
      h.trim().toLowerCase().replace(/\s+/g, '_')
    )
    console.log('  Headers (normalized):', headers.slice(0, 10).join(', '))

    // Build row aligned to headers
    const data: Record<string, string> = {
      carrier_id: TEST_DOC_ID,
      carrier_name: 'BRIDGE TEST - DELETE ME',
      carrier_type: 'test',
      status: 'test',
    }
    const row = headers.map((h: string) => data[h] || '')
    console.log('  Row to insert:', row.filter(Boolean))

    const appendResp = await sheets.spreadsheets.values.append({
      spreadsheetId: RAPID_MATRIX_ID,
      range: '_CARRIER_MASTER!A:A',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
    console.log('  Append result:', appendResp.data.updates?.updatedRange)
    console.log('  Direct Sheets insert: SUCCESS')
  }
}

main().catch(err => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
