/**
 * Dickson Ai3 Template Dedup Script
 *
 * Scans all ACF (Account Client Folders) in Google Drive for misplaced
 * Dickson Ai3 template files that were incorrectly copied into other
 * client folders.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/dickson-dedup.ts             # Dry run
 *   npx tsx services/api/src/scripts/dickson-dedup.ts --execute    # Delete misfiles
 */

import { google, type drive_v3 } from 'googleapis'

// ── Configuration ──

/** ACF root folder ID in Google Drive */
const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'

/** Patterns that indicate a folder legitimately belongs to a Dickson client */
const LEGIT_DICKSON_PATTERNS: RegExp[] = [/dickson/i]

/** Pattern to match Dickson template files (misfiles when in non-Dickson folders) */
const DICKSON_FILE_PATTERN = /dickson/i

// ── Types ──

interface Misfile {
  fileId: string
  fileName: string
  parentFolder: string
  parentId: string
}

interface ScanResult {
  success: boolean
  data?: {
    totalFolders: number
    totalMisfiles: number
    misfiles: Misfile[]
    deletedCount: number
  }
  error?: string
}

// ── Helpers ──

/**
 * Lists all files or folders within a Drive folder, handling pagination.
 */
async function listAllItems(
  drive: drive_v3.Drive,
  folderId: string,
  foldersOnly: boolean
): Promise<Array<{ id: string; name: string }>> {
  const items: Array<{ id: string; name: string }> = []
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
        items.push({ id: f.id, name: f.name })
      }
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return items
}

/**
 * Checks whether a folder name matches a legitimate Dickson client folder.
 */
function isLegitDicksonFolder(folderName: string): boolean {
  return LEGIT_DICKSON_PATTERNS.some((p) => p.test(folderName))
}

// ── Main ──

async function main(): Promise<ScanResult> {
  const executeMode = process.argv.includes('--execute')

  console.log(
    executeMode
      ? 'EXECUTE MODE: misfiles will be permanently deleted'
      : 'DRY RUN: no changes will be made (pass --execute to delete)'
  )
  console.log('---')

  // Authenticate using application default credentials
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  const drive = google.drive({ version: 'v3', auth })

  // 1. List all top-level client folders under ACF root
  console.log(`Scanning ACF root: ${ACF_ROOT}`)
  const folders = await listAllItems(drive, ACF_ROOT, true)
  console.log(`Found ${folders.length} ACF client folders`)

  // 2. Scan each folder for misplaced Dickson files
  const misfiles: Misfile[] = []
  let scannedCount = 0

  for (const folder of folders) {
    scannedCount++
    if (scannedCount % 50 === 0) {
      console.log(`  Scanned ${scannedCount}/${folders.length} folders...`)
    }

    // Skip folders that legitimately belong to a Dickson client
    if (isLegitDicksonFolder(folder.name)) {
      continue
    }

    // Search for Dickson-named files in this non-Dickson folder
    const files = await listAllItems(drive, folder.id, false)
    const dicksonFiles = files.filter((f) => DICKSON_FILE_PATTERN.test(f.name))

    for (const f of dicksonFiles) {
      misfiles.push({
        fileId: f.id,
        fileName: f.name,
        parentFolder: folder.name,
        parentId: folder.id,
      })
    }
  }

  // 3. Report findings
  console.log(`\nScan complete: ${folders.length} folders scanned`)
  console.log(`Found ${misfiles.length} misfile(s):`)

  for (const m of misfiles) {
    console.log(`  - "${m.fileName}" in folder "${m.parentFolder}" (${m.parentId})`)
  }

  // 4. Execute deletions if in execute mode
  let deletedCount = 0

  if (executeMode && misfiles.length > 0) {
    console.log(`\nDeleting ${misfiles.length} misfile(s)...`)

    for (const m of misfiles) {
      try {
        await drive.files.delete({
          fileId: m.fileId,
          supportsAllDrives: true,
        })
        deletedCount++
        console.log(`  Deleted: "${m.fileName}" from "${m.parentFolder}"`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`  Failed to delete "${m.fileName}": ${message}`)
      }
    }

    // 5. Post-delete verification scan
    console.log('\nRunning post-delete verification...')
    let remainingCount = 0

    for (const folder of folders) {
      if (isLegitDicksonFolder(folder.name)) continue

      const files = await listAllItems(drive, folder.id, false)
      const dicksonFiles = files.filter((f) => DICKSON_FILE_PATTERN.test(f.name))
      remainingCount += dicksonFiles.length
    }

    if (remainingCount === 0) {
      console.log('Verification passed: zero misfiles remaining')
    } else {
      console.log(`Verification WARNING: ${remainingCount} misfile(s) still found`)
    }
  } else if (misfiles.length > 0) {
    console.log('\nRun with --execute to delete these files.')
  } else {
    console.log('\nNo misfiles found. ACF is clean.')
  }

  // 6. Summary
  console.log('\n--- Summary ---')
  console.log(`  Folders scanned: ${folders.length}`)
  console.log(`  Misfiles found:  ${misfiles.length}`)
  console.log(`  Misfiles deleted: ${deletedCount}`)
  console.log(`  Mode: ${executeMode ? 'EXECUTE' : 'DRY RUN'}`)

  return {
    success: true,
    data: {
      totalFolders: folders.length,
      totalMisfiles: misfiles.length,
      misfiles,
      deletedCount,
    },
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
