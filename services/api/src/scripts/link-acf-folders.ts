/**
 * link-acf-folders.ts — Match ACF Drive folders to Firestore client records
 * 
 * Reads subfolders from the ACF parent Drive folder, parses client names from
 * folder names (format: "ACF - First Last"), matches to Firestore clients,
 * and sets acf_folder_id + acf_folder_url on each client doc.
 * 
 * Usage: npx tsx services/api/src/scripts/link-acf-folders.ts [--dry-run]
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import { readFileSync } from 'fs'

// Config
const ACF_PARENT_FOLDER = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'
const SA_KEY_PATH = '/home/jdm/mdj-agent/sa-key.json'
const DRY_RUN = process.argv.includes('--dry-run')

// Init Firebase
const saKey = JSON.parse(readFileSync(SA_KEY_PATH, 'utf-8')) as ServiceAccount
initializeApp({ credential: cert(saKey) })
const db = getFirestore()

// Init Drive
const auth = new google.auth.GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
const drive = google.drive({ version: 'v3', auth })

interface FolderMatch {
  folder_id: string
  folder_name: string
  parsed_first: string
  parsed_last: string
  client_id: string | null
  client_name: string | null
  status: 'matched' | 'no_match' | 'multiple_matches'
}

async function listACFFolders(): Promise<Array<{ id: string; name: string }>> {
  const folders: Array<{ id: string; name: string }> = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${ACF_PARENT_FOLDER}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    })
    for (const f of res.data.files || []) {
      if (f.id && f.name) folders.push({ id: f.id, name: f.name })
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return folders
}

function parseName(folderName: string): { first: string; last: string } | null {
  // Format: "ACF - First Last" or "ACF - First & Spouse Last"
  const match = folderName.match(/^ACF\s*-\s*(.+)$/i)
  if (!match) return null

  const fullName = match[1].trim()
  // Handle "First & Spouse Last" → use first person's first name + shared last
  const ampersandMatch = fullName.match(/^(\w+)\s*[&+]\s*\w+\s+(.+)$/)
  if (ampersandMatch) {
    return { first: ampersandMatch[1], last: ampersandMatch[2] }
  }

  const parts = fullName.split(/\s+/)
  if (parts.length < 2) return null
  return { first: parts[0], last: parts[parts.length - 1] }
}

async function findClient(first: string, last: string): Promise<Array<{ id: string; name: string }>> {
  const firstUpper = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  const lastUpper = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase()

  const snap = await db.collection('clients')
    .where('last_name', '==', lastUpper)
    .where('first_name', '==', firstUpper)
    .limit(5)
    .get()

  return snap.docs.map(d => ({
    id: d.id,
    name: `${d.data().first_name} ${d.data().last_name}`,
  }))
}

async function main() {
  console.log(`ACF Folder Linker ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log(`Parent folder: ${ACF_PARENT_FOLDER}\n`)

  const folders = await listACFFolders()
  console.log(`Found ${folders.length} ACF folders in Drive\n`)

  const results: FolderMatch[] = []
  let matched = 0
  let noMatch = 0
  let multiple = 0

  for (const folder of folders) {
    const parsed = parseName(folder.name)
    if (!parsed) {
      console.log(`  SKIP: "${folder.name}" — can't parse name`)
      continue
    }

    const clients = await findClient(parsed.first, parsed.last)
    const result: FolderMatch = {
      folder_id: folder.id,
      folder_name: folder.name,
      parsed_first: parsed.first,
      parsed_last: parsed.last,
      client_id: null,
      client_name: null,
      status: 'no_match',
    }

    if (clients.length === 1) {
      result.client_id = clients[0].id
      result.client_name = clients[0].name
      result.status = 'matched'
      matched++

      if (!DRY_RUN) {
        await db.collection('clients').doc(clients[0].id).update({
          acf_folder_id: folder.id,
          acf_folder_url: `https://drive.google.com/drive/folders/${folder.id}`,
        })
      }
      console.log(`  ✓ MATCH: "${folder.name}" → ${clients[0].name} (${clients[0].id})`)
    } else if (clients.length > 1) {
      result.status = 'multiple_matches'
      multiple++
      console.log(`  ⚠ MULTIPLE: "${folder.name}" → ${clients.length} matches: ${clients.map(c => c.name).join(', ')}`)
    } else {
      noMatch++
      console.log(`  ✗ NO MATCH: "${folder.name}" → no client found for ${parsed.first} ${parsed.last}`)
    }

    results.push(result)
  }

  console.log(`\n--- SUMMARY ---`)
  console.log(`Total folders: ${folders.length}`)
  console.log(`Matched: ${matched}`)
  console.log(`No match: ${noMatch}`)
  console.log(`Multiple matches: ${multiple}`)
  if (DRY_RUN) console.log(`\n(DRY RUN — no Firestore writes made)`)
}

main().catch(console.error)
