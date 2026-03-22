#!/usr/bin/env npx tsx
/**
 * ACF Client Enrichment Pipeline — TRK-13606
 *
 * 3-phase enrichment:
 *   Phase 1: Backfill client fields from PDF extractions
 *   Phase 2: WhitePages enrichment manifest (MCP-driven, generates manifest only)
 *   Phase 3: SUPER_NORMALIZE on all modified records
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts                   # All phases, dry run
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts --phase1          # Phase 1 only, dry run
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts --phase2          # Phase 2 only, dry run
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts --phase3          # Phase 3 only, dry run
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts --commit          # All phases, LIVE
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts --phase1 --commit # Phase 1 only, LIVE
 *   npx tsx services/api/src/scripts/acf-enrich-clients.ts --commit-all      # All phases, LIVE (alias)
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import {
  normalizeName,
  normalizePhone,
  normalizeState,
  normalizeZip,
  normalizeDate,
  normalizeEmail,
  normalizeCity,
  normalizeAddress,
} from '../../../../packages/core/src/normalizers/index.js'

// ── Firebase Init ────────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ── CLI Flags ────────────────────────────────────────────────────────────────

const COMMIT = process.argv.includes('--commit') || process.argv.includes('--commit-all')
const PHASE1 = process.argv.includes('--phase1')
const PHASE2 = process.argv.includes('--phase2')
const PHASE3 = process.argv.includes('--phase3')
const RUN_ALL = !PHASE1 && !PHASE2 && !PHASE3 // no phase flag = run all

const ENRICHMENT_DIR = join(homedir(), 'Projects/toMachina/.claude/acf-data-hygiene-enrichment')

// ── Types ────────────────────────────────────────────────────────────────────

interface ExtractionDoc {
  id: string
  client_data?: Record<string, unknown>
  source_file?: string
  acf_folder_id?: string
  acf_folder_name?: string
  client_id?: string
  matched_client_id?: string
  [key: string]: unknown
}

interface BackfillProposal {
  client_id: string
  client_name: string
  field: string
  proposed_value: unknown
  extraction_source: string
  extraction_id: string
}

interface WhitePagesCandidate {
  client_id: string
  first_name: string
  last_name: string
  missing_fields: string[]
  existing_data: Record<string, string>
}

// ── Enrichment fields we care about ──────────────────────────────────────────

const ENRICHMENT_FIELDS = [
  'dob', 'ssn_last4', 'email', 'phone', 'address', 'city', 'state', 'zip',
  'medicare_number', 'spouse_name',
] as const

type EnrichmentField = typeof ENRICHMENT_FIELDS[number]

// ── Helpers ──────────────────────────────────────────────────────────────────

function isBlank(val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (typeof val === 'string' && val.trim() === '') return true
  return false
}

function extractClientName(data: Record<string, unknown>): string {
  const first = String(data.first_name || '').trim()
  const last = String(data.last_name || '').trim()
  return `${first} ${last}`.trim() || '(unknown)'
}

// ============================================================================
// PHASE 1: Backfill from Extractions
// ============================================================================

async function phase1(): Promise<{ proposals: BackfillProposal[]; modifiedClientIds: Set<string> }> {
  console.log('\n' + '='.repeat(70))
  console.log(`  PHASE 1: Backfill from Extractions ${COMMIT ? '(LIVE)' : '(DRY RUN)'}`)
  console.log('='.repeat(70) + '\n')

  const proposals: BackfillProposal[] = []
  const modifiedClientIds = new Set<string>()

  // 1. Read all extractions
  const extractionSnap = await db.collection('extractions').get()
  console.log(`  Loaded ${extractionSnap.size} extraction documents`)

  if (extractionSnap.empty) {
    console.log('  No extractions found. Phase 1 complete.\n')
    return { proposals, modifiedClientIds }
  }

  // 2. Build extraction list with client_data
  const extractions: ExtractionDoc[] = []
  for (const doc of extractionSnap.docs) {
    const data = doc.data()
    if (data.client_data && typeof data.client_data === 'object') {
      extractions.push({ id: doc.id, ...data } as ExtractionDoc)
    }
  }
  console.log(`  ${extractions.length} extractions have client_data\n`)

  if (extractions.length === 0) {
    console.log('  No extractions with client_data. Phase 1 complete.\n')
    return { proposals, modifiedClientIds }
  }

  // 3. Resolve client IDs from extractions
  // Extraction may have client_id or matched_client_id directly, or we match by ACF folder name
  const clientCache = new Map<string, Record<string, unknown>>()

  for (const extraction of extractions) {
    const clientId = extraction.matched_client_id || extraction.client_id
    if (!clientId) {
      console.log(`  SKIP extraction ${extraction.id}: no client_id or matched_client_id`)
      continue
    }

    // Load client if not cached
    if (!clientCache.has(clientId)) {
      const clientDoc = await db.collection('clients').doc(clientId).get()
      if (!clientDoc.exists) {
        console.log(`  SKIP extraction ${extraction.id}: client ${clientId} not found in Firestore`)
        continue
      }
      clientCache.set(clientId, clientDoc.data()!)
    }

    const clientData = clientCache.get(clientId)!
    const clientName = extractClientName(clientData)
    const extractedData = extraction.client_data as Record<string, unknown>
    const sourceName = extraction.source_file || extraction.id

    // 4. Compare each enrichment field
    for (const field of ENRICHMENT_FIELDS) {
      const clientVal = clientData[field]
      const extractedVal = extractedData[field]

      if (isBlank(clientVal) && !isBlank(extractedVal)) {
        proposals.push({
          client_id: clientId,
          client_name: clientName,
          field,
          proposed_value: extractedVal,
          extraction_source: sourceName,
          extraction_id: extraction.id,
        })
      }
    }
  }

  // 5. Report
  console.log(`  Found ${proposals.length} backfill proposals across ${new Set(proposals.map(p => p.client_id)).size} clients\n`)

  if (proposals.length > 0) {
    // Group by client for readable output
    const byClient = new Map<string, BackfillProposal[]>()
    for (const p of proposals) {
      if (!byClient.has(p.client_id)) byClient.set(p.client_id, [])
      byClient.get(p.client_id)!.push(p)
    }

    for (const [clientId, clientProposals] of byClient) {
      const name = clientProposals[0].client_name
      console.log(`  ${name} (${clientId}):`)
      for (const p of clientProposals) {
        console.log(`    ${p.field}: "${p.proposed_value}" (from ${p.extraction_source})`)
      }
      console.log()
    }
  }

  // 6. Apply if --commit
  if (COMMIT && proposals.length > 0) {
    console.log('  Writing backfills to Firestore...\n')

    // Group proposals by client_id for batch writes
    const byClient = new Map<string, BackfillProposal[]>()
    for (const p of proposals) {
      if (!byClient.has(p.client_id)) byClient.set(p.client_id, [])
      byClient.get(p.client_id)!.push(p)
    }

    let written = 0
    for (const [clientId, clientProposals] of byClient) {
      const update: Record<string, unknown> = {
        updated_at: FieldValue.serverTimestamp(),
        updated_by: 'acf-enrich-clients/phase1',
      }
      for (const p of clientProposals) {
        update[p.field] = p.proposed_value
      }

      await db.collection('clients').doc(clientId).update(update)
      modifiedClientIds.add(clientId)
      written++

      // Audit log each backfill
      for (const p of clientProposals) {
        await db.collection('atlas_audit').add({
          action: 'acf_enrich_backfill',
          entity_type: 'client',
          entity_id: clientId,
          field: p.field,
          old_value: null,
          new_value: p.proposed_value,
          source: `extraction:${p.extraction_id}`,
          source_file: p.extraction_source,
          timestamp: FieldValue.serverTimestamp(),
          actor: 'acf-enrich-clients',
        })
      }
    }
    console.log(`  Wrote ${written} client updates, ${proposals.length} field backfills\n`)
  }

  return { proposals, modifiedClientIds }
}

// ============================================================================
// PHASE 2: WhitePages Enrichment Manifest
// ============================================================================

async function phase2(): Promise<{ candidates: WhitePagesCandidate[] }> {
  console.log('\n' + '='.repeat(70))
  console.log('  PHASE 2: WhitePages Enrichment Manifest')
  console.log('='.repeat(70) + '\n')

  const KEY_FIELDS = ['phone', 'email', 'address'] as const
  const candidates: WhitePagesCandidate[] = []

  // Query active clients still missing key fields
  const activeStatuses = ['Active', 'Active - Internal', 'Active - External']
  for (const status of activeStatuses) {
    const snap = await db.collection('clients').where('client_status', '==', status).get()
    for (const doc of snap.docs) {
      const d = doc.data()
      const missingFields: string[] = []

      for (const field of KEY_FIELDS) {
        if (isBlank(d[field])) {
          missingFields.push(field)
        }
      }

      if (missingFields.length > 0) {
        candidates.push({
          client_id: doc.id,
          first_name: String(d.first_name || '').trim(),
          last_name: String(d.last_name || '').trim(),
          missing_fields: missingFields,
          existing_data: {
            ...(d.phone ? { phone: String(d.phone) } : {}),
            ...(d.email ? { email: String(d.email) } : {}),
            ...(d.address ? { address: String(d.address) } : {}),
            ...(d.city ? { city: String(d.city) } : {}),
            ...(d.state ? { state: String(d.state) } : {}),
            ...(d.zip ? { zip: String(d.zip) } : {}),
            ...(d.dob ? { dob: String(d.dob) } : {}),
          },
        })
      }
    }
  }

  console.log(`  ${candidates.length} active clients still missing key fields (phone/email/address)\n`)

  // Breakdown
  const missingPhone = candidates.filter(c => c.missing_fields.includes('phone')).length
  const missingEmail = candidates.filter(c => c.missing_fields.includes('email')).length
  const missingAddress = candidates.filter(c => c.missing_fields.includes('address')).length
  console.log(`  Missing phone:   ${missingPhone}`)
  console.log(`  Missing email:   ${missingEmail}`)
  console.log(`  Missing address: ${missingAddress}\n`)

  // Save manifest
  mkdirSync(ENRICHMENT_DIR, { recursive: true })
  const manifestPath = join(ENRICHMENT_DIR, 'whitepages-manifest.json')
  writeFileSync(manifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_candidates: candidates.length,
    breakdown: { missingPhone, missingEmail, missingAddress },
    note: 'WhitePages enrichment requires MCP tools -- run via Claude Code session, not standalone script',
    candidates,
  }, null, 2))
  console.log(`  Manifest saved to: ${manifestPath}`)

  // Show sample
  if (candidates.length > 0) {
    console.log('\n  Sample candidates (first 10):')
    for (const c of candidates.slice(0, 10)) {
      console.log(`    ${c.first_name} ${c.last_name} (${c.client_id}) - missing: ${c.missing_fields.join(', ')}`)
    }
  }

  console.log('\n  NOTE: WhitePages enrichment requires MCP tools.')
  console.log('  Feed whitepages-manifest.json to a Claude Code session for execution.\n')

  return { candidates }
}

// ============================================================================
// PHASE 3: SUPER_NORMALIZE
// ============================================================================

async function phase3(modifiedClientIds?: Set<string>): Promise<{ normalizedCount: number }> {
  console.log('\n' + '='.repeat(70))
  console.log(`  PHASE 3: SUPER_NORMALIZE ${COMMIT ? '(LIVE)' : '(DRY RUN)'}`)
  console.log('='.repeat(70) + '\n')

  // Determine which clients to normalize
  let clientIds: string[]

  if (modifiedClientIds && modifiedClientIds.size > 0) {
    clientIds = [...modifiedClientIds]
    console.log(`  Normalizing ${clientIds.length} clients modified in earlier phases\n`)
  } else {
    // If running phase3 standalone, normalize all active clients
    console.log('  No modified client set provided -- normalizing all active clients\n')
    clientIds = []
    const activeStatuses = ['Active', 'Active - Internal', 'Active - External']
    for (const status of activeStatuses) {
      const snap = await db.collection('clients').where('client_status', '==', status).get()
      for (const doc of snap.docs) {
        clientIds.push(doc.id)
      }
    }
    console.log(`  Found ${clientIds.length} active clients to check\n`)
  }

  // Normalization map: field -> normalizer function
  const fieldNormalizers: Record<string, (val: string) => string> = {
    phone: (v) => normalizePhone(v),
    cell_phone: (v) => normalizePhone(v),
    first_name: (v) => normalizeName(v),
    last_name: (v) => normalizeName(v),
    spouse_name: (v) => normalizeName(v),
    state: (v) => normalizeState(v),
    zip: (v) => normalizeZip(v),
    dob: (v) => normalizeDate(v),
    email: (v) => normalizeEmail(v),
    address: (v) => normalizeAddress(v),
    city: (v) => normalizeCity(v),
  }

  let normalizedCount = 0
  const changes: Array<{ client_id: string; field: string; old_value: string; new_value: string }> = []

  // Process in chunks to avoid memory issues
  const CHUNK_SIZE = 100
  for (let i = 0; i < clientIds.length; i += CHUNK_SIZE) {
    const chunk = clientIds.slice(i, i + CHUNK_SIZE)

    for (const clientId of chunk) {
      const doc = await db.collection('clients').doc(clientId).get()
      if (!doc.exists) continue

      const data = doc.data()!
      const updates: Record<string, unknown> = {}

      for (const [field, normalizer] of Object.entries(fieldNormalizers)) {
        const rawVal = data[field]
        if (isBlank(rawVal)) continue

        const raw = String(rawVal)
        const normalized = normalizer(raw)

        if (normalized && normalized !== raw) {
          updates[field] = normalized
          changes.push({
            client_id: clientId,
            field,
            old_value: raw,
            new_value: normalized,
          })
        }
      }

      if (Object.keys(updates).length > 0) {
        normalizedCount++

        if (COMMIT) {
          updates.updated_at = FieldValue.serverTimestamp()
          updates.updated_by = 'acf-enrich-clients/phase3-normalize'
          await db.collection('clients').doc(clientId).update(updates)
        }
      }
    }

    if (i + CHUNK_SIZE < clientIds.length) {
      console.log(`  Processed ${Math.min(i + CHUNK_SIZE, clientIds.length)}/${clientIds.length} clients...`)
    }
  }

  // Report
  console.log(`\n  ${normalizedCount} clients with normalization changes (${changes.length} total field changes)\n`)

  if (changes.length > 0) {
    // Show sample changes
    const sample = changes.slice(0, 20)
    console.log('  Sample changes (first 20):')
    for (const c of sample) {
      console.log(`    ${c.client_id} | ${c.field}: "${c.old_value}" -> "${c.new_value}"`)
    }
    if (changes.length > 20) {
      console.log(`    ... and ${changes.length - 20} more`)
    }
  }

  if (COMMIT && normalizedCount > 0) {
    console.log(`\n  Wrote normalization updates to ${normalizedCount} clients`)
  }

  console.log()
  return { normalizedCount }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '#'.repeat(70))
  console.log(`  ACF Client Enrichment Pipeline`)
  console.log(`  Mode: ${COMMIT ? 'LIVE' : 'DRY RUN'}`)
  console.log(`  Phases: ${RUN_ALL ? 'ALL' : [PHASE1 && '1', PHASE2 && '2', PHASE3 && '3'].filter(Boolean).join(', ')}`)
  console.log('#'.repeat(70))

  let modifiedClientIds = new Set<string>()

  // Phase 1
  if (RUN_ALL || PHASE1) {
    const result = await phase1()
    modifiedClientIds = result.modifiedClientIds
  }

  // Phase 2
  if (RUN_ALL || PHASE2) {
    await phase2()
  }

  // Phase 3
  if (RUN_ALL || PHASE3) {
    await phase3(modifiedClientIds.size > 0 ? modifiedClientIds : undefined)
  }

  // Summary
  console.log('='.repeat(70))
  console.log('  PIPELINE COMPLETE')
  if (!COMMIT) {
    console.log('  This was a DRY RUN. Use --commit to apply changes.')
  }
  console.log('='.repeat(70) + '\n')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
