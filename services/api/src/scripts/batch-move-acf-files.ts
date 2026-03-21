#!/usr/bin/env npx tsx
/**
 * Batch ACF File Mover — TRK-454
 *
 * Scans ALL ACF folders in Active Client Files, classifies root-level files
 * by filename pattern, and moves them to the correct lifecycle subfolder.
 *
 * Lifecycle subfolders: Client, Cases, NewBiz, Account, Reactive
 *
 * Usage: npx tsx services/api/src/scripts/batch-move-acf-files.ts [--dry-run]
 */

import { google, type drive_v3 } from 'googleapis'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ── Config ──────────────────────────────────────────────────────────────
const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m' // Active Client Files root
const CONCURRENCY = 10 // folders processed in parallel
const DRY_RUN = process.argv.includes('--dry-run')

// ── Drive Client (OAuth from gdrive MCP tokens) ────────────────────────
function getDriveClient(): drive_v3.Drive {
  const keysPath = join(homedir(), '.config', 'rpi-mcp', 'gcp-oauth.keys.json')
  const tokensPath = join(homedir(), '.config', 'google-drive-mcp', 'tokens.json')

  const keys = JSON.parse(readFileSync(keysPath, 'utf-8'))
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))
  const { client_id, client_secret } = keys.installed

  const oauth2 = new google.auth.OAuth2(client_id, client_secret)
  oauth2.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  })

  return google.drive({ version: 'v3', auth: oauth2 })
}

const drive = getDriveClient()

// ── Classification Rules ────────────────────────────────────────────────
// Each rule: [subfolder, test function]
type ClassifyRule = [string, (name: string) => boolean]

const RULES: ClassifyRule[] = [
  // CLIENT — static person docs
  ['Client', (n) => /\b(driver.?s?\s*licen|DL\b|photo\s*id|state\s*id)/i.test(n)],
  ['Client', (n) => /\b(void|voided)\s*(check|cheque)/i.test(n)],
  ['Client', (n) => /\b(social\s*security|ss\s*card|ssn\s*card)/i.test(n)],
  ['Client', (n) => /\b(medicare\s*(card|id)|cms\s*card)/i.test(n)],
  ['Client', (n) => /\bAi3\b/i.test(n) && !/template/i.test(n)],
  ['Client', (n) => /\b(fact\s*find|ff\b|client\s*profile|intake\s*form|discovery\s*form)/i.test(n)],
  ['Client', (n) => /\b(power\s*of\s*attorney|poa\b|hipaa\s*auth|authorization\s*form)/i.test(n)],
  ['Client', (n) => /\b(trust\s*(agreement|document|cert)|will\b|estate\s*plan)/i.test(n)],
  ['Client', (n) => /\b(beneficiary\s*(design|form)|bene\s*form)/i.test(n)],
  ['Client', (n) => /\b(tax\s*return|1040|w-?2\b|1099)/i.test(n)],
  ['Client', (n) => /\b(birth\s*cert|passport|marriage\s*cert)/i.test(n)],

  // NEWBIZ — opportunity becomes sale
  ['NewBiz', (n) => /\b(application|app\b.*signed|new\s*business)/i.test(n) && !/template/i.test(n)],
  ['NewBiz', (n) => /\b1035\s*(exchange)?/i.test(n)],
  ['NewBiz', (n) => /\b(transfer|toa|acat)\b/i.test(n) && !/statement/i.test(n)],
  ['NewBiz', (n) => /\b(delivery\s*receipt|policy\s*delivery|contract\s*delivery)/i.test(n)],
  ['NewBiz', (n) => /\b(replacement|replace\s*form)/i.test(n)],
  ['NewBiz', (n) => /\b(suitability|best\s*interest|reg\s*bi)/i.test(n)],
  ['NewBiz', (n) => /\b(enrollment|enroll)\b/i.test(n) && !/aep|oep/i.test(n)],
  ['NewBiz', (n) => /\b(signed|executed|wet\s*sign)/i.test(n) && !/statement/i.test(n)],

  // CASES — sales pipeline / proactive service opportunities
  ['Cases', (n) => /\b(comparison|compare|side.by.side)/i.test(n)],
  ['Cases', (n) => /\b(illustration|ledger|projec)/i.test(n)],
  ['Cases', (n) => /\b(analysis|review\s*report|assessment)/i.test(n) && !/annual/i.test(n)],
  ['Cases', (n) => /\b(quote|proposal|recommend)/i.test(n)],
  ['Cases', (n) => /\b(discovery\s*meeting|meeting\s*notes|meeting\s*kit)/i.test(n)],
  ['Cases', (n) => /\b(pro\s*pipeline|proactive|opportunity)/i.test(n)],
  ['Cases', (n) => /\b(rmd\s*(review|analysis|calc))/i.test(n)],

  // ACCOUNT — live active account docs
  ['Account', (n) => /\b(statement|confirm|contract\s*page|policy\s*page)/i.test(n) && !/delivery/i.test(n)],
  ['Account', (n) => /\b(annual\s*review|review\s*meeting|service\s*review)/i.test(n)],
  ['Account', (n) => /\b(account\s*summary|position|holdings|balance)/i.test(n)],
  ['Account', (n) => /\b(performance|allocation|rebalance)/i.test(n)],
  ['Account', (n) => /\b(distribution|withdraw|disbursement|rmd\s*(?!review|analysis|calc))/i.test(n)],
  ['Account', (n) => /\b(correspondence|letter|notice)\b/i.test(n) && !/claim/i.test(n)],

  // REACTIVE — post-account service actions (catch-more)
  ['Reactive', (n) => /\b(claim|death\s*cert|beneficiary\s*claim)/i.test(n)],
  ['Reactive', (n) => /\b(complaint|grievance|escalat)/i.test(n)],
  ['Reactive', (n) => /\b(service\s*request|change\s*form|address\s*change|name\s*change)/i.test(n)],
  ['Reactive', (n) => /\b(surrender|cancel|lapse|reinstate)/i.test(n)],
  ['Reactive', (n) => /\b(loan|policy\s*loan|collateral)/i.test(n)],
]

