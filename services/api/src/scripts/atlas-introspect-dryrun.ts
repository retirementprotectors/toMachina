/**
 * ATLAS Introspect Engine — DRY RUN
 *
 * Profiles CSV columns, samples Firestore collections, and scores column mappings.
 * NO WRITES. Read-only against Firestore.
 *
 * Usage: npx tsx services/api/src/scripts/atlas-introspect-dryrun.ts
 */

import { readFileSync } from 'fs'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  profileCsvColumns,
  profileCollection,
  matchProfiles,
} from '@tomachina/core/atlas/introspect'
import type { ColumnMapping, FieldProfile } from '@tomachina/core/atlas/types'
import { CARRIER_FORMATS, detectCarrierFormat } from '../lib/carrier-formats.js'

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ---------------------------------------------------------------------------
// CSV Parsing (no external deps)
// ---------------------------------------------------------------------------
function parseCsv(filePath: string): { headers: string[]; rows: Record<string, unknown>[] } {
  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n')
  if (lines.length === 0) return { headers: [], rows: [] }

  // Parse a CSV line handling quoted fields
  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.trim())
  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line)
    const row: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Firestore sampling
// ---------------------------------------------------------------------------

/** Sample docs from the top-level 'clients' collection */
async function sampleClients(limit: number): Promise<Record<string, unknown>[]> {
  const snap = await db.collection('clients').limit(limit).get()
  return snap.docs.map(d => d.data())
}

/**
 * Sample account docs via collectionGroup('accounts').
 * Fetch a larger batch and filter locally by account_type_category to avoid
 * needing a composite index.
 */
