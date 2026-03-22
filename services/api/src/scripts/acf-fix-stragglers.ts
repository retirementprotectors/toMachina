/**
 * ACF Fix Stragglers (TRK-13601)
 *
 * Fixes 3 folder naming / duplication issues in Google Drive ACF root:
 *   1. Kay Cline: Merge duplicate ACF folders (smaller into larger), delete empty
 *   2. GARY ROSENTRETER: Rename to proper title case "ACF - Gary Rosentreter"
 *   3. Malone: Remove trailing comma from folder name
 *
 * Usage:
 *   npx tsx services/api/src/scripts/acf-fix-stragglers.ts           # Dry run
 *   npx tsx services/api/src/scripts/acf-fix-stragglers.ts --commit  # Execute
 */

import { google, type drive_v3 } from 'googleapis'

// ── Configuration ──

const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'

const commitMode = process.argv.includes('--commit')

// ── Types ──

interface FixAction {
  type: 'merge' | 'rename'
  description: string
  details: Record<string, unknown>
}

interface StragglersResult {
  success: boolean
  data?: {
    actionsPlanned: number
    actionsExecuted: number
    actions: FixAction[]
  }
  error?: string
}

// ── Helpers ──

async function listAllItems(
  drive: drive_v3.Drive,
  folderId: string,
  foldersOnly: boolean
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const items: Array<{ id: string; name: string; mimeType: string }> = []
  let pageToken: string | undefined
  const mimeFilter = foldersOnly
    ? " and mimeType = 'application/vnd.google-apps.folder'"
    : ''

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false${mimeFilter}`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = res.data.files || []
    for (const f of files) {
      if (f.id && f.name) {
        items.push({ id: f.id, name: f.name, mimeType: f.mimeType || '' })
      }
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return items
}

async function countFolderContents(
  drive: drive_v3.Drive,
  folderId: string
): Promise<number> {
  const items = await listAllItems(drive, folderId, false)
  return items.length
}

async function moveFile(
  drive: drive_v3.Drive,
  fileId: string,
  fromFolderId: string,
  toFolderId: string
): Promise<void> {
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    supportsAllDrives: true,
  })
}

// ── Fix Functions ──

async function fixKayClineDuplicates(
  drive: drive_v3.Drive,
  folders: Array<{ id: string; name: string; mimeType: string }>
): Promise<FixAction | null> {
  // Find Kay Cline folders
  const kayFolders = folders.filter(
    (f) => f.name.toLowerCase().includes('kay') && f.name.toLowerCase().includes('cline')
  )

  if (kayFolders.length < 2) {
    console.log('  Kay Cline: No duplicate folders found (expected 2)')
    return null
  }

  console.log(`  Kay Cline: Found ${kayFolders.length} folders:`)
  const folderSizes: Array<{ folder: typeof kayFolders[0]; count: number }> = []

  for (const f of kayFolders) {
    const count = await countFolderContents(drive, f.id)
    folderSizes.push({ folder: f, count })
    console.log(`    - "${f.name}" (${f.id}): ${count} files`)
  }

  // Sort by count descending — keep the larger one
  folderSizes.sort((a, b) => b.count - a.count)
  const primary = folderSizes[0]
  const secondary = folderSizes[1]

  const action: FixAction = {
    type: 'merge',
    description: `Merge Kay Cline folder "${secondary.folder.name}" (${secondary.count} files) into "${primary.folder.name}" (${primary.count} files)`,
    details: {
      primaryId: primary.folder.id,
      primaryName: primary.folder.name,
      primaryCount: primary.count,
      secondaryId: secondary.folder.id,
      secondaryName: secondary.folder.name,
      secondaryCount: secondary.count,
    },
  }

  if (commitMode) {
    // Move all files from secondary into primary
    const filesToMove = await listAllItems(drive, secondary.folder.id, false)
    const subFoldersToMove = await listAllItems(drive, secondary.folder.id, true)
    const allItems = [...filesToMove, ...subFoldersToMove]

    for (const item of allItems) {
      console.log(`    Moving "${item.name}" to primary folder...`)
      await moveFile(drive, item.id, secondary.folder.id, primary.folder.id)
    }

    // Verify secondary is empty, then delete
    const remaining = await countFolderContents(drive, secondary.folder.id)
    const remainingFolders = await listAllItems(drive, secondary.folder.id, true)
    if (remaining === 0 && remainingFolders.length === 0) {
      await drive.files.delete({
        fileId: secondary.folder.id,
        supportsAllDrives: true,
      })
      console.log(`    Deleted empty folder "${secondary.folder.name}"`)
    } else {
      console.log(`    WARNING: Secondary folder still has ${remaining} files + ${remainingFolders.length} subfolders, not deleting`)
    }
  }

  return action
}

async function fixGaryRosentreter(
  drive: drive_v3.Drive,
  folders: Array<{ id: string; name: string; mimeType: string }>
): Promise<FixAction | null> {
  const garyFolder = folders.find(
    (f) => f.name.toLowerCase().includes('gary') && f.name.toLowerCase().includes('rosentreter')
  )

  if (!garyFolder) {
    console.log('  Gary Rosentreter: Folder not found')
    return null
  }

  const newName = 'ACF - Gary Rosentreter'

  if (garyFolder.name === newName) {
    console.log(`  Gary Rosentreter: Already properly named "${newName}"`)
    return null
  }

  const action: FixAction = {
    type: 'rename',
    description: `Rename "${garyFolder.name}" to "${newName}"`,
    details: {
      folderId: garyFolder.id,
      oldName: garyFolder.name,
      newName,
    },
  }

  console.log(`  Gary Rosentreter: "${garyFolder.name}" → "${newName}"`)

  if (commitMode) {
    await drive.files.update({
      fileId: garyFolder.id,
      requestBody: { name: newName },
      supportsAllDrives: true,
    })
    console.log(`    Renamed successfully`)
  }

  return action
}

async function fixMaloneTrailingComma(
  drive: drive_v3.Drive,
  folders: Array<{ id: string; name: string; mimeType: string }>
): Promise<FixAction | null> {
  const maloneFolder = folders.find(
    (f) => f.name.toLowerCase().includes('malone') && f.name.endsWith(',')
  )

  if (!maloneFolder) {
    // Also check for trailing comma anywhere in Malone folders
    const anyMalone = folders.find(
      (f) => f.name.toLowerCase().includes('malone') && /,\s*$/.test(f.name)
    )
    if (!anyMalone) {
      console.log('  Malone: No folder with trailing comma found')
      return null
    }
    // Use the broader match
    const newName = anyMalone.name.replace(/,\s*$/, '')
    const action: FixAction = {
      type: 'rename',
      description: `Remove trailing comma: "${anyMalone.name}" → "${newName}"`,
      details: { folderId: anyMalone.id, oldName: anyMalone.name, newName },
    }

    console.log(`  Malone: "${anyMalone.name}" → "${newName}"`)

    if (commitMode) {
      await drive.files.update({
        fileId: anyMalone.id,
        requestBody: { name: newName },
        supportsAllDrives: true,
      })
      console.log(`    Renamed successfully`)
    }

    return action
  }

  const newName = maloneFolder.name.replace(/,\s*$/, '')
  const action: FixAction = {
    type: 'rename',
    description: `Remove trailing comma: "${maloneFolder.name}" → "${newName}"`,
    details: { folderId: maloneFolder.id, oldName: maloneFolder.name, newName },
  }

  console.log(`  Malone: "${maloneFolder.name}" → "${newName}"`)

  if (commitMode) {
    await drive.files.update({
      fileId: maloneFolder.id,
      requestBody: { name: newName },
      supportsAllDrives: true,
    })
    console.log(`    Renamed successfully`)
  }

  return action
}

// ── Main ──

async function main(): Promise<StragglersResult> {
  console.log(
    commitMode
      ? 'COMMIT MODE: changes will be applied to Google Drive'
      : 'DRY RUN: no changes will be made (pass --commit to execute)'
  )
  console.log('---')

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })

  // List all ACF folders
  console.log(`Scanning ACF root: ${ACF_ROOT}`)
  const folders = await listAllItems(drive, ACF_ROOT, true)
  console.log(`Found ${folders.length} ACF folders\n`)

  const actions: FixAction[] = []
  let actionsExecuted = 0

  // Fix 1: Kay Cline duplicates
  console.log('Fix 1: Kay Cline duplicate folders')
  const kayAction = await fixKayClineDuplicates(drive, folders)
  if (kayAction) {
    actions.push(kayAction)
    if (commitMode) actionsExecuted++
  }

  // Fix 2: Gary Rosentreter title case
  console.log('\nFix 2: Gary Rosentreter folder rename')
  const garyAction = await fixGaryRosentreter(drive, folders)
  if (garyAction) {
    actions.push(garyAction)
    if (commitMode) actionsExecuted++
  }

  // Fix 3: Malone trailing comma
  console.log('\nFix 3: Malone trailing comma')
  const maloneAction = await fixMaloneTrailingComma(drive, folders)
  if (maloneAction) {
    actions.push(maloneAction)
    if (commitMode) actionsExecuted++
  }

  // Summary
  console.log('\n--- Summary ---')
  console.log(`  Actions planned:  ${actions.length}`)
  console.log(`  Actions executed: ${commitMode ? actionsExecuted : 0}`)
  console.log(`  Mode: ${commitMode ? 'COMMIT' : 'DRY RUN'}`)

  if (!commitMode && actions.length > 0) {
    console.log('\nRun with --commit to apply these changes.')
  }

  return {
    success: true,
    data: {
      actionsPlanned: actions.length,
      actionsExecuted: commitMode ? actionsExecuted : 0,
      actions,
    },
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
