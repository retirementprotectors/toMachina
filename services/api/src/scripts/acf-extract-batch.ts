/**
 * ACF Batch SUPER_EXTRACT — Vision Mode (TRK-13605)
 *
 * Inventories all files across 277 ACF client folders (5 subfolders each:
 * Client, Cases, NewBiz, Account, Reactive), then runs Claude Vision
 * extraction on extractable documents and stores results in Firestore.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/acf-extract-batch.ts              # Dry run (inventory only)
 *   npx tsx services/api/src/scripts/acf-extract-batch.ts --commit     # Process + store in Firestore
 *   npx tsx services/api/src/scripts/acf-extract-batch.ts --commit --resume   # Resume from checkpoint
 *
 * Requires:
 *   ANTHROPIC_API_KEY env var (or set in ~/Projects/services/MCP-Hub/.env)
 *   GOOGLE_APPLICATION_CREDENTIALS or ADC for Drive + Firestore
 */

import { google, type drive_v3 } from 'googleapis'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { executeVision, type VisionExtractInput, type VisionExtractOutput } from '../../../../packages/core/src/atlas/super-tools/extract'
import { pdf } from 'pdf-to-img'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load API key from MCP-Hub .env
dotenv.config({ path: path.join(process.env.HOME || '', 'Projects/services/MCP-Hub/.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.anthropic') })

// ── Configuration ──

const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'
const SUBFOLDER_NAMES = ['Client', 'Cases', 'NewBiz', 'Account', 'Reactive']
const TMP_DIR = '/tmp/acf-extract'
const CHUNK_SIZE = 10
const CHECKPOINT_COLLECTION = '_checkpoints'
const CHECKPOINT_DOC = 'acf-extract-batch'
const EXTRACTION_COLLECTION = 'extractions'
const MAX_PAGES_PER_PDF = 25
const COST_PER_PAGE_LOW = 0.01
const COST_PER_PAGE_HIGH = 0.03

// Mime types we can extract from
const EXTRACTABLE_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/webp',
  'image/gif',
])
const PDF_MIME = 'application/pdf'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

// Skip these entirely
const SKIP_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz'])

// ── Types ──

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  parentFolderName: string
  acfFolderName: string
  subfolder: string
}

interface InventoryStats {
  totalFiles: number
  extractableFiles: number
  alreadyExtracted: number
  skippedFolders: number
  skippedZeroBytes: number
  skippedZips: number
  skippedOtherTypes: number
  byAcfFolder: Record<string, number>
  bySubfolder: Record<string, number>
  estimatedPages: number
  estimatedCostLow: number
  estimatedCostHigh: number
}

interface Checkpoint {
  lastProcessedIndex: number
  totalFiles: number
  updatedAt: string
}

// ── CLI Args ──

const commitMode = process.argv.includes('--commit')
const resumeMode = process.argv.includes('--resume')

// ── Drive Helpers ──

