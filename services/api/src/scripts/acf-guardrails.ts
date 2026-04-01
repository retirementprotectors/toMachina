/**
 * acf-guardrails.ts — ACF Drive Folder Protection Suite
 *
 * Three guardrails to prevent the March 21 batch-delete incident from recurring:
 *
 * 1. SNAPSHOT — Capture current ACF folder inventory to Firestore (acf_snapshots collection)
 * 2. TRASH-AUDIT — Check ACF parent folder for recently trashed items
 * 3. VERIFY — Compare current Drive state against last snapshot, report drift
 *
 * Usage:
 *   npx tsx services/api/src/scripts/acf-guardrails.ts snapshot
 *   npx tsx services/api/src/scripts/acf-guardrails.ts trash-audit
 *   npx tsx services/api/src/scripts/acf-guardrails.ts verify
 *
 * Root Cause (March 21, 2026):
 *   During a Drive reorg, 1,060 ACF folders were batch-deleted from Shared Drive.
 *   No guardrails existed. Folders sat in Trash for 10 days before discovery.
 *   All 1,060 restored ($0), 926 linked to Firestore clients.
 *
 * @author 2HINOBI, COO | Sprint 010 Night Shift
 */

import { initializeApp, cert, getApps, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import { readFileSync } from 'fs'

// Config
const ACF_PARENT_FOLDER = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'
const SA_KEY_PATH = '/home/jdm/mdj-agent/sa-key.json'
const TRASH_ALERT_THRESHOLD = 5

// Init
const saKey = JSON.parse(readFileSync(SA_KEY_PATH, 'utf-8')) as ServiceAccount
if (getApps().length === 0) {
  initializeApp({ credential: cert(saKey) })
}
const db = getFirestore()

const auth = new google.auth.GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
const drive = google.drive({ version: 'v3', auth })

interface ACFFolder {
  id: string
  name: string
  createdTime?: string
  modifiedTime?: string
}

interface ACFSnapshot {
  timestamp: string
  folder_count: number
  folders: Array<{ id: string; name: string }>
  triggered_by: string
}

async function listACFFolders(): Promise<ACFFolder[]> {
  const folders: ACFFolder[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: \`'\${ACF_PARENT_FOLDER}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false\`,
      fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
      pageSize: 100,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    })
    for (const f of res.data.files || []) {
      if (f.id && f.name) {
        folders.push({ id: f.id, name: f.name, createdTime: f.createdTime || undefined, modifiedTime: f.modifiedTime || undefined })
      }
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return folders
}

// Guardrail 1: SNAPSHOT
async function takeSnapshot() {
  console.log('ACF GUARDRAIL: Taking inventory snapshot...\n')
  const folders = await listACFFolders()
  console.log(\`Found \${folders.length} ACF folders in Drive\n\`)

  const snapshot: ACFSnapshot = {
    timestamp: new Date().toISOString(),
    folder_count: folders.length,
    folders: folders.map(f => ({ id: f.id, name: f.name })),
    triggered_by: '2HINOBI — acf-guardrails snapshot',
  }

  const docRef = db.collection('acf_snapshots').doc()
  await docRef.set({ ...snapshot, created_at: FieldValue.serverTimestamp() })
  await db.collection('acf_snapshots').doc('latest').set({ ...snapshot, created_at: FieldValue.serverTimestamp() })

  console.log(\`Snapshot saved: acf_snapshots/\${docRef.id}\`)
  console.log(\`Updated acf_snapshots/latest (\${folders.length} folders)\`)
  return snapshot
}

// Guardrail 2: TRASH AUDIT
async function trashAudit() {
  console.log('ACF GUARDRAIL: Checking Trash for ACF folders...\n')
  const trashedFolders: ACFFolder[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: \`'\${ACF_PARENT_FOLDER}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = true\`,
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageSize: 100,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    })
    for (const f of res.data.files || []) {
      if (f.id && f.name) trashedFolders.push({ id: f.id, name: f.name, modifiedTime: f.modifiedTime || undefined })
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  console.log(\`Found \${trashedFolders.length} ACF folders in Trash\n\`)

  if (trashedFolders.length > TRASH_ALERT_THRESHOLD) {
    console.log(\`ALERT: \${trashedFolders.length} in Trash (threshold: \${TRASH_ALERT_THRESHOLD})\`)
    for (const f of trashedFolders.slice(0, 20)) console.log(\`  - \${f.name} (\${f.id})\`)
    if (trashedFolders.length > 20) console.log(\`  ... and \${trashedFolders.length - 20} more\`)
  } else if (trashedFolders.length > 0) {
    console.log('Trashed folders (within normal range):')
    for (const f of trashedFolders) console.log(\`  - \${f.name} (\${f.id})\`)
  } else {
    console.log('No ACF folders in Trash. All clear.')
  }

  await db.collection('acf_audits').add({
    type: 'trash_audit', timestamp: new Date().toISOString(),
    trashed_count: trashedFolders.length,
    alert_triggered: trashedFolders.length > TRASH_ALERT_THRESHOLD,
    trashed_folders: trashedFolders.map(f => ({ id: f.id, name: f.name })),
    triggered_by: '2HINOBI — acf-guardrails trash-audit',
    created_at: FieldValue.serverTimestamp(),
  })

  return { count: trashedFolders.length, alert_triggered: trashedFolders.length > TRASH_ALERT_THRESHOLD }
}

// Guardrail 3: VERIFY
async function verify() {
  console.log('ACF GUARDRAIL: Verifying against last snapshot...\n')

  const latestDoc = await db.collection('acf_snapshots').doc('latest').get()
  if (!latestDoc.exists) {
    console.log('ERROR: No snapshot found. Run snapshot first.')
    return { status: 'no_baseline' }
  }

  const snapshot = latestDoc.data() as ACFSnapshot
  console.log(\`Last snapshot: \${snapshot.timestamp} (\${snapshot.folder_count} folders)\n\`)

  const currentFolders = await listACFFolders()
  console.log(\`Current Drive state: \${currentFolders.length} folders\n\`)

  const snapshotIds = new Set(snapshot.folders.map(f => f.id))
  const currentIds = new Set(currentFolders.map(f => f.id))

  const missing = snapshot.folders.filter(f => !currentIds.has(f.id))
  const added = currentFolders.filter(f => !snapshotIds.has(f.id))

  console.log('--- DRIFT REPORT ---')
  console.log(\`Snapshot: \${snapshot.folder_count} | Current: \${currentFolders.length}\`)
  console.log(\`Missing: \${missing.length} | Added: \${added.length}\`)

  if (missing.length > 0) {
    console.log('\nMISSING FOLDERS:')
    for (const f of missing.slice(0, 20)) console.log(\`  - \${f.name} (\${f.id})\`)
    if (missing.length > 20) console.log(\`  ... and \${missing.length - 20} more\`)
  }
  if (added.length > 0) {
    console.log('\nADDED FOLDERS:')
    for (const f of added.slice(0, 20)) console.log(\`  - \${f.name} (\${f.id})\`)
    if (added.length > 20) console.log(\`  ... and \${added.length - 20} more\`)
  }
  if (missing.length === 0 && added.length === 0) {
    console.log('\nNo drift detected. ACF folders match snapshot.')
  }

  await db.collection('acf_audits').add({
    type: 'verify', timestamp: new Date().toISOString(),
    snapshot_count: snapshot.folder_count, current_count: currentFolders.length,
    missing_count: missing.length, added_count: added.length,
    missing_folders: missing, added_folders: added.map(f => ({ id: f.id, name: f.name })),
    drift_detected: missing.length > 0 || added.length > 0,
    triggered_by: '2HINOBI — acf-guardrails verify',
    created_at: FieldValue.serverTimestamp(),
  })

  return { status: missing.length > 0 ? 'drift_detected' : 'clean', missing: missing.length, added: added.length }
}

// CLI Router
async function main() {
  const command = process.argv[2]
  switch (command) {
    case 'snapshot': await takeSnapshot(); break
    case 'trash-audit': await trashAudit(); break
    case 'verify': await verify(); break
    default:
      console.log('ACF Guardrails — Drive Folder Protection Suite')
      console.log('')
      console.log('Usage:')
      console.log('  npx tsx services/api/src/scripts/acf-guardrails.ts snapshot')
      console.log('  npx tsx services/api/src/scripts/acf-guardrails.ts trash-audit')
      console.log('  npx tsx services/api/src/scripts/acf-guardrails.ts verify')
      break
  }
}

main().catch(console.error)