function classifyFile(fileName: string): string {
  const lower = fileName.toLowerCase()
  for (const [subfolder, test] of RULES) {
    if (test(lower)) return subfolder
  }
  // Default: Reactive (catch-all for unclassified)
  return 'Reactive'
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function listAllACFFolders(): Promise<Array<{ id: string; name: string }>> {
  const folders: Array<{ id: string; name: string }> = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${ACF_ROOT}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      folders.push({ id: f.id!, name: f.name! })
    }
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return folders
}

async function listRootFiles(folderId: string): Promise<drive_v3.Schema$File[]> {
  const files: drive_v3.Schema$File[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'nextPageToken, files(id, name, parents)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    files.push(...(res.data.files || []))
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return files
}

async function listSubfolders(folderId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  for (const f of res.data.files || []) {
    map.set(f.name!, f.id!)
  }
  return map
}

async function moveFile(fileId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    fields: 'id',
    supportsAllDrives: true,
  })
}

// ── Process One Folder ──────────────────────────────────────────────────

interface MoveResult {
  folder: string
  file: string
  target: string
  status: 'moved' | 'skipped' | 'error'
  error?: string
}

async function processFolder(folder: { id: string; name: string }): Promise<MoveResult[]> {
  const results: MoveResult[] = []

  try {
    // Get root files and subfolders in parallel
    const [rootFiles, subfolders] = await Promise.all([
      listRootFiles(folder.id),
      listSubfolders(folder.id),
    ])

    if (rootFiles.length === 0) return results

    // Skip template files (Ai3 TEMPLATE, CLIENT FACING, etc.)
    const TEMPLATE_NAMES = ['ai3 template', 'client facing', 'accounts', 'opportunities', 'discovery meeting kit']
    const filesToMove = rootFiles.filter(f => {
      const lower = (f.name || '').toLowerCase().trim()
      return !TEMPLATE_NAMES.some(t => lower === t || lower.startsWith(t + ' -'))
    })

    if (filesToMove.length === 0) return results

    for (const file of filesToMove) {
      const target = classifyFile(file.name!)
      const targetFolderId = subfolders.get(target)

      if (!targetFolderId) {
        // Auto-create missing subfolder
        if (!DRY_RUN) {
          try {
            const created = await drive.files.create({
              requestBody: {
                name: target,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [folder.id],
              },
              fields: 'id',
              supportsAllDrives: true,
            })
            subfolders.set(target, created.data.id!)
            console.log(`   📂 Created missing "${target}" subfolder in ${folder.name}`)
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            results.push({
              folder: folder.name,
              file: file.name!,
              target,
              status: 'error',
              error: `Failed to create "${target}" subfolder: ${msg}`,
            })
            continue
          }
        } else {
          results.push({
            folder: folder.name,
            file: file.name!,
            target,
            status: 'skipped',
            error: `(would create "${target}" subfolder)`,
          })
          continue
        }
      }
      const resolvedFolderId = subfolders.get(target)!

      if (DRY_RUN) {
        results.push({ folder: folder.name, file: file.name!, target, status: 'skipped' })
        continue
      }

      try {
        await moveFile(file.id!, folder.id, resolvedFolderId)
        results.push({ folder: folder.name, file: file.name!, target, status: 'moved' })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ folder: folder.name, file: file.name!, target, status: 'error', error: msg })
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ folder: folder.name, file: '(folder scan)', target: '-', status: 'error', error: msg })
  }

  return results
}

