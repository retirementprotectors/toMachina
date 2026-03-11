import express from 'express'
import cors from 'cors'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import {
  TABLE_ROUTING,
  FIRESTORE_COLLECTIONS,
  getTablePlatform,
  type Platform,
} from '@tomachina/core'

// ============================================================================
// INIT
// ============================================================================

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718',
  })
}

const db = getFirestore()
const app = express()

app.use(cors({ origin: true }))
app.use(express.json({ limit: '5mb' }))

// ============================================================================
// MATRIX SHEET IDS — from env vars, matching RAPID_CORE getMATRIX_ID() pattern
// ============================================================================

function getMatrixId(platform: Platform): string {
  switch (platform) {
    case 'RAPID':
      return process.env.RAPID_MATRIX_ID || ''
    case 'PRODASH':
      return process.env.PRODASH_MATRIX_ID || ''
    case 'SENTINEL':
      return process.env.SENTINEL_MATRIX_ID || ''
  }
}

// ============================================================================
// SHEETS API CLIENT
// ============================================================================

let sheetsClient: ReturnType<typeof google.sheets> | null = null

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  const authClient = await auth.getClient()
  sheetsClient = google.sheets({ version: 'v4', auth: authClient as any })
  return sheetsClient
}

// ============================================================================
// TAB-TO-COLLECTION REVERSE MAP
// Collection name -> MATRIX tab name
// ============================================================================

const COLLECTION_TO_TAB: Record<string, string> = {}
for (const [tab, collection] of Object.entries(FIRESTORE_COLLECTIONS)) {
  // Skip subcollection patterns (contain {client_id}) -- those need special handling
  if (!collection.includes('{')) {
    COLLECTION_TO_TAB[collection] = tab
  }
}

// Account subcollections map to multiple tabs -- resolve by account_type_category
const ACCOUNT_TYPE_TO_TAB: Record<string, string> = {
  'annuity': '_ACCOUNT_ANNUITY',
  'life': '_ACCOUNT_LIFE',
  'medicare': '_ACCOUNT_MEDICARE',
  'bdria': '_ACCOUNT_BDRIA',
  'banking': '_ACCOUNT_BANKING',
}

/**
 * Resolve a Firestore collection name to its MATRIX tab name.
 * Handles top-level collections and account subcollections.
 */
function resolveTab(collection: string, data?: Record<string, unknown>): string | null {
  // Direct match for top-level collections
  if (COLLECTION_TO_TAB[collection]) return COLLECTION_TO_TAB[collection]

  // Account subcollections: resolve by account_type_category
  if (collection === 'accounts' && data?.account_type_category) {
    const typeTab = ACCOUNT_TYPE_TO_TAB[String(data.account_type_category).toLowerCase()]
    if (typeTab) return typeTab
  }

  // Activity and relationship subcollections
  if (collection === 'activities') return '_ACTIVITY_LOG'
  if (collection === 'relationships') return '_RELATIONSHIPS'

  return null
}

// ============================================================================
// SHEETS OPERATIONS
// ============================================================================

/**
 * Get all headers from a sheet tab (first row).
 */
async function getSheetHeaders(spreadsheetId: string, tabName: string): Promise<string[]> {
  try {
    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!1:1`,
    })
    return (response.data.values?.[0] || []).map((h: string) =>
      h.trim().toLowerCase().replace(/\s+/g, '_')
    )
  } catch (err) {
    console.error(`[Bridge/Sheets] Failed to get headers for ${tabName}: ${err}`)
    return []
  }
}

/**
 * Find row by primary key value in column A (or specified PK column).
 * Returns 1-based row number or null.
 */
async function findRowByPK(
  spreadsheetId: string,
  tabName: string,
  pkValue: string,
  pkColumn: string = 'A'
): Promise<number | null> {
  try {
    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!${pkColumn}:${pkColumn}`,
    })
    const values = response.data.values || []
    for (let i = 1; i < values.length; i++) {
      if (values[i]?.[0] && String(values[i][0]).trim() === pkValue) {
        return i + 1 // 1-based row number
      }
    }
    return null
  } catch (err) {
    console.error(`[Bridge/Sheets] findRowByPK failed: ${err}`)
    return null
  }
}

