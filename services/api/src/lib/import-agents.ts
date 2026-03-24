/**
 * Agent/Producer import orchestration — ported from IMPORT_Agent.gs
 *
 * Handles single + batch agent import with:
 *   - NPN validation (8-10 digits per NIPR standard)
 *   - Dedup by NPN, email, and fuzzy name matching
 *   - Source-specific parsing (NIPR, LC3 Discovery)
 *   - Normalization via @tomachina/core normalizers
 *   - Update-or-create semantics with force override
 *   - Import run tracking via import-tracker
 *
 * ATLAS wire: WIRE_AGENT_MANAGEMENT (IK-003)
 */

import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  matchAgent,
  type MatchResult,
} from '@tomachina/core'
import { writeThroughBridge } from './helpers.js'
import { startImportRun, completeImportRun } from './import-tracker.js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AGENT_COLLECTION = 'agents'

const REQUIRED_FIELDS = ['npn', 'first_name', 'last_name'] as const

const VALID_STATUSES = ['active', 'inactive'] as const

const DEFAULT_STATUS = 'active'

// ============================================================================
// TYPES
// ============================================================================

export interface AgentImportData {
  npn?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  status?: string
  source?: string
  agent_id?: string
  [key: string]: unknown
}

export interface AgentImportOptions {
  /** Override duplicate detection and force write */
  force?: boolean
  /** Source label for import tracking */
  source?: string
  /** Allow updating existing agents */
  allow_update?: boolean
  /** Which parser to use for raw data */
  format?: 'nipr' | 'lc3_discovery' | 'manual'
}

export interface AgentImportResult {
  action: 'created' | 'updated' | 'skipped'
  agent_id: string
  reason?: string
  changes?: string[]
  match_method?: string
}

export interface AgentBatchResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ index: number; error: string }>
  import_run_id: string
}

// ============================================================================
// NPN VALIDATION
// ============================================================================

function normalizeNpn(npn: string): string {
  return String(npn).replace(/\D/g, '').slice(0, 10)
}

function isValidNpn(npn: string): boolean {
  const cleaned = normalizeNpn(npn)
  return cleaned.length >= 8 && cleaned.length <= 10
}

// ============================================================================
// NORMALIZATION
// ============================================================================

function normalizeAgentData(data: AgentImportData): AgentImportData {
  const normalized: AgentImportData = { ...data }

  if (data.npn) {
    normalized.npn = normalizeNpn(data.npn)
  }

  if (data.first_name) {
    normalized.first_name = normalizeName(data.first_name)
  }

  if (data.last_name) {
    normalized.last_name = normalizeName(data.last_name)
  }

  if (data.email) {
    normalized.email = normalizeEmail(data.email)
  }

  if (data.phone) {
    normalized.phone = normalizePhone(data.phone)
  }

  // Validate and default status
  const status = (data.status || DEFAULT_STATUS).toLowerCase()
  normalized.status = (VALID_STATUSES as readonly string[]).includes(status)
    ? status
    : DEFAULT_STATUS

  return normalized
}

// ============================================================================
// SOURCE PARSERS (ported from IMPORT_Agent.gs)
// ============================================================================

/**
 * Parse agent data from NIPR export.
 * Maps various NIPR column name formats to our canonical fields.
 */
export function parseNIPRData(rows: Record<string, unknown>[]): AgentImportData[] {
  const agents: AgentImportData[] = []

  for (const row of rows) {
    const agent: AgentImportData = {
      npn: String(row.npn || row.NPN || row['National Producer Number'] || ''),
      first_name: String(row.first_name || row.firstName || row['First Name'] || ''),
      last_name: String(row.last_name || row.lastName || row['Last Name'] || ''),
      email: String(row.email || row.Email || row['Email Address'] || ''),
      phone: String(row.phone || row.Phone || row['Business Phone'] || row['Phone Number'] || ''),
      status: DEFAULT_STATUS,
      source: 'NIPR',
    }

    // Skip rows missing NPN — it's the critical identifier for NIPR data
    if (!agent.npn) continue

    agents.push(agent)
  }

  return agents
}

/**
 * Parse agent data from LC3 Discovery.
 * Maps LC3's producerXxx field naming pattern.
 */
export function parseLC3DiscoveryData(rows: Record<string, unknown>[]): AgentImportData[] {
  const agents: AgentImportData[] = []

  for (const row of rows) {
    const agent: AgentImportData = {
      npn: String(row.npn || row.NPN || row.producerNPN || ''),
      first_name: String(row.first_name || row.firstName || row.producerFirstName || ''),
      last_name: String(row.last_name || row.lastName || row.producerLastName || ''),
      email: String(row.email || row.producerEmail || ''),
      phone: String(row.phone || row.producerPhone || ''),
      status: DEFAULT_STATUS,
      source: 'LC3_Discovery',
    }

    // LC3 allows name-only records (no NPN required)
    if (!agent.npn && !agent.first_name && !agent.last_name) continue

    agents.push(agent)
  }

  return agents
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateAgentData(data: AgentImportData): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid agent data object' }
  }

  for (const field of REQUIRED_FIELDS) {
    const value = data[field]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return { valid: false, error: `Missing required field: ${field}` }
    }
  }

  if (data.npn) {
    const cleanNpn = normalizeNpn(data.npn)
    if (!isValidNpn(cleanNpn)) {
      return { valid: false, error: `Invalid NPN format: ${data.npn}. Must be 8-10 digits.` }
    }
  }

  return { valid: true }
}

