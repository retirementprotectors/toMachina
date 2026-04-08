/**
 * Import Agents + Carrier Seed routes — ported from IMPORT_Agent.gs + processCarrierSeed
 *
 * Endpoints:
 *   POST /api/import-agents/agent      — Single agent import with dedup + matching
 *   POST /api/import-agents/agents     — Batch agent import with format parsing
 *   POST /api/import-agents/carriers   — Carrier seed (upsert carrier docs)
 *   POST /api/import-agents/naic       — Populate NAIC codes on accounts
 *   POST /api/import-agents/resolve    — Resolve a carrier name to identity
 *
 * ATLAS wires: WIRE_AGENT_MANAGEMENT (IK-003), WIRE_NAIC_CARRIER_SEEDING (IK-004)
 */

import { Router, type Request, type Response } from 'express'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import {
  importAgent,
  importAgentsBatch,
  type AgentImportOptions,
} from '../lib/import-agents.js'
import {
  seedCarriers,
  populateNaicCodes,
  resolveCarrier,
  type CarrierSeedEntry,
} from '../lib/import-carriers.js'

export const importAgentRoutes = Router()

// ============================================================================
// POST /api/import-agents/agent — Single agent import
// ============================================================================

/**
 * Import a single agent/producer with full dedup + fuzzy matching.
 *
 * Body: { agent: AgentImportData, options?: AgentImportOptions }
 *   or flat: { first_name, last_name, npn, ... }
 *
 * Options:
 *   - force: boolean — skip dedup (default: false)
 *   - source: string — import source label
 *   - allow_update: boolean — update existing on match (default: true)
 */
importAgentRoutes.post('/agent', async (req: Request, res: Response) => {
  try {
    const agentData = req.body.agent || req.body
    const options: AgentImportOptions = req.body.options || {}

    // Strip options/agent wrapper keys from flat payload
    const cleanData = { ...agentData }
    delete cleanData.options

    const result = await importAgent(cleanData, options)

    if (!result.success) {
      res.status(400).json(errorResponse(result.error || 'Import failed'))
      return
    }

    const statusCode = result.data?.action === 'created' ? 201 : 200
    res.status(statusCode).json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/import-agents/agent error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/import-agents/agents — Batch agent import
// ============================================================================

/**
 * Batch import agents with optional format-specific parsing.
 *
 * Body: { agents: AgentImportData[], options?: AgentImportOptions }
 *
 * Options.format:
 *   - 'nipr' — Parse NIPR column names (NPN, First Name, etc.)
 *   - 'lc3_discovery' — Parse LC3 producerXxx fields
 *   - 'manual' or omitted — Expect canonical field names
 */
importAgentRoutes.post('/agents', async (req: Request, res: Response) => {
  try {
    const agents = req.body.agents || []
    const options: AgentImportOptions = req.body.options || {}

    if (!Array.isArray(agents) || agents.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty agents array'))
      return
    }

    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'
    const result = await importAgentsBatch(agents, options, userEmail)

    if (!result.success) {
      res.status(400).json(errorResponse(result.error || 'Batch import failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/import-agents/agents error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/import-agents/carriers — Carrier seed (upsert)
// ============================================================================

/**
 * Upsert carrier documents into Firestore.
 *
 * Body: { carriers: CarrierSeedEntry[] }
 *
 * Each entry has: carrier_id, parent_brand, display_name, underwriting_charters[].
 * Existing carriers get new charters merged (never removed).
 */
importAgentRoutes.post('/carriers', async (req: Request, res: Response) => {
  try {
    const carriers: CarrierSeedEntry[] = req.body.carriers || []

    if (!Array.isArray(carriers) || carriers.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty carriers array'))
      return
    }

    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'
    const result = await seedCarriers(carriers, userEmail)

    if (!result.success) {
      res.status(400).json(errorResponse(result.error || 'Carrier seed failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/import-agents/carriers error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/import-agents/naic — Populate NAIC codes on accounts
// ============================================================================

/**
 * Backfill naic_code on accounts that have charter_code but no naic_code.
 *
 * Body: { dry_run?: boolean } — defaults to true (preview mode)
 */
importAgentRoutes.post('/naic', async (req: Request, res: Response) => {
  try {
    const dryRun = req.body.dry_run !== false
    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    const result = await populateNaicCodes(dryRun, userEmail)

    if (!result.success) {
      res.status(500).json(errorResponse(result.error || 'NAIC population failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/import-agents/naic error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/import-agents/resolve — Resolve carrier name to identity
// ============================================================================

/**
 * Resolve a raw carrier name to its full two-layer identity.
 *
 * Body: { carrier: string }
 *
 * Returns: { carrier, charter, charter_code, naic, carrier_id }
 */
importAgentRoutes.post('/resolve', async (req: Request, res: Response) => {
  try {
    const rawName = req.body.carrier
    if (!rawName || typeof rawName !== 'string') {
      res.status(400).json(errorResponse('Missing required field: carrier'))
      return
    }

    const resolved = resolveCarrier(rawName)
    res.json(successResponse(resolved))
  } catch (err) {
    console.error('POST /api/import-agents/resolve error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