/**
 * Build a row array from data object, aligned to sheet headers.
 */
function buildRow(headers: string[], data: Record<string, unknown>): (string | number | boolean)[] {
  return headers.map((header) => {
    const val = data[header]
    if (val === null || val === undefined) return ''
    if (typeof val === 'object') return JSON.stringify(val)
    return val as string | number | boolean
  })
}

/**
 * Append a row to a sheet tab.
 */
async function appendRow(
  spreadsheetId: string,
  tabName: string,
  headers: string[],
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const sheets = await getSheetsClient()
    const row = buildRow(headers, data)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
    return true
  } catch (err) {
    console.error(`[Bridge/Sheets] appendRow failed for ${tabName}: ${err}`)
    return false
  }
}

/**
 * Update a row in a sheet tab at a specific row number.
 */
async function updateRow(
  spreadsheetId: string,
  tabName: string,
  rowNumber: number,
  headers: string[],
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const sheets = await getSheetsClient()
    // Only update columns that have values in data
    const updates: { range: string; values: unknown[][] }[] = []

    for (const [key, val] of Object.entries(data)) {
      const colIndex = headers.indexOf(key)
      if (colIndex === -1) continue
      const colLetter = columnToLetter(colIndex)
      const cellVal = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : val
      updates.push({
        range: `${tabName}!${colLetter}${rowNumber}`,
        values: [[cellVal]],
      })
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      })
    }
    return true
  } catch (err) {
    console.error(`[Bridge/Sheets] updateRow failed for ${tabName} row ${rowNumber}: ${err}`)
    return false
  }
}

/**
 * Soft-delete a row by setting a status column to 'deleted'.
 */
async function softDeleteRow(
  spreadsheetId: string,
  tabName: string,
  rowNumber: number,
  headers: string[]
): Promise<boolean> {
  // Find a status-like column
  const statusFields = ['client_status', 'status', 'account_status', 'record_status']
  const statusCol = statusFields.find((f) => headers.includes(f))

  if (!statusCol) {
    console.warn(`[Bridge/Sheets] No status column found in ${tabName} for soft delete`)
    return false
  }

  return updateRow(spreadsheetId, tabName, rowNumber, headers, {
    [statusCol]: 'deleted',
    updated_at: new Date().toISOString(),
  })
}

/**
 * Convert 0-based column index to letter (0 -> A, 25 -> Z, 26 -> AA).
 */
function columnToLetter(index: number): string {
  let letter = ''
  let temp = index
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (_req, res) => {
  const matrixStatus = {
    RAPID: !!getMatrixId('RAPID'),
    PRODASH: !!getMatrixId('PRODASH'),
    SENTINEL: !!getMatrixId('SENTINEL'),
  }

  res.json({
    status: 'ok',
    service: 'tomachina-bridge',
    timestamp: new Date().toISOString(),
    sheetsConfigured: Object.values(matrixStatus).some(Boolean),
    matrixStatus,
  })
})

// ============================================================================
// DUAL-WRITE ENDPOINT
// ============================================================================

interface WriteRequest {
  collection: string
  operation: 'insert' | 'update' | 'delete'
  id?: string
  data?: Record<string, unknown>
}

interface WriteResponse {
  success: boolean
  id?: string
  stores: {
    firestore: 'ok' | 'failed'
    sheets: 'ok' | 'failed' | 'skipped'
  }
  error?: string
}