async function sampleAccounts(
  category: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  // Fetch a larger pool and filter locally (case-insensitive match)
  const batchSize = 2000
  const categoryLower = category.toLowerCase()
  const snap = await db
    .collectionGroup('accounts')
    .limit(batchSize)
    .get()

  const matching: Record<string, unknown>[] = []
  for (const doc of snap.docs) {
    const data = doc.data()
    const cat = (data.account_type_category as string | undefined)?.toLowerCase()
    if (cat === categoryLower) {
      matching.push(data)
      if (matching.length >= limit) break
    }
  }

  // If we didn't find enough, report what we found
  if (matching.length < limit && matching.length === 0) {
    // Try to find what categories exist
    const categories = new Set<string>()
    for (const doc of snap.docs) {
      const cat = doc.data().account_type_category as string | undefined
      if (cat) categories.add(cat)
    }
    console.log(`  Available categories in first ${snap.size} docs: ${[...categories].join(', ')}`)
  }

  return matching
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function printMappingTable(label: string, mappings: ColumnMapping[]) {
  const auto = mappings.filter(m => m.status === 'auto')
  const suggested = mappings.filter(m => m.status === 'suggested')
  const unmapped = mappings.filter(m => m.status === 'unmapped')

  console.log(`\n${'='.repeat(100)}`)
  console.log(`  ${label}`)
  console.log(`${'='.repeat(100)}`)
  console.log(`  TOTAL: ${mappings.length} columns | AUTO: ${auto.length} | SUGGESTED: ${suggested.length} | UNMAPPED: ${unmapped.length}`)
  console.log(`${'─'.repeat(100)}`)

  // Column headers
  console.log(
    '  ' +
    pad('CSV Header', 45) +
    pad('Firestore Field', 35) +
    pad('Conf', 6) +
    pad('Status', 12)
  )
  console.log(`${'─'.repeat(100)}`)

  // AUTO (90+)
  if (auto.length > 0) {
    console.log(`\n  --- AUTO-MAPPED (90+) --- [${auto.length}]`)
    for (const m of auto.sort((a, b) => b.confidence - a.confidence)) {
      console.log(
        '  ' +
        pad(m.csv_header, 45) +
        pad(m.firestore_field, 35) +
        pad(String(m.confidence), 6) +
        pad('AUTO', 12)
      )
    }
  }

  // SUGGESTED (50-89)
  if (suggested.length > 0) {
    console.log(`\n  --- SUGGESTED (50-89) --- [${suggested.length}]`)
    for (const m of suggested.sort((a, b) => b.confidence - a.confidence)) {
      const alts = m.alternatives.length > 0
        ? ` [alt: ${m.alternatives.map(a => `${a.field}(${a.confidence})`).join(', ')}]`
        : ''
      console.log(
        '  ' +
        pad(m.csv_header, 45) +
        pad(m.firestore_field, 35) +
        pad(String(m.confidence), 6) +
        pad('SUGGESTED', 12) +
        alts
      )
    }
  }

  // UNMAPPED (<50)
  if (unmapped.length > 0) {
    console.log(`\n  --- UNMAPPED (<50) --- [${unmapped.length}]`)
    for (const m of unmapped) {
      console.log(
        '  ' +
        pad(m.csv_header, 45) +
        pad('—', 35) +
        pad(String(m.confidence), 6) +
        pad('UNMAPPED', 12)
      )
    }
  }

  console.log('')
}

function printProfileSummary(label: string, profiles: Record<string, FieldProfile>) {
  const fields = Object.entries(profiles)
  console.log(`  ${label}: ${fields.length} fields profiled`)
  const typeCounts: Record<string, number> = {}
  for (const [, p] of fields) {
    typeCounts[p.dominant_type] = (typeCounts[p.dominant_type] || 0) + 1
  }
  console.log(`  Type distribution: ${JSON.stringify(typeCounts)}`)
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.substring(0, width) : s + ' '.repeat(width - s.length)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface RunConfig {
  label: string
  csvPath: string
  collectionType: 'clients' | 'accounts'
  accountCategory?: string
  sampleSize: number
}

const RUNS: RunConfig[] = [
  {
    label: '1. Humana Active Policies (PDP/MAPD) → Medicare accounts',
    csvPath: '/Users/joshd.millang/Downloads/Active Policies.csv',
    collectionType: 'accounts',
    accountCategory: 'Medicare',
    sampleSize: 50,
  },
  {
    label: '2. Aetna BoB — Millang Financial Group LLC → Medicare accounts',
    csvPath: '/Users/joshd.millang/Downloads/Millang Financial Group LLC_MedicareApprovedBOBReport_20260317.csv',
    collectionType: 'accounts',
    accountCategory: 'Medicare',
    sampleSize: 50,
  },
  {
    label: '3. Aetna BoB — Mfg Agency LLC → Medicare accounts',
    csvPath: '/Users/joshd.millang/Downloads/Mfg Agency LLC_MedicareApprovedBOBReport_20260317.csv',
    collectionType: 'accounts',
    accountCategory: 'Medicare',
    sampleSize: 50,
  },
  {
    label: '4. Aetna BoB — Mfg Advisor Network → Medicare accounts',
    csvPath: '/Users/joshd.millang/Downloads/Mfg Advisor Network_MedicareApprovedBOBReport_20260317.csv',
    collectionType: 'accounts',
    accountCategory: 'Medicare',
    sampleSize: 50,
  },
  {
    label: '5. Aetna BoB — JOSH MILLANG → Medicare accounts',
    csvPath: '/Users/joshd.millang/Downloads/JOSH MILLANG_MedicareApprovedBOBReport_20260317.csv',
    collectionType: 'accounts',
    accountCategory: 'Medicare',
    sampleSize: 50,
  },
]

async function run() {
  console.log('\n' + '█'.repeat(100))
  console.log('  ATLAS INTROSPECT ENGINE — DRY RUN')
  console.log('  Date: ' + new Date().toISOString())
  console.log('  Mode: READ-ONLY (no writes)')
  console.log('█'.repeat(100))

  for (const config of RUNS) {
    console.log(`\n${'━'.repeat(100)}`)
    console.log(`  Processing: ${config.label}`)
    console.log(`  CSV: ${config.csvPath}`)
    console.log(`${'━'.repeat(100)}`)

    // Step 1: Parse CSV and profile columns
    console.log('\n  [Step 1] Parsing CSV...')
    const { headers, rows } = parseCsv(config.csvPath)
    // Sample up to 100 rows for profiling
    const sampleRows = rows.slice(0, 100)
    console.log(`  Parsed ${rows.length} total rows, profiling ${sampleRows.length} sample rows, ${headers.length} columns`)

    const csvProfiles = profileCsvColumns(headers, sampleRows)
    printProfileSummary('CSV Profile', csvProfiles)

    // Step 1b: Carrier format detection
    console.log('\n  [Step 1b] Detecting carrier format...')
    const detectedFormat = detectCarrierFormat(headers)
    if (detectedFormat) {
      const sigMatched = detectedFormat.header_signatures.filter(sig =>
        headers.some(h => h.toLowerCase() === sig.toLowerCase())
      ).length
      console.log(`  ✓ DETECTED: ${detectedFormat.carrier_name} (${detectedFormat.carrier_id})`)
      console.log(`    Signature match: ${sigMatched}/${detectedFormat.header_signatures.length} headers`)
      console.log(`    Column map has ${Object.keys(detectedFormat.column_map).length} mappings`)
      console.log(`    Default category: ${detectedFormat.default_category}`)
      console.log(`    Dedup keys: ${detectedFormat.dedup_keys.join(', ')}`)
    } else {
      console.log('  ✗ NO FORMAT MATCH — new carrier format needed')
      console.log(`    Checked ${CARRIER_FORMATS.length} known formats, none hit 60% signature threshold`)
    }

    // Step 2: Sample Firestore docs and profile
    console.log(`\n  [Step 2] Sampling Firestore (${config.collectionType}${config.accountCategory ? ' / ' + config.accountCategory : ''})...`)
    let firestoreDocs: Record<string, unknown>[]

    if (config.collectionType === 'clients') {
      firestoreDocs = await sampleClients(config.sampleSize)
    } else {
      firestoreDocs = await sampleAccounts(config.accountCategory!, config.sampleSize)
    }
    console.log(`  Sampled ${firestoreDocs.length} Firestore docs`)

    if (firestoreDocs.length === 0) {
      console.log('  WARNING: NO DOCS FOUND — skipping matchProfiles. Check account_type_category values.')
      continue
    }

    const collProfiles = profileCollection(firestoreDocs)
    printProfileSummary('Firestore Profile', collProfiles)

    // List all Firestore fields for reference
    const firestoreFields = Object.keys(collProfiles).sort()
    console.log(`  Firestore fields (${firestoreFields.length}): ${firestoreFields.join(', ')}`)

    // Step 3: Match profiles (with carrier column maps if format was detected)
    console.log('\n  [Step 3] Running matchProfiles()...')
    const carrierMaps = detectedFormat ? [detectedFormat.column_map] : []
    if (detectedFormat) {
      console.log(`  Using column map from ${detectedFormat.carrier_name} (${Object.keys(detectedFormat.column_map).length} entries)`)
    }
    const mappings = matchProfiles(csvProfiles, collProfiles, carrierMaps)

    printMappingTable(config.label, mappings)
  }

  console.log('\n' + '█'.repeat(100))
  console.log('  ATLAS INTROSPECT DRY RUN COMPLETE')
  console.log('█'.repeat(100) + '\n')
}

run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