// ── Parallel Batch Processor ────────────────────────────────────────────

async function processBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 ACF Batch File Mover — TRK-454`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no moves)' : '⚡ LIVE — moving files'}`)
  console.log(`   Concurrency: ${CONCURRENCY} folders at a time\n`)

  // Step 1: List all ACF folders
  console.log('📁 Listing all ACF folders...')
  const folders = await listAllACFFolders()
  console.log(`   Found ${folders.length} folders\n`)

  // Step 2: Process in parallel batches
  console.log(`🔄 Processing folders (${CONCURRENCY} concurrent)...\n`)

  const allResults = await processBatch(folders, CONCURRENCY, async (folder) => {
    const results = await processFolder(folder)
    if (results.length > 0) {
      const moved = results.filter(r => r.status === 'moved').length
      const skipped = results.filter(r => r.status === 'skipped').length
      const errors = results.filter(r => r.status === 'error').length
      const tag = DRY_RUN ? '🔍' : '✅'
      console.log(`${tag} ${folder.name}: ${results.length} files → ${moved} moved, ${skipped} dry-run, ${errors} errors`)
      for (const r of results) {
        const icon = r.status === 'moved' ? '  ↳ ✅' : r.status === 'skipped' ? '  ↳ 🔍' : '  ↳ ❌'
        console.log(`${icon} "${r.file}" → ${r.target}${r.error ? ` (${r.error})` : ''}`)
      }
    }
    return results
  })

  // Step 3: Summary
  const flat = allResults.flat()
  const moved = flat.filter(r => r.status === 'moved').length
  const skipped = flat.filter(r => r.status === 'skipped').length
  const errors = flat.filter(r => r.status === 'error').length
  const foldersWithFiles = allResults.filter(r => r.length > 0).length

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📊 SUMMARY`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`   Folders scanned:    ${folders.length}`)
  console.log(`   Folders with files: ${foldersWithFiles}`)
  console.log(`   Files moved:        ${moved}`)
  console.log(`   Files dry-run:      ${skipped}`)
  console.log(`   Errors:             ${errors}`)
  console.log(`${'═'.repeat(60)}\n`)

  if (errors > 0) {
    console.log('❌ ERRORS:')
    for (const r of flat.filter(r => r.status === 'error')) {
      console.log(`   ${r.folder} / "${r.file}" → ${r.error}`)
    }
    console.log()
  }

  if (DRY_RUN && skipped > 0) {
    console.log('💡 Run without --dry-run to execute moves.\n')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