// ============================================================================
// SINGLE AGENT IMPORT
// ============================================================================

/**
 * Import a single agent into Firestore.
 *
 * 1. Validate required fields + NPN format
 * 2. Normalize all fields
 * 3. Dedup check (NPN exact, email exact, fuzzy name)
 * 4. If existing + allow_update → merge changes
 * 5. If new → create with bridge fallback
 */
export async function importAgent(
  agentData: AgentImportData,
  options: AgentImportOptions = {}
): Promise<{ success: boolean; data?: AgentImportResult; error?: string }> {
  const allowUpdate = options.allow_update !== false
  const force = options.force || false

  try {
    // Validate
    const validation = validateAgentData(agentData)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Normalize
    const normalized = normalizeAgentData(agentData)

    const db = getFirestore()

    // ── Dedup: load existing agents for matching ──
    if (!force) {
      const existingMatch = await findExistingAgent(db, normalized)

      if (existingMatch.match) {
        if (!allowUpdate) {
          return {
            success: true,
            data: {
              action: 'skipped',
              agent_id: existingMatch.match.agent_id || existingMatch.match.id || '',
              reason: `Agent exists (matched by ${existingMatch.method})`,
              match_method: existingMatch.method,
            },
          }
        }

        // Update existing agent
        const existingId = existingMatch.match.agent_id || existingMatch.match.id || ''
        const changes = await updateExistingAgent(db, existingId, normalized)
        return {
          success: true,
          data: {
            action: 'updated',
            agent_id: existingId,
            changes,
            match_method: existingMatch.method,
          },
        }
      }
    }

    // ── Create new agent ──
    const now = new Date().toISOString()
    const agentId = normalized.agent_id || randomUUID()

    const newAgent: Record<string, unknown> = {
      ...normalized,
      agent_id: agentId,
      import_source: options.source || 'API_IMPORT',
      created_at: now,
      updated_at: now,
    }

    const bridgeResult = await writeThroughBridge(AGENT_COLLECTION, 'insert', agentId, newAgent)
    if (!bridgeResult.success) {
      await db.collection(AGENT_COLLECTION).doc(agentId).set(newAgent)
    }

    return {
      success: true,
      data: {
        action: 'created',
        agent_id: agentId,
      },
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ============================================================================
// BATCH AGENT IMPORT
// ============================================================================

/**
 * Batch import agents with dedup, validation, and run tracking.
 *
 * Pre-loads all existing NPNs for O(1) dedup within the batch.
 * Uses Firestore batched writes (max 500 per batch, auto-chunked).
 */
export async function importAgentsBatch(
  agents: AgentImportData[],
  options: AgentImportOptions = {},
  triggeredBy: string = 'api'
): Promise<{ success: boolean; data?: AgentBatchResult; error?: string }> {
  if (!Array.isArray(agents) || agents.length === 0) {
    return { success: false, error: 'Invalid or empty agents array' }
  }

  // Parse raw data if format specified
  let parsed = agents
  if (options.format === 'nipr') {
    parsed = parseNIPRData(agents as unknown as Record<string, unknown>[])
  } else if (options.format === 'lc3_discovery') {
    parsed = parseLC3DiscoveryData(agents as unknown as Record<string, unknown>[])
  }

  const importRunId = await startImportRun({
    wire_id: 'WIRE_AGENT_MANAGEMENT',
    import_type: 'agents',
    source: options.source || 'API_IMPORT',
    total_records: parsed.length,
    triggered_by: triggeredBy,
  })

  const db = getFirestore()
  const now = new Date().toISOString()
  const results: AgentBatchResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    import_run_id: importRunId,
  }

  // Pre-load existing NPNs for dedup
  const existingNpns = new Set<string>()
  const npnSnap = await db.collection(AGENT_COLLECTION).select('npn').get()
  for (const doc of npnSnap.docs) {
    const npn = doc.data().npn
    if (npn) existingNpns.add(npn)
  }

  // Chunk into batches of 400 (leave room for Firestore 500 limit)
  const BATCH_SIZE = 400
  const chunks: AgentImportData[][] = []
  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    chunks.push(parsed.slice(i, i + BATCH_SIZE))
  }

  let globalIndex = 0

  for (const chunk of chunks) {
    const batch = db.batch()

    for (const agentData of chunk) {
      const idx = globalIndex++
      try {
        // Validate
        const validation = validateAgentData(agentData)
        if (!validation.valid) {
          results.errors.push({ index: idx, error: validation.error || 'Validation failed' })
          continue
        }

        // Normalize
        const normalized = normalizeAgentData(agentData)
        const cleanNpn = normalized.npn || ''

        if (!isValidNpn(cleanNpn)) {
          results.errors.push({ index: idx, error: `Invalid NPN: ${agentData.npn}` })
          continue
        }

        // Dedup check
        if (existingNpns.has(cleanNpn) && !options.force) {
          results.skipped++
          continue
        }

        // Prepare document
        const agentId = normalized.agent_id || randomUUID()
        const doc: Record<string, unknown> = {
          ...normalized,
          agent_id: agentId,
          import_source: options.source || 'API_IMPORT',
          created_at: now,
          updated_at: now,
        }

        batch.set(db.collection(AGENT_COLLECTION).doc(agentId), doc)
        existingNpns.add(cleanNpn) // prevent intra-batch dupes
        results.imported++
      } catch (err) {
        results.errors.push({ index: idx, error: String(err) })
      }
    }

    await batch.commit()
  }

  await completeImportRun(importRunId, {
    imported: results.imported,
    skipped: results.skipped,
    duplicates: results.skipped, // skipped = dedup matches
    errors: results.errors.length,
    error_details: results.errors,
  })

  return { success: true, data: results }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface AgentRecord {
  id?: string
  agent_id?: string
  npn?: string
  email?: string
  first_name?: string
  last_name?: string
  firstName?: string
  lastName?: string
  status?: string
  [key: string]: unknown
}

/**
 * Find an existing agent using the three-tier match strategy from IMPORT_Agent.gs:
 *   1. Exact NPN match (score 100)
 *   2. Exact email match (score 95)
 *   3. Fuzzy name match (score > 85)
 */
async function findExistingAgent(
  db: FirebaseFirestore.Firestore,
  normalized: AgentImportData
): Promise<MatchResult<AgentRecord>> {
  // NPN exact match (fastest — indexed query)
  if (normalized.npn) {
    const npnSnap = await db.collection(AGENT_COLLECTION)
      .where('npn', '==', normalized.npn)
      .limit(1)
      .get()

    if (!npnSnap.empty) {
      const doc = npnSnap.docs[0]
      return {
        match: { id: doc.id, ...doc.data() } as AgentRecord,
        score: 100,
        method: 'npn',
      }
    }
  }

  // Email exact match
  if (normalized.email) {
    const emailSnap = await db.collection(AGENT_COLLECTION)
      .where('email', '==', normalized.email)
      .limit(1)
      .get()

    if (!emailSnap.empty) {
      const doc = emailSnap.docs[0]
      return {
        match: { id: doc.id, ...doc.data() } as AgentRecord,
        score: 95,
        method: 'email',
      }
    }
  }

  // Fuzzy name match — load all agents and run in-memory matching
  // Only do this when we have both first and last name
  if (normalized.first_name && normalized.last_name) {
    const allAgents = await db.collection(AGENT_COLLECTION)
      .select('agent_id', 'first_name', 'last_name', 'email', 'npn', 'status')
      .get()

    const agentRecords: AgentRecord[] = allAgents.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as AgentRecord[]

    const result = matchAgent(
      {
        firstName: normalized.first_name,
        lastName: normalized.last_name,
        npn: normalized.npn || undefined,
        email: normalized.email || undefined,
      },
      agentRecords,
      { normalizeName: (s: string) => normalizeName(s).toLowerCase(), normalizeEmail }
    )

    if (result.match && result.score > 85) {
      return result
    }
  }

  return { match: null, score: 0, method: 'none' }
}

/**
 * Update an existing agent's fields. Only overwrites fields that are
 * non-empty in the new data and different from existing values.
 */
async function updateExistingAgent(
  db: FirebaseFirestore.Firestore,
  agentId: string,
  updates: AgentImportData
): Promise<string[]> {
  const docRef = db.collection(AGENT_COLLECTION).doc(agentId)
  const doc = await docRef.get()

  if (!doc.exists) return []

  const existing = doc.data() || {}
  const changes: Record<string, unknown> = {}
  const changedFields: string[] = []

  const fieldsToCheck = ['first_name', 'last_name', 'email', 'phone', 'status'] as const
  for (const field of fieldsToCheck) {
    const newVal = updates[field]
    if (newVal && newVal !== existing[field]) {
      changes[field] = newVal
      changedFields.push(field)
    }
  }

  if (changedFields.length > 0) {
    changes.updated_at = new Date().toISOString()
    const bridgeResult = await writeThroughBridge(AGENT_COLLECTION, 'update', agentId, changes)
    if (!bridgeResult.success) {
      await docRef.update(changes)
    }
  }

  return changedFields
}