app.post('/write', async (req, res) => {
  const startTime = Date.now()
  const { collection: collName, operation, id, data } = req.body as WriteRequest

  if (!collName || !operation) {
    res.status(400).json({
      success: false,
      error: 'Missing collection or operation',
      stores: { firestore: 'failed', sheets: 'skipped' },
    } as WriteResponse)
    return
  }

  let firestoreStatus: 'ok' | 'failed' = 'failed'
  let sheetsStatus: 'ok' | 'failed' | 'skipped' = 'skipped'
  let docId = id

  // ── Primary: Firestore ───────────────────────────────────────────────
  try {
    const collRef = db.collection(collName)

    switch (operation) {
      case 'insert': {
        if (docId) {
          await collRef.doc(docId).set({
            ...data,
            created_at: data?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        } else {
          const docRef = await collRef.add({
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          docId = docRef.id
        }
        firestoreStatus = 'ok'
        break
      }
      case 'update': {
        if (!docId) {
          res.status(400).json({
            success: false,
            error: 'Update requires id',
            stores: { firestore: 'failed', sheets: 'skipped' },
          } as WriteResponse)
          return
        }
        await collRef.doc(docId).update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        firestoreStatus = 'ok'
        break
      }
      case 'delete': {
        if (!docId) {
          res.status(400).json({
            success: false,
            error: 'Delete requires id',
            stores: { firestore: 'failed', sheets: 'skipped' },
          } as WriteResponse)
          return
        }
        // Soft delete in Firestore (same as API pattern)
        await collRef.doc(docId).update({
          _deleted: true,
          _deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        firestoreStatus = 'ok'
        break
      }
    }
  } catch (err) {
    console.error(`[Bridge] Firestore ${operation} failed for ${collName}/${docId}: ${err}`)
    firestoreStatus = 'failed'
  }

  // ── Secondary: Sheets (never rollback Firestore on failure) ──────────
  try {
    const tabName = resolveTab(collName, data)

    if (!tabName) {
      sheetsStatus = 'skipped'
      console.log(`[Bridge/Sheets] No tab mapping for collection "${collName}" — skipping Sheets write`)
    } else {
      const platform = getTablePlatform(tabName)
      const spreadsheetId = getMatrixId(platform)

      if (!spreadsheetId) {
        sheetsStatus = 'skipped'
        console.warn(`[Bridge/Sheets] No MATRIX ID configured for platform ${platform} — skipping Sheets write`)
      } else {
        const headers = await getSheetHeaders(spreadsheetId, tabName)

        if (headers.length === 0) {
          sheetsStatus = 'failed'
          console.error(`[Bridge/Sheets] Could not read headers from ${tabName}`)
        } else {
          switch (operation) {
            case 'insert': {
              const writeData = { ...data, [headers[0]]: docId }
              const ok = await appendRow(spreadsheetId, tabName, headers, writeData)
              sheetsStatus = ok ? 'ok' : 'failed'
              break
            }
            case 'update': {
              if (!docId) break
              const pkCol = columnToLetter(0) // PK is always column A (schema[0])
              const rowNum = await findRowByPK(spreadsheetId, tabName, docId, pkCol)
              if (rowNum) {
                const ok = await updateRow(spreadsheetId, tabName, rowNum, headers, data || {})
                sheetsStatus = ok ? 'ok' : 'failed'
              } else {
                // Row not found in Sheets — may be a new record or migration gap
                console.warn(`[Bridge/Sheets] PK "${docId}" not found in ${tabName} — row not updated`)
                sheetsStatus = 'failed'
              }
              break
            }
            case 'delete': {
              if (!docId) break
              const pkColDel = columnToLetter(0)
              const rowNumDel = await findRowByPK(spreadsheetId, tabName, docId, pkColDel)
              if (rowNumDel) {
                const ok = await softDeleteRow(spreadsheetId, tabName, rowNumDel, headers)
                sheetsStatus = ok ? 'ok' : 'failed'
              } else {
                console.warn(`[Bridge/Sheets] PK "${docId}" not found in ${tabName} — soft delete skipped`)
                sheetsStatus = 'failed'
              }
              break
            }
          }
        }
      }
    }
  } catch (err) {
    // Sheets failure = log + continue. NEVER rollback Firestore.
    console.error(`[Bridge/Sheets] Error during ${operation} on ${collName}: ${err}`)
    sheetsStatus = 'failed'
  }

  const elapsed = Date.now() - startTime
  console.log(`[Bridge] ${operation} ${collName}/${docId} — firestore:${firestoreStatus} sheets:${sheetsStatus} (${elapsed}ms)`)

  // If Firestore succeeded, the overall operation is successful
  // Sheets failure is logged but does not fail the request
  const success = firestoreStatus === 'ok'
  const statusCode = success ? 200 : 500

  res.status(statusCode).json({
    success,
    id: docId,
    stores: { firestore: firestoreStatus, sheets: sheetsStatus },
  } as WriteResponse)
})

// ============================================================================
// BATCH WRITE ENDPOINT (for bulk operations)
// ============================================================================

interface BatchWriteRequest {
  writes: WriteRequest[]
}

app.post('/batch-write', async (req, res) => {
  const { writes } = req.body as BatchWriteRequest

  if (!Array.isArray(writes) || writes.length === 0) {
    res.status(400).json({ success: false, error: 'Missing or empty writes array' })
    return
  }

  if (writes.length > 500) {
    res.status(400).json({ success: false, error: 'Batch limit is 500 writes' })
    return
  }

  const results: WriteResponse[] = []

  // Process writes in Firestore batch
  const batch = db.batch()
  const writeDetails: { collName: string; operation: string; docId: string; data?: Record<string, unknown> }[] = []

  for (const write of writes) {
    const { collection: collName, operation, id, data } = write
    if (!collName || !operation) continue

    const collRef = db.collection(collName)
    let docId = id || ''

    switch (operation) {
      case 'insert': {
        if (!docId) docId = collRef.doc().id
        batch.set(collRef.doc(docId), {
          ...data,
          created_at: data?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        break
      }
      case 'update': {
        if (!docId) continue
        batch.update(collRef.doc(docId), {
          ...data,
          updated_at: new Date().toISOString(),
        })
        break
      }
      case 'delete': {
        if (!docId) continue
        batch.update(collRef.doc(docId), {
          _deleted: true,
          _deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        break
      }
    }

    writeDetails.push({ collName, operation, docId, data })
  }

  try {
    await batch.commit()

    // Log Sheets sync intent — batch Sheets writes are deferred
    for (const detail of writeDetails) {
      results.push({
        success: true,
        id: detail.docId,
        stores: { firestore: 'ok', sheets: 'skipped' },
      })
    }

    console.log(`[Bridge] Batch: ${writeDetails.length} Firestore writes committed (Sheets sync deferred)`)
  } catch (err) {
    console.error(`[Bridge] Batch Firestore commit failed: ${err}`)
    for (const detail of writeDetails) {
      results.push({
        success: false,
        id: detail.docId,
        stores: { firestore: 'failed', sheets: 'skipped' },
        error: String(err),
      })
    }
  }

  res.json({
    success: results.every((r) => r.success),
    count: results.length,
    results,
  })
})

// ============================================================================
// STATUS / DEBUG ENDPOINTS
// ============================================================================

app.get('/status/sheets', async (_req, res) => {
  const platforms: Platform[] = ['RAPID', 'PRODASH', 'SENTINEL']
  const status: Record<string, { configured: boolean; tabCount: number }> = {}

  for (const platform of platforms) {
    const matrixId = getMatrixId(platform)
    const tabs = Object.entries(TABLE_ROUTING)
      .filter(([, p]) => p === platform)
      .map(([tab]) => tab)

    status[platform] = {
      configured: !!matrixId,
      tabCount: tabs.length,
    }
  }

  res.json({ success: true, data: status })
})

// ============================================================================
// START SERVER
// ============================================================================

const PORT = parseInt(process.env.PORT || '8081', 10)
app.listen(PORT, () => {
  console.log(`toMachina Bridge listening on port ${PORT}`)
  console.log(`   RAPID_MATRIX_ID: ${getMatrixId('RAPID') ? 'configured' : 'NOT SET'}`)
  console.log(`   PRODASH_MATRIX_ID: ${getMatrixId('PRODASH') ? 'configured' : 'NOT SET'}`)
  console.log(`   SENTINEL_MATRIX_ID: ${getMatrixId('SENTINEL') ? 'configured' : 'NOT SET'}`)
})
