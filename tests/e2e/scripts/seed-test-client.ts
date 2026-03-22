#!/usr/bin/env npx tsx
/**
 * Seed script — creates test client + ACF folder for E2E tests.
 * Run once: npm run test:e2e:seed
 *
 * Idempotent: skips creation if already exists.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import {
  TEST_CLIENT_ID,
  TEST_CLIENT_NAME,
  SHARED_DRIVE_PARENT_ID,
} from '../helpers/constants.js'

const ACF_SUBFOLDERS = ['Client', 'Cases', 'NewBiz', 'Account', 'Reactive']

async function main() {
  // Initialize Firebase Admin
  if (getApps().length === 0) {
    initializeApp({ projectId: 'claude-mcp-484718' })
  }
  const db = getFirestore()

  // 1. Create test client in Firestore (idempotent)
  const clientRef = db.collection('clients').doc(TEST_CLIENT_ID)
  const clientDoc = await clientRef.get()

  if (clientDoc.exists) {
    console.log(`[seed] Test client ${TEST_CLIENT_ID} already exists`)
  } else {
    await clientRef.set({
      first_name: 'E2E',
      last_name: 'Test Client LLC',
      display_name: TEST_CLIENT_NAME,
      client_id: TEST_CLIENT_ID,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _e2e_test: true,
    })
    console.log(`[seed] Created test client: ${TEST_CLIENT_NAME}`)
  }

  // 2. Create ACF folder on Shared Drive
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })

  // Check if test ACF folder already exists
  const existingFolders = await drive.files.list({
    q: `name = 'E2E Test Client LLC - ACF' and '${SHARED_DRIVE_PARENT_ID}' in parents and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'files(id, name)',
  })

  let acfFolderId: string

  if (existingFolders.data.files && existingFolders.data.files.length > 0) {
    acfFolderId = existingFolders.data.files[0].id!
    console.log(`[seed] ACF folder already exists: ${acfFolderId}`)
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: 'E2E Test Client LLC - ACF',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [SHARED_DRIVE_PARENT_ID],
      },
      supportsAllDrives: true,
      fields: 'id',
    })
    acfFolderId = folder.data.id!
    console.log(`[seed] Created ACF folder: ${acfFolderId}`)
  }

  // 3. Create 5 lifecycle subfolders
  const subfolderIds: Record<string, string> = {}

  for (const name of ACF_SUBFOLDERS) {
    const existing = await drive.files.list({
      q: `name = '${name}' and '${acfFolderId}' in parents and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name)',
    })

    if (existing.data.files && existing.data.files.length > 0) {
      subfolderIds[name] = existing.data.files[0].id!
      console.log(`[seed] Subfolder "${name}" exists: ${subfolderIds[name]}`)
    } else {
      const sf = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [acfFolderId],
        },
        supportsAllDrives: true,
        fields: 'id',
      })
      subfolderIds[name] = sf.data.id!
      console.log(`[seed] Created subfolder "${name}": ${subfolderIds[name]}`)
    }
  }

  // 4. Update Firestore client with ACF folder ID
  await clientRef.update({
    acf_folder_id: acfFolderId,
    acf_subfolder_ids: subfolderIds,
    updated_at: new Date().toISOString(),
  })

  // 5. Print constants for manual verification
  console.log('\n[seed] === Test Constants ===')
  console.log(`TEST_ACF_FOLDER_ID = '${acfFolderId}'`)
  for (const [name, id] of Object.entries(subfolderIds)) {
    console.log(`  ${name}: '${id}'`)
  }
  console.log('\n[seed] Done. Constants will be loaded from Firestore at test runtime.')
}

main().catch(err => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