async function listAllItems(
  drive: drive_v3.Drive,
  folderId: string,
  options?: { foldersOnly?: boolean }
): Promise<Array<{ id: string; name: string; mimeType: string; size: number }>> {
  const items: Array<{ id: string; name: string; mimeType: string; size: number }> = []
  let pageToken: string | undefined
  const mimeFilter = options?.foldersOnly
    ? " and mimeType = 'application/vnd.google-apps.folder'"
    : ''

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false${mimeFilter}`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = res.data.files || []
    for (const f of files) {
      if (f.id && f.name) {
        items.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType || 'unknown',
          size: parseInt(String(f.size || '0'), 10),
        })
      }
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return items
}

async function downloadFile(
  drive: drive_v3.Drive,
  fileId: string,
  destPath: string
): Promise<void> {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(res.data as any)
      .on('end', () => {
        dest.end()
        resolve()
      })
      .on('error', (err: Error) => reject(err))
      .pipe(dest)
  })
}

// ── PDF → Images ──

async function pdfToImageFiles(pdfPath: string, outputDir: string): Promise<string[]> {
  const buffer = fs.readFileSync(pdfPath)
  const imagePaths: string[] = []
  let pageNum = 0

  const document = await pdf(buffer, { scale: 2.0 })
  for await (const page of document) {
    pageNum++
    if (pageNum > MAX_PAGES_PER_PDF) break
    const imgPath = path.join(outputDir, `page-${pageNum}.png`)
    fs.writeFileSync(imgPath, Buffer.from(page))
    imagePaths.push(imgPath)
  }

  return imagePaths
}

// ── Inventory ──

async function buildInventory(
  drive: drive_v3.Drive,
  db: Firestore
): Promise<{ files: DriveFile[]; stats: InventoryStats }> {
  console.log(`Scanning ACF root: ${ACF_ROOT}`)

  // 1. List all top-level ACF client folders
  const acfFolders = await listAllItems(drive, ACF_ROOT, { foldersOnly: true })
  console.log(`Found ${acfFolders.length} ACF client folders`)

  // 2. Load already-extracted file IDs from Firestore
  console.log('Loading already-extracted file IDs from Firestore...')
  const extractedIds = new Set<string>()
  const extractionSnap = await db.collection(EXTRACTION_COLLECTION).select('file_id').get()
  extractionSnap.docs.forEach((doc) => {
    const fileId = doc.data().file_id
    if (fileId) extractedIds.add(fileId)
  })
  console.log(`Already extracted: ${extractedIds.size} files`)

  // 3. Scan each ACF folder's subfolders
  const allFiles: DriveFile[] = []
  const stats: InventoryStats = {
    totalFiles: 0,
    extractableFiles: 0,
    alreadyExtracted: 0,
    skippedFolders: 0,
    skippedZeroBytes: 0,
    skippedZips: 0,
    skippedOtherTypes: 0,
    byAcfFolder: {},
    bySubfolder: {},
    estimatedPages: 0,
    estimatedCostLow: 0,
    estimatedCostHigh: 0,
  }

  for (let fi = 0; fi < acfFolders.length; fi++) {
    const acfFolder = acfFolders[fi]
    if ((fi + 1) % 25 === 0) {
      console.log(`  Scanning ACF folder ${fi + 1}/${acfFolders.length}: ${acfFolder.name}`)
    }

    // List subfolders of this ACF folder
    const subfolders = await listAllItems(drive, acfFolder.id, { foldersOnly: true })

    for (const subfolder of subfolders) {
      // Only process known subfolder names
      if (!SUBFOLDER_NAMES.includes(subfolder.name)) continue

      // List all files in this subfolder
      const files = await listAllItems(drive, subfolder.id)

      for (const file of files) {
        stats.totalFiles++

        // Skip folders
        if (file.mimeType.includes('folder')) {
          stats.skippedFolders++
          continue
        }

        // Skip zero-byte files
        if (file.size === 0) {
          stats.skippedZeroBytes++
          continue
        }

        // Skip zip/archive files
        const ext = path.extname(file.name).toLowerCase()
        if (SKIP_EXTENSIONS.has(ext)) {
          stats.skippedZips++
          continue
        }

        // Skip already extracted
        if (extractedIds.has(file.id)) {
          stats.alreadyExtracted++
          continue
        }

        // Check if extractable (image or PDF)
        const isImage = EXTRACTABLE_IMAGE_TYPES.has(file.mimeType)
        const isPdf = file.mimeType === PDF_MIME
        if (!isImage && !isPdf) {
          stats.skippedOtherTypes++
          continue
        }

        // This file is extractable
        const driveFile: DriveFile = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          parentFolderName: `${acfFolder.name}/${subfolder.name}`,
          acfFolderName: acfFolder.name,
          subfolder: subfolder.name,
        }

        allFiles.push(driveFile)
        stats.extractableFiles++
        stats.byAcfFolder[acfFolder.name] = (stats.byAcfFolder[acfFolder.name] || 0) + 1
        stats.bySubfolder[subfolder.name] = (stats.bySubfolder[subfolder.name] || 0) + 1

        // Estimate pages (PDFs ~3 pages avg, images = 1 page)
        const estPages = isPdf ? 3 : 1
        stats.estimatedPages += estPages
      }
    }
  }

  stats.estimatedCostLow = stats.estimatedPages * COST_PER_PAGE_LOW
  stats.estimatedCostHigh = stats.estimatedPages * COST_PER_PAGE_HIGH

  return { files: allFiles, stats }
}

// ── Extraction ──

async function extractSingleFile(
  drive: drive_v3.Drive,
  file: DriveFile,
  tmpDir: string
): Promise<{ success: boolean; data?: VisionExtractOutput; error?: string; pages?: number }> {
  const fileDir = path.join(tmpDir, file.id)
  fs.mkdirSync(fileDir, { recursive: true })

  try {
    const ext = path.extname(file.name).toLowerCase()
    let imagePaths: string[]

    if (file.mimeType === PDF_MIME) {
      // Download PDF, convert to page images
      const pdfPath = path.join(fileDir, file.name)
      await downloadFile(drive, file.id, pdfPath)
      imagePaths = await pdfToImageFiles(pdfPath, fileDir)
    } else {
      // Image file — download directly
      const imgPath = path.join(fileDir, file.name)
      await downloadFile(drive, file.id, imgPath)
      imagePaths = [imgPath]
    }

    if (imagePaths.length === 0) {
      return { success: false, error: 'No page images produced' }
    }

    // Call SUPER_EXTRACT vision mode
    const input: VisionExtractInput = {
      mode: 'vision',
      image_paths: imagePaths,
      context: {
        fileName: file.name,
      },
    }

    const result = await executeVision(input)

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'No data returned' }
    }

    return { success: true, data: result.data, pages: imagePaths.length }
  } finally {
    // Clean up temp files for this file
    try {
      fs.rmSync(fileDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function processFiles(
  drive: drive_v3.Drive,
  db: Firestore,
  files: DriveFile[],
  startIndex: number
): Promise<void> {
  console.log(`\nProcessing ${files.length - startIndex} files (starting at index ${startIndex})...`)

  let processed = startIndex
  let successCount = 0
  let failCount = 0
  let totalAccounts = 0
  let totalClients = 0

  // Process in chunks
  for (let i = startIndex; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, Math.min(i + CHUNK_SIZE, files.length))
    const chunkEnd = Math.min(i + CHUNK_SIZE, files.length)

    console.log(`\n--- Chunk ${Math.floor(i / CHUNK_SIZE) + 1} (files ${i + 1}-${chunkEnd} of ${files.length}) ---`)

    // Process files in this chunk sequentially to manage memory/API rate limits
    const firestoreBatch = db.batch()
    let batchCount = 0

    for (const file of chunk) {
      processed++
      const label = `[${processed}/${files.length}]`

      try {
        const result = await extractSingleFile(drive, file, TMP_DIR)

        if (result.success && result.data) {
          // Count accounts
          const accounts = result.data.accounts || {}
          const accountCount = Object.values(accounts).reduce(
            (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
            0
          )
          totalAccounts += accountCount

          // Count client extractions
          const client = result.data.client || {}
          const clientName = [
            (client as Record<string, unknown>).first_name,
            (client as Record<string, unknown>).last_name,
          ]
            .filter(Boolean)
            .join(' ')
          if (clientName) totalClients++

          const confidence = result.data.confidence as Record<string, unknown> | undefined
          const confLevel = confidence?.client_info || 'unknown'

          console.log(
            `${label} Extracted: ${file.name} → client: ${clientName || 'unknown'}, ${accountCount} accounts, confidence: ${confLevel}`
          )

          // Store in Firestore
          const docRef = db.collection(EXTRACTION_COLLECTION).doc()
          firestoreBatch.set(docRef, {
            file_id: file.id,
            file_name: file.name,
            acf_folder: file.acfFolderName,
            subfolder: file.subfolder,
            parent_path: file.parentFolderName,
            mime_type: file.mimeType,
            client_data: result.data.client || {},
            accounts_data: result.data.accounts || {},
            mail_metadata: result.data.mail_metadata || null,
            confidence: result.data.confidence || {},
            pages_processed: result.pages || 1,
            extracted_at: new Date().toISOString(),
            model: 'claude-sonnet-4-20250514',
          })
          batchCount++
          successCount++
        } else {
          console.log(`${label} FAILED: ${file.name} — ${result.error}`)
          failCount++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`${label} ERROR: ${file.name} — ${msg}`)
        failCount++
      }
    }

    // Commit Firestore batch for this chunk
    if (batchCount > 0) {
      await firestoreBatch.commit()
      console.log(`  Firestore: committed ${batchCount} extraction docs`)
    }

    // Save checkpoint
    await db
      .collection(CHECKPOINT_COLLECTION)
      .doc(CHECKPOINT_DOC)
      .set({
        lastProcessedIndex: chunkEnd - 1,
        totalFiles: files.length,
        updatedAt: new Date().toISOString(),
      } satisfies Checkpoint)
    console.log(`  Checkpoint saved: index ${chunkEnd - 1}`)
  }

  // ── Summary ──
  console.log('\n══════════════════════════════════════════')
  console.log('  EXTRACTION COMPLETE')
  console.log('══════════════════════════════════════════')
  console.log(`  Total processed:    ${processed}`)
  console.log(`  Successful:         ${successCount}`)
  console.log(`  Failed:             ${failCount}`)
  console.log(`  Client profiles:    ${totalClients}`)
  console.log(`  Accounts found:     ${totalAccounts}`)
  console.log(
    `  Estimated cost:     $${(successCount * 0.02).toFixed(2)} (avg $0.02/file)`
  )
  console.log('══════════════════════════════════════════')
}

// ── Main ──

async function main(): Promise<void> {
  console.log('\n=== ACF Batch SUPER_EXTRACT (TRK-13605) ===\n')
  console.log(`Mode: ${commitMode ? 'COMMIT (will extract + write to Firestore)' : 'DRY RUN (inventory only)'}`)
  if (resumeMode) console.log('Resume: ON — will skip already-processed files')
  console.log()

  // Check for API key early (only needed in commit mode)
  if (commitMode) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ERROR: ANTHROPIC_API_KEY is required for --commit mode.')
      console.error('Set it via: export ANTHROPIC_API_KEY=sk-...')
      console.error('Or add to ~/Projects/services/MCP-Hub/.env')
      process.exit(1)
    }
  }

  // Init Firebase
  if (getApps().length === 0) {
    initializeApp({ projectId: 'claude-mcp-484718' })
  }
  const db = getFirestore()

  // Init Drive
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const drive = google.drive({ version: 'v3', auth })

  // Build inventory
  const { files, stats } = await buildInventory(drive, db)

  // Print inventory report
  console.log('\n══════════════════════════════════════════')
  console.log('  INVENTORY REPORT')
  console.log('══════════════════════════════════════════')
  console.log(`  Total files scanned:     ${stats.totalFiles}`)
  console.log(`  Extractable files:       ${stats.extractableFiles}`)
  console.log(`  Already extracted:       ${stats.alreadyExtracted}`)
  console.log(`  Skipped (folders):       ${stats.skippedFolders}`)
  console.log(`  Skipped (zero-byte):     ${stats.skippedZeroBytes}`)
  console.log(`  Skipped (zip/archive):   ${stats.skippedZips}`)
  console.log(`  Skipped (unsupported):   ${stats.skippedOtherTypes}`)
  console.log(`  Estimated pages:         ${stats.estimatedPages}`)
  console.log(
    `  Estimated cost:          $${stats.estimatedCostLow.toFixed(2)} - $${stats.estimatedCostHigh.toFixed(2)}`
  )
  console.log()

  // Files per subfolder
  console.log('  By subfolder:')
  for (const [sub, count] of Object.entries(stats.bySubfolder).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${sub.padEnd(12)} ${count}`)
  }
  console.log()

  // Top 20 ACF folders by file count
  const sortedAcf = Object.entries(stats.byAcfFolder).sort((a, b) => b[1] - a[1])
  console.log(`  Top ${Math.min(20, sortedAcf.length)} ACF folders by file count:`)
  for (const [folder, count] of sortedAcf.slice(0, 20)) {
    console.log(`    ${folder.padEnd(35)} ${count}`)
  }
  console.log('══════════════════════════════════════════')

  if (!commitMode) {
    console.log('\nDry run complete. Pass --commit to extract and store in Firestore.')
    return
  }

  // Determine start index
  let startIndex = 0
  if (resumeMode) {
    try {
      const checkpointDoc = await db
        .collection(CHECKPOINT_COLLECTION)
        .doc(CHECKPOINT_DOC)
        .get()
      if (checkpointDoc.exists) {
        const cp = checkpointDoc.data() as Checkpoint
        startIndex = cp.lastProcessedIndex + 1
        console.log(
          `\nResuming from checkpoint: index ${startIndex} (last processed: ${cp.lastProcessedIndex}, updated: ${cp.updatedAt})`
        )
      } else {
        console.log('\nNo checkpoint found — starting from beginning.')
      }
    } catch {
      console.log('\nCheckpoint read failed — starting from beginning.')
    }
  }

  if (startIndex >= files.length) {
    console.log('\nAll files already processed. Nothing to do.')
    return
  }

  // Ensure tmp directory exists
  fs.mkdirSync(TMP_DIR, { recursive: true })

  // Process
  await processFiles(drive, db, files, startIndex)

  // Clean up tmp dir
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true })
  } catch {
    // Ignore
  }

  console.log('\n=== Done ===\n')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
