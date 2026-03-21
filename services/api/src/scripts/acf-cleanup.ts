#!/usr/bin/env npx tsx
/**
 * ACF Folder Cleanup Script
 *
 * 1. Rename ACF- → ACF -  (add missing space)
 * 2. Fix double spaces in names
 * 3. Fix ALL CAPS names → Title Case
 * 4. Rename non-ACF folders to proper format
 * 5. Move loose files into correct ACF folders
 * 6. Merge duplicate folders
 *
 * Usage: npx tsx services/api/src/scripts/acf-cleanup.ts [--dry-run]
 */

import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'
const DRY_RUN = process.argv.includes('--dry-run')

// ── Auth (reuse gdrive MCP OAuth tokens) ────────────────────────────────
const keysPath = join(homedir(), '.config', 'rpi-mcp', 'gcp-oauth.keys.json')
const tokensPath = join(homedir(), '.config', 'google-drive-mcp', 'tokens.json')
const keys = JSON.parse(readFileSync(keysPath, 'utf-8'))
const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))
const oauth2 = new google.auth.OAuth2(keys.installed.client_id, keys.installed.client_secret)
oauth2.setCredentials({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  expiry_date: tokens.expiry_date,
})
const drive = google.drive({ version: 'v3', auth: oauth2 })

// ── Helpers ─────────────────────────────────────────────────────────────

async function listAllInRoot(): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const items: Array<{ id: string; name: string; mimeType: string }> = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${ACF_ROOT}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      items.push({ id: f.id!, name: f.name!, mimeType: f.mimeType! })
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)
  return items
}

async function listFilesInFolder(folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const files: Array<{ id: string; name: string; mimeType: string }> = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      files.push({ id: f.id!, name: f.name!, mimeType: f.mimeType! })
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)
  return files
}

async function renameItem(id: string, newName: string): Promise<void> {
  await drive.files.update({
    fileId: id,
    requestBody: { name: newName },
    fields: 'id',
    supportsAllDrives: true,
  })
}

async function moveItem(fileId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    fields: 'id',
    supportsAllDrives: true,
  })
}

// ── Title Case ──────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  // Preserve connectors: +, &, -, parentheticals
  return str.replace(/\b\w+/g, (word) => {
    // Don't title-case small connectors unless they're the first word
    const lower = word.toLowerCase()
    if (['and', 'of', 'the', 'in', 'for'].includes(lower)) return lower
    // Handle DCD, Legacy, etc. — keep if already mixed case
    if (word === word.toUpperCase() && word.length > 1) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }
    return word
  })
}

function fixFolderName(name: string): string {
  let fixed = name

  // 1. Non-ACF folders → add ACF prefix
  // (handled separately in specific rename map)

  // 2. ACF- → ACF -  (missing space before dash)
  fixed = fixed.replace(/^ACF-\s*/, 'ACF - ')

  // 3. Fix double/triple spaces
  fixed = fixed.replace(/\s{2,}/g, ' ')

  // 4. Fix ALL CAPS names (but preserve ACF prefix and special tokens)
  // Split into prefix + name part
  const prefixMatch = fixed.match(/^(ACF - )(.+)$/)
  if (prefixMatch) {
    const [, prefix, namePart] = prefixMatch
    // Check if name part is mostly uppercase
    const letters = namePart.replace(/[^a-zA-Z]/g, '')
    const upperCount = (letters.match(/[A-Z]/g) || []).length
    if (letters.length > 3 && upperCount / letters.length > 0.7) {
      fixed = prefix + toTitleCase(namePart)
    }
  }

  return fixed.trim()
}

// ── Specific Renames for Non-ACF folders ────────────────────────────────

const SPECIFIC_RENAMES: Record<string, string> = {
  'Craig Comstock- Ameriprise.MO': 'ACF - Craig Comstock',
  'Delores Gibson': 'ACF - Delores Gibson',
  'Donna Rempe NewBiz Docs- FINAL': 'ACF - Donna Rempe (NewBiz)',
  'PPL-2465 - Kim Cline': 'ACF - Kim Cline',
  'PPL-583 - Kay Cline': 'ACF - Kay Cline (Phil - DCD)',
}

// ── Duplicate Merge Pairs ───────────────────────────────────────────────
// [source folder name to merge FROM, target folder name to merge INTO]
const MERGE_PAIRS: Array<[string, string]> = [
  ['ACF - Beverly Gade', 'ACF - Bev Gade'],        // Beverly → Bev (keep shorter/informal)
]
// Note: "Donna Rempe NewBiz Docs- FINAL" will be checked after rename
// Note: "ACF- Kay Cline (Phil- DCD)" vs "PPL-583 - Kay Cline" — PPL will be renamed, then merged

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🧹 ACF Folder Cleanup`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}\n`)

  // Step 1: List everything
  console.log('📁 Listing all items in Active Client Files...')
  const allItems = await listAllInRoot()
  const folders = allItems.filter(i => i.mimeType === 'application/vnd.google-apps.folder')
  const looseFiles = allItems.filter(i => i.mimeType !== 'application/vnd.google-apps.folder')
  console.log(`   ${folders.length} folders, ${looseFiles.length} loose files\n`)

  // ── Phase 1: Handle loose files ────────────────────────────────────
  if (looseFiles.length > 0) {
    console.log('📄 PHASE 1: Loose files at root')
    for (const file of looseFiles) {
      // Gardner files → find or create ACF - Gerald + Nancy Gardner
      if (file.name.startsWith('Gardner_')) {
        const targetFolder = folders.find(f =>
          f.name.toLowerCase().includes('gardner')
        )
        if (targetFolder) {
          console.log(`  ↳ "${file.name}" → ${targetFolder.name}`)
          if (!DRY_RUN) await moveItem(file.id, ACF_ROOT, targetFolder.id)
        } else {
          // Create Gardner folder
          console.log(`  ↳ "${file.name}" → Creating ACF - Gerald + Nancy Gardner`)
          if (!DRY_RUN) {
            const res = await drive.files.create({
              requestBody: {
                name: 'ACF - Gerald + Nancy Gardner',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [ACF_ROOT],
              },
              fields: 'id',
              supportsAllDrives: true,
            })
            const newId = res.data.id!
            await moveItem(file.id, ACF_ROOT, newId)
            // Create lifecycle subfolders
            for (const sub of ['Client', 'Cases', 'NewBiz', 'Account', 'Reactive']) {
              await drive.files.create({
                requestBody: {
                  name: sub,
                  mimeType: 'application/vnd.google-apps.folder',
                  parents: [newId],
                },
                fields: 'id',
                supportsAllDrives: true,
              })
            }
            // Add to folders list for second file
            folders.push({ id: newId, name: 'ACF - Gerald + Nancy Gardner', mimeType: 'application/vnd.google-apps.folder' })
          }
        }
      } else {
        console.log(`  ⚠️  "${file.name}" — unknown, skipping`)
      }
    }
    console.log()
  }

  // ── Phase 2: Specific renames (non-ACF folders) ────────────────────
  console.log('📛 PHASE 2: Non-ACF folder renames')
  let specificCount = 0
  for (const folder of folders) {
    const newName = SPECIFIC_RENAMES[folder.name]
    if (newName) {
      // Check if target name already exists (would create duplicate)
      const existing = folders.find(f => f.name === newName && f.id !== folder.id)
      if (existing) {
        console.log(`  ↳ "${folder.name}" → "${newName}" (CONFLICT — will merge later)`)
      } else {
        console.log(`  ↳ "${folder.name}" → "${newName}"`)
        if (!DRY_RUN) await renameItem(folder.id, newName)
        folder.name = newName // update in-memory
      }
      specificCount++
    }
  }
  console.log(`   ${specificCount} non-ACF folders renamed\n`)

  // ── Phase 3: Bulk ACF- → ACF -  + cosmetic fixes ──────────────────
  console.log('✏️  PHASE 3: Naming standardization')
  let renameCount = 0
  const renames: Array<{ id: string; from: string; to: string }> = []

  for (const folder of folders) {
    const fixed = fixFolderName(folder.name)
    if (fixed !== folder.name) {
      renames.push({ id: folder.id, from: folder.name, to: fixed })
    }
  }

  // Check for conflicts (two folders would get the same name)
  const nameMap = new Map<string, string[]>()
  for (const folder of folders) {
    const fixed = fixFolderName(folder.name)
    const arr = nameMap.get(fixed) || []
    arr.push(folder.id)
    nameMap.set(fixed, arr)
  }

  for (const r of renames) {
    const conflictIds = nameMap.get(r.to) || []
    const isConflict = conflictIds.length > 1
    const tag = isConflict ? ' ⚠️ CONFLICT' : ''
    console.log(`  ↳ "${r.from}" → "${r.to}"${tag}`)
    if (!DRY_RUN && !isConflict) {
      await renameItem(r.id, r.to)
      renameCount++
    } else if (!DRY_RUN && isConflict) {
      // Still rename, merge will handle later
      await renameItem(r.id, r.to)
      renameCount++
    }
  }
  console.log(`   ${DRY_RUN ? renames.length + ' would be renamed' : renameCount + ' renamed'}\n`)

  // ── Phase 4: Merge duplicate folders ───────────────────────────────
  // Re-list to get updated names
  console.log('🔀 PHASE 4: Merge duplicates')

  // After renames, find folders with identical names
  const updatedItems = DRY_RUN ? folders : await listAllInRoot().then(items =>
    items.filter(i => i.mimeType === 'application/vnd.google-apps.folder')
  )

  const dupeMap = new Map<string, Array<{ id: string; name: string }>>()
  for (const f of updatedItems) {
    const normalized = f.name.toLowerCase().trim()
    const arr = dupeMap.get(normalized) || []
    arr.push(f)
    dupeMap.set(normalized, arr)
  }

  let mergeCount = 0
  for (const [, group] of dupeMap) {
    if (group.length <= 1) continue

    // Keep the first one, merge others into it
    const target = group[0]
    console.log(`  📂 Keeping: "${target.name}" (${target.id})`)

    for (let i = 1; i < group.length; i++) {
      const source = group[i]
      console.log(`  ↳ Merging: "${source.name}" (${source.id}) → into target`)

      if (!DRY_RUN) {
        // Move all contents from source to target
        const contents = await listFilesInFolder(source.id)
        for (const item of contents) {
          console.log(`     📄 Moving "${item.name}"`)
          await moveItem(item.id, source.id, target.id)
        }
        // Delete empty source folder
        if (contents.length === 0 || (await listFilesInFolder(source.id)).length === 0) {
          await drive.files.update({
            fileId: source.id,
            requestBody: { trashed: true },
            supportsAllDrives: true,
          })
          console.log(`     🗑️  Trashed empty source folder`)
        }
      }
      mergeCount++
    }
  }

  // Also handle the specific merge pairs (different names)
  for (const [sourceName, targetName] of MERGE_PAIRS) {
    const sourceFolder = updatedItems.find(f => f.name === sourceName)
    const targetFolder = updatedItems.find(f => f.name === targetName)
    if (sourceFolder && targetFolder) {
      console.log(`  📂 Merging "${sourceName}" → "${targetName}"`)
      if (!DRY_RUN) {
        const contents = await listFilesInFolder(sourceFolder.id)
        for (const item of contents) {
          console.log(`     📄 Moving "${item.name}"`)
          await moveItem(item.id, sourceFolder.id, targetFolder.id)
        }
        if ((await listFilesInFolder(sourceFolder.id)).length === 0) {
          await drive.files.update({
            fileId: sourceFolder.id,
            requestBody: { trashed: true },
            supportsAllDrives: true,
          })
          console.log(`     🗑️  Trashed empty source folder`)
        }
      }
      mergeCount++
    }
  }

  console.log(`   ${mergeCount} folders merged\n`)

  // ── Summary ────────────────────────────────────────────────────────
  console.log('═'.repeat(60))
  console.log('📊 CLEANUP SUMMARY')
  console.log('═'.repeat(60))
  console.log(`   Loose files handled:  ${looseFiles.length}`)
  console.log(`   Non-ACF renames:      ${specificCount}`)
  console.log(`   Cosmetic renames:     ${renames.length}`)
  console.log(`   Duplicates merged:    ${mergeCount}`)
  console.log('═'.repeat(60))
  if (DRY_RUN) console.log('\n💡 Run without --dry-run to execute.\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
