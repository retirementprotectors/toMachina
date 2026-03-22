import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import { validateWrite } from '../middleware/validate.js'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  paginatedQuery,
  stripInternalFields,
  param,
  writeThroughBridge,
} from '../lib/helpers.js'
import { randomUUID, createHash } from 'crypto'
import { getRecentRuns, type ImportRunRecord } from '../lib/import-tracker.js'
import { detectCarrierFormat } from '../lib/carrier-formats.js'
import {
  hashHeaderFingerprint,
  profileCsvColumns,
  profileCollection,
  matchProfiles,
  matchFingerprint,
  type AtlasFormat,
  type ColumnMapping,
} from '@tomachina/core'

export const atlasRoutes = Router()

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCT_CATEGORY_MAP: Record<string, string> = {
  MAPD: 'HEALTH', MED_SUPP: 'HEALTH',
  FIA: 'WEALTH', MYGA: 'WEALTH', INVESTMENTS: 'WEALTH',
  TERM_LIFE: 'LEGACY', WHOLE_LIFE: 'LEGACY', IUL: 'LEGACY',
  ANCILLARY: 'HEALTH', GROUP: 'HEALTH',
}

const PIPELINE_STAGES = {
  INTAKE: { statuses: ['NEW', 'SCANNING', 'QUEUED'], label: 'Intake Queue', color: '#fbbf24' },
  EXTRACTION: { statuses: ['EXTRACTING', 'CLASSIFYING'], label: 'Extraction', color: '#7c5cff' },
  APPROVAL: { statuses: ['PENDING_REVIEW', 'REVIEW', 'NEEDS_INFO'], label: 'Review Queue', color: '#60a5fa' },
  MATRIX: { statuses: ['APPROVED', 'IMPORTING', 'WRITING'], label: 'MATRIX Write', color: '#34d399' },
  COMPLETED: { statuses: ['COMPLETE', 'IMPORTED'] },
  ERROR: { statuses: ['ERROR', 'FAILED', 'REJECTED'] },
} as const

// 16 wire definitions — config constants (not stored in Firestore)
const WIRE_DEFINITIONS = [
  {
    wire_id: 'WIRE_MAPD_ENROLLMENT', name: 'Medicare Enrollment Pipeline',
    product_line: 'MAPD', data_domain: 'ENROLLMENT',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier CSV', detail: 'Monthly enrollment file from carrier' },
      { type: 'GAS_FUNCTION', name: 'scanMailFolder', project: 'RAPID_IMPORT', file: 'IMPORT_Scanner.gs' },
      { type: 'SCRIPT', name: 'watcher.js', detail: 'classify + extract' },
      { type: 'GAS_FUNCTION', name: 'processApproval', project: 'RAPID_IMPORT', file: 'IMPORT_Approval.gs' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', platform: 'RAPID' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_MEDICARE', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Client List', view: 'clients', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_COMMISSION_SYNC', name: 'Commission Sync Pipeline',
    product_line: 'ALL', data_domain: 'COMMISSIONS',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Statement', detail: 'Commission statement (email/portal)' },
      { type: 'GAS_FUNCTION', name: 'scanEmailInboxes', project: 'RAPID_IMPORT', file: 'IMPORT_Scanner.gs' },
      { type: 'SCRIPT', name: 'watcher.js', detail: 'OCR/AI extraction' },
      { type: 'MATRIX_TAB', name: '_REVENUE_MASTER', platform: 'RAPID' },
      { type: 'GAS_FUNCTION', name: 'calculate_commission', project: 'CAM', file: 'CAM_Commission.gs' },
      { type: 'FRONTEND', name: 'CAM Dashboard', view: 'cam', platform: 'ALL' },
    ],
  },
  {
    wire_id: 'WIRE_DOC_INTAKE_MAIL', name: 'Document Intake (Mail)',
    product_line: 'ALL', data_domain: 'ALL',
    stages: [
      { type: 'EXTERNAL', name: 'Physical Mail', detail: 'Scanned documents' },
      { type: 'GAS_FUNCTION', name: 'scanMailFolder', project: 'RAPID_IMPORT' },
      { type: 'LAUNCHD', name: 'com.rpi.document-watcher' },
      { type: 'SCRIPT', name: 'classify + extract', detail: 'document-processor' },
      { type: 'MATRIX_TAB', name: '_INTAKE_QUEUE', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Approval UI', view: 'casework', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_DOC_INTAKE_EMAIL', name: 'Document Intake (Email)',
    product_line: 'ALL', data_domain: 'ALL',
    stages: [
      { type: 'EXTERNAL', name: 'Email Attachments', detail: 'Inbox scanning' },
      { type: 'GAS_FUNCTION', name: 'scanEmailInboxes', project: 'RAPID_IMPORT' },
      { type: 'LAUNCHD', name: 'com.rpi.document-watcher' },
      { type: 'SCRIPT', name: 'classify + extract', detail: 'document-processor' },
      { type: 'MATRIX_TAB', name: '_INTAKE_QUEUE', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Approval UI', view: 'casework', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_CLIENT_ENRICHMENT', name: 'Client Enrichment Pipeline',
    product_line: 'ALL', data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', platform: 'RAPID' },
      { type: 'MCP_TOOL', name: 'WhitePages Pro Lookup', server: 'rpi-workspace' },
      { type: 'GAS_FUNCTION', name: 'normalizePhone', project: 'RAPID_CORE' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Client Profile', view: 'clients', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_VALIDATION_PIPELINE', name: 'Contact Validation Pipeline',
    product_line: 'ALL', data_domain: 'VALIDATION',
    stages: [
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', platform: 'RAPID' },
      { type: 'GAS_FUNCTION', name: 'validatePhone', project: 'RAPID_CORE' },
      { type: 'GAS_FUNCTION', name: 'validateEmail', project: 'RAPID_CORE' },
      { type: 'GAS_FUNCTION', name: 'scoreContactQuality', project: 'RAPID_IMPORT' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', platform: 'RAPID' },
    ],
  },
  // WIRE_NPI_LOOKUP — REMOVED 2026-03-15.
  // NPI ≠ NPN. NPI = healthcare providers (CMS NPPES). NPN = insurance producers (NIPR).
  // TODO: Replace with WIRE_NIPR_LOOKUP for producer licensing via NIPR PDB.
  // See packages/core/src/atlas/wires.ts for full explanation.
  {
    wire_id: 'WIRE_MAPD_QUOTING', name: 'Medicare Plan Quoting',
    product_line: 'MAPD', data_domain: 'ACCOUNTS',
    stages: [
      { type: 'FRONTEND', name: 'ZIP + County Input', view: 'medicare', platform: 'PRODASH' },
      { type: 'API_ENDPOINT', name: 'search_plans_by_county', detail: 'QUE-API' },
      { type: 'API_ENDPOINT', name: 'get_plan_details', detail: 'QUE-API' },
      { type: 'API_ENDPOINT', name: 'compare_plans', detail: 'QUE-API' },
      { type: 'FRONTEND', name: 'Plan Comparison', view: 'medicare', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_LIFE_ANNUITY_ACCOUNTS', name: 'Life/Annuity Account Pipeline',
    product_line: 'FIA', data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Portal / DTCC', detail: 'Account data feeds' },
      { type: 'GAS_FUNCTION', name: 'processAccountImport', project: 'RAPID_IMPORT' },
      { type: 'GAS_FUNCTION', name: 'normalizeAccountData', project: 'RAPID_CORE' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_ANNUITY', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Account Detail', view: 'accounts', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_INVESTMENT_ACCOUNTS', name: 'Investment Account Pipeline',
    product_line: 'INVESTMENTS', data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Schwab/RBC Feeds', detail: 'DST Vision + custodian files' },
      { type: 'GAS_FUNCTION', name: 'processAccountImport', project: 'RAPID_IMPORT' },
      { type: 'GAS_FUNCTION', name: 'normalizeAccountData', project: 'RAPID_CORE' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_INVESTMENTS', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Account Detail', view: 'accounts', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_AGENT_MANAGEMENT', name: 'Agent/Producer Management',
    product_line: 'ALL', data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'EXTERNAL', name: 'Gradient Portal', detail: 'Agent appointment data' },
      { type: 'GAS_FUNCTION', name: 'processAgentImport', project: 'RAPID_IMPORT' },
      { type: 'MATRIX_TAB', name: '_AGENT_MASTER', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Producer Grid', view: 'producers', platform: 'SENTINEL' },
    ],
  },
  {
    wire_id: 'WIRE_MEETING_PROCESSING', name: 'Meeting Processing Pipeline',
    product_line: 'ALL', data_domain: 'ALL',
    stages: [
      { type: 'EXTERNAL', name: 'Google Meet / Zoom', detail: 'Meeting recordings' },
      { type: 'MCP_TOOL', name: 'process_meeting', server: 'rpi-business' },
      { type: 'GAS_FUNCTION', name: 'storeMeetingNotes', project: 'RAPID_COMMS' },
      { type: 'FRONTEND', name: 'Activity Timeline', view: 'clients', platform: 'PRODASH' },
    ],
  },
  {
    wire_id: 'WIRE_PORTAL_PRODASHX', name: 'ProDashX Portal Flow',
    product_line: 'ALL', data_domain: 'ALL',
    stages: [
      { type: 'FRONTEND', name: 'ProDashX', view: 'portal', platform: 'PRODASH' },
      { type: 'API_ENDPOINT', name: 'tm-api (Cloud Run)', detail: 'Proxied via portal /api/* routes' },
      { type: 'MATRIX_TAB', name: 'Firestore', platform: 'ALL' },
    ],
  },
  {
    wire_id: 'WIRE_PORTAL_SENTINEL', name: 'SENTINEL Portal Flow',
    product_line: 'ALL', data_domain: 'ALL',
    stages: [
      { type: 'FRONTEND', name: 'SENTINEL', view: 'portal', platform: 'SENTINEL' },
      { type: 'API_ENDPOINT', name: 'tm-api (Cloud Run)', detail: 'Proxied via portal /api/* routes' },
      { type: 'MATRIX_TAB', name: 'Firestore', platform: 'ALL' },
    ],
  },
  {
    wire_id: 'WIRE_PORTAL_RIIMO', name: 'RIIMO Portal Flow',
    product_line: 'ALL', data_domain: 'ALL',
    stages: [
      { type: 'FRONTEND', name: 'RIIMO', view: 'portal', platform: 'RIIMO' },
      { type: 'API_ENDPOINT', name: 'tm-api (Cloud Run)', detail: 'Proxied via portal /api/* routes' },
      { type: 'MATRIX_TAB', name: 'Firestore', platform: 'ALL' },
    ],
  },
  {
    wire_id: 'WIRE_NAIC_CARRIER_SEEDING', name: 'NAIC Carrier Seeding',
    product_line: 'ALL', data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'EXTERNAL', name: 'NAIC Database', detail: 'Carrier data export' },
      { type: 'GAS_FUNCTION', name: 'processCarrierSeed', project: 'RAPID_IMPORT' },
      { type: 'MATRIX_TAB', name: '_CARRIER_MASTER', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'Carrier Grid', view: 'carriers', platform: 'ALL' },
    ],
  },
  {
    wire_id: 'WIRE_MEDICARE_ACCOUNTS', name: 'Medicare Account Pipeline',
    product_line: 'MAPD', data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Medicare Export', detail: 'CSV from carrier/IMO' },
      { type: 'API_ENDPOINT', name: 'POST /api/atlas/introspect', detail: 'Column mapping' },
      { type: 'SCRIPT', name: 'normalizeData', detail: 'Field normalization' },
      { type: 'API_ENDPOINT', name: 'POST /api/import/validate-full', detail: 'Dry run' },
      { type: 'SCRIPT', name: 'matchClient + matchAccount', detail: 'Dedup' },
      { type: 'API_ENDPOINT', name: 'POST /api/import/accounts', detail: 'Batch write' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_MEDICARE', platform: 'RAPID' },
      { type: 'FRONTEND', name: 'CLIENT360 Accounts', view: 'contacts', platform: 'PRODASH' },
    ],
  },
]

// ============================================================================
// SOURCES — CRUD
// ============================================================================

const SOURCE_COLLECTION = 'source_registry'

/**
 * GET /api/atlas/sources
 */
atlasRoutes.get('/sources', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(SOURCE_COLLECTION)

    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.gap_status) query = query.where('gap_status', '==', req.query.gap_status)
    if (req.query.current_method) query = query.where('current_method', '==', req.query.current_method)
    if (req.query.data_domain) query = query.where('data_domain', '==', req.query.data_domain)
    if (req.query.product_line) query = query.where('product_line', '==', req.query.product_line)
    if (req.query.carrier_name) query = query.where('carrier_name', '==', req.query.carrier_name)
    if (req.query.priority) query = query.where('priority', '==', req.query.priority)
    if (req.query.portal) query = query.where('portal', '==', req.query.portal)

    const result = await paginatedQuery(query, SOURCE_COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/atlas/sources error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/atlas/sources/:id
 */
atlasRoutes.get('/sources/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(SOURCE_COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Source not found')); return }
    res.json(successResponse(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/atlas/sources/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

const sourceCreateValidation = validateWrite({
  required: ['carrier_name', 'product_line', 'data_domain'],
  types: { carrier_name: 'string', product_line: 'string', data_domain: 'string' },
})

/**
 * POST /api/atlas/sources
 */
atlasRoutes.post('/sources', sourceCreateValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const sourceId = `SRC_${randomUUID().slice(0, 8)}`
    const productLine = String(req.body.product_line || '')

    const data: Record<string, unknown> = {
      source_id: sourceId,
      ...req.body,
      product_category: PRODUCT_CATEGORY_MAP[productLine] || 'OTHER',
      gap_status: req.body.gap_status || 'RED',
      automation_pct: req.body.automation_pct ?? 0,
      current_method: req.body.current_method || 'NOT_AVAILABLE',
      status: req.body.status || 'ACTIVE',
      created_at: now,
      updated_at: now,
    }

    await db.collection(SOURCE_COLLECTION).doc(sourceId).set(data)
    await writeThroughBridge(SOURCE_COLLECTION, 'insert', sourceId, data)

    res.status(201).json(successResponse({ id: sourceId, ...data }))
  } catch (err) {
    console.error('POST /api/atlas/sources error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/atlas/sources/:id
 */
atlasRoutes.patch('/sources/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(SOURCE_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Source not found')); return }

    const updates: Record<string, unknown> = { ...req.body, updated_at: new Date().toISOString() }

    // Recalculate product_category if product_line changed
    if (updates.product_line) {
      updates.product_category = PRODUCT_CATEGORY_MAP[String(updates.product_line)] || 'OTHER'
    }

    await docRef.update(updates)
    await writeThroughBridge(SOURCE_COLLECTION, 'update', id, updates)

    res.json(successResponse({ id, updated: Object.keys(updates) }))
  } catch (err) {
    console.error('PATCH /api/atlas/sources/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * DELETE /api/atlas/sources/:id (soft delete)
 */
atlasRoutes.delete('/sources/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(SOURCE_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Source not found')); return }

    await docRef.update({ status: 'DEPRECATED', updated_at: new Date().toISOString() })
    await writeThroughBridge(SOURCE_COLLECTION, 'update', id, { status: 'DEPRECATED' })

    res.json(successResponse({ id, deleted: true }))
  } catch (err) {
    console.error('DELETE /api/atlas/sources/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// TOOLS — CRUD
// ============================================================================

const TOOL_COLLECTION = 'tool_registry'

/**
 * GET /api/atlas/tools
 */
atlasRoutes.get('/tools', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(TOOL_COLLECTION)
    if (req.query.category) query = query.where('category', '==', req.query.category)
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.tool_type) query = query.where('tool_type', '==', req.query.tool_type)
    if (req.query.source_project) query = query.where('source_project', '==', req.query.source_project)
    if (req.query.runnable) query = query.where('runnable', '==', req.query.runnable === 'true')

    const result = await paginatedQuery(query, TOOL_COLLECTION, params)
    const data = result.data.map((d) => stripInternalFields(d))
    res.json(successResponse(data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/atlas/tools error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

const toolCreateValidation = validateWrite({
  required: ['tool_name', 'source_project'],
  types: { tool_name: 'string', source_project: 'string' },
})

/**
 * POST /api/atlas/tools
 */
atlasRoutes.post('/tools', toolCreateValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const toolId = `TOOL_${randomUUID().slice(0, 8)}`

    const data: Record<string, unknown> = {
      tool_id: toolId,
      ...req.body,
      tool_type: req.body.tool_type || 'FUNCTION',
      runnable: req.body.runnable ?? false,
      used_by_frontend: req.body.used_by_frontend ?? false,
      status: req.body.status || 'ACTIVE',
      created_at: now,
      updated_at: now,
    }

    await db.collection(TOOL_COLLECTION).doc(toolId).set(data)

    res.status(201).json(successResponse({ id: toolId, ...data }))
  } catch (err) {
    console.error('POST /api/atlas/tools error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/atlas/tools/:id
 */
atlasRoutes.patch('/tools/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(TOOL_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Tool not found')); return }

    const updates = { ...req.body, updated_at: new Date().toISOString() }
    await docRef.update(updates)

    res.json(successResponse({ id, updated: Object.keys(updates) }))
  } catch (err) {
    console.error('PATCH /api/atlas/tools/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// ANALYTICS — Gap Analysis + Carrier Scorecards
// ============================================================================

/**
 * GET /api/atlas/analytics
 * Gap analysis summary. Query: group_by=carrier|category|domain|portal
 */
atlasRoutes.get('/analytics', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const groupBy = (req.query.group_by as string) || 'carrier'

    const snap = await db.collection(SOURCE_COLLECTION)
      .where('status', '==', 'ACTIVE')
      .get()

    const sources = snap.docs.map((d) => d.data() as Record<string, unknown>)

    // Group sources
    const groups: Record<string, Record<string, unknown>[]> = {}
    sources.forEach((s) => {
      let key: string
      if (groupBy === 'carrier') key = String(s.carrier_name || 'Unknown')
      else if (groupBy === 'category') key = String(s.product_category || 'Unknown')
      else if (groupBy === 'domain') key = String(s.data_domain || 'Unknown')
      else if (groupBy === 'portal') key = String(s.portal || 'ALL')
      else key = String(s.carrier_name || 'Unknown')

      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })

    // Calculate per group
    const analysis = Object.entries(groups).map(([name, groupSources]) => {
      let green = 0, yellow = 0, red = 0, gray = 0
      let totalAutomation = 0
      let automationCount = 0

      groupSources.forEach((s) => {
        const gap = String(s.gap_status || '').toUpperCase()
        if (gap === 'GREEN') green++
        else if (gap === 'YELLOW') yellow++
        else if (gap === 'RED') red++
        else gray++

        if (s.automation_pct !== undefined && s.automation_pct !== null) {
          totalAutomation += Number(s.automation_pct)
          automationCount++
        }
      })

      const total = groupSources.length
      const avgAutomation = automationCount > 0 ? Math.round(totalAutomation / automationCount) : 0
      const healthScore = total > 0 ? Math.round((green * 100 + yellow * 50 + gray * 50) / total) : 0

      return { name, total, green, yellow, red, gray, avg_automation: avgAutomation, health_score: healthScore }
    })

    // Sort worst first
    analysis.sort((a, b) => a.health_score - b.health_score)

    res.json(successResponse(analysis, { group_by: groupBy, total_sources: sources.length }))
  } catch (err) {
    console.error('GET /api/atlas/analytics error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/atlas/analytics/carriers
 * Carrier scorecards: per-carrier detail with sources, tasks, recent pulls
 */
atlasRoutes.get('/analytics/carriers', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const carrierName = req.query.carrier as string

    let query: Query<DocumentData> = db.collection(SOURCE_COLLECTION).where('status', '==', 'ACTIVE')
    if (carrierName) query = query.where('carrier_name', '==', carrierName)

    const snap = await query.get()
    const sources = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)

    // Group by carrier
    const carriers: Record<string, Record<string, unknown>[]> = {}
    sources.forEach((s) => {
      const name = String(s.carrier_name || 'Unknown')
      if (!carriers[name]) carriers[name] = []
      carriers[name].push(s)
    })

    const scorecards = Object.entries(carriers).map(([name, carrierSources]) => {
      const gapBreakdown: Record<string, number> = {}
      let totalAuto = 0, autoCount = 0

      carrierSources.forEach((s) => {
        const gap = String(s.gap_status || 'GRAY')
        gapBreakdown[gap] = (gapBreakdown[gap] || 0) + 1
        if (s.automation_pct !== undefined) {
          totalAuto += Number(s.automation_pct)
          autoCount++
        }
      })

      return {
        carrier_name: name,
        total_sources: carrierSources.length,
        gap_breakdown: gapBreakdown,
        avg_automation: autoCount > 0 ? Math.round(totalAuto / autoCount) : 0,
        sources: carrierSources.map((s) => stripInternalFields(s)),
      }
    })

    res.json(successResponse(scorecards, { pagination: { count: scorecards.length, total: scorecards.length } }))
  } catch (err) {
    console.error('GET /api/atlas/analytics/carriers error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// AUDIT TRAIL
// ============================================================================

const AUDIT_COLLECTION = 'atlas_audit'

/**
 * GET /api/atlas/audit
 * Recent audit events. Query: source_id, action_type, limit
 */
atlasRoutes.get('/audit', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(AUDIT_COLLECTION)

    if (req.query.source_id) query = query.where('source_id', '==', req.query.source_id)
    if (req.query.action_type) query = query.where('action_type', '==', req.query.action_type)

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500)
    const snap = await query.orderBy('created_at', 'desc').limit(limit).get()
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)

    res.json(successResponse(data, { pagination: { count: data.length, total: data.length } }))
  } catch (err) {
    console.error('GET /api/atlas/audit error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/atlas/audit
 * Log an audit event.
 */
const auditValidation = validateWrite({
  required: ['source_id', 'action_type'],
  types: { source_id: 'string', action_type: 'string' },
})

atlasRoutes.post('/audit', auditValidation, async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const historyId = `HIST_${randomUUID().slice(0, 8)}`

    const data: Record<string, unknown> = {
      history_id: historyId,
      ...req.body,
      completed_at: req.body.completed_at || now,
      completed_by: req.body.completed_by || ((req as unknown as Record<string, unknown>).user as Record<string, string> | undefined)?.email || 'api',
      created_at: now,
    }

    await db.collection(AUDIT_COLLECTION).doc(historyId).set(data)

    res.status(201).json(successResponse(data))
  } catch (err) {
    console.error('POST /api/atlas/audit error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PIPELINE
// ============================================================================

/**
 * GET /api/atlas/pipeline
 * Pipeline flow data — stage counts from source_registry + intake queue proxy
 */
atlasRoutes.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()

    // Count active sources for SOURCE stage
    const sourceSnap = await db.collection(SOURCE_COLLECTION).where('status', '==', 'ACTIVE').get()
    const sourceCount = sourceSnap.size

    // Build pipeline stages (real counts from case_tasks as proxy)
    const taskSnap = await db.collection('case_tasks').get()
    const tasks = taskSnap.docs.map((d) => d.data() as Record<string, unknown>)

    const stageMap: Record<string, { pending: number; processing: number }> = {
      INTAKE: { pending: 0, processing: 0 },
      EXTRACTION: { pending: 0, processing: 0 },
      APPROVAL: { pending: 0, processing: 0 },
      MATRIX: { pending: 0, processing: 0 },
    }

    tasks.forEach((t) => {
      const s = String(t.status || '').toUpperCase()
      for (const [stageName, config] of Object.entries(PIPELINE_STAGES)) {
        if (stageName === 'COMPLETED' || stageName === 'ERROR') continue
        if (config.statuses.includes(s as never)) {
          const idx = config.statuses.indexOf(s as never)
          if (idx === 0) stageMap[stageName].pending++
          else stageMap[stageName].processing++
          break
        }
      }
    })

    const stages = [
      { stage: 'SOURCE', label: 'Sources', count: sourceCount, pending: sourceCount, processing: 0, color: '#a855f7' },
      { stage: 'INTAKE', label: PIPELINE_STAGES.INTAKE.label, count: stageMap.INTAKE.pending + stageMap.INTAKE.processing, ...stageMap.INTAKE, color: PIPELINE_STAGES.INTAKE.color },
      { stage: 'EXTRACTION', label: PIPELINE_STAGES.EXTRACTION.label, count: stageMap.EXTRACTION.pending + stageMap.EXTRACTION.processing, ...stageMap.EXTRACTION, color: PIPELINE_STAGES.EXTRACTION.color },
      { stage: 'APPROVAL', label: PIPELINE_STAGES.APPROVAL.label, count: stageMap.APPROVAL.pending + stageMap.APPROVAL.processing, ...stageMap.APPROVAL, color: PIPELINE_STAGES.APPROVAL.color },
      { stage: 'MATRIX', label: PIPELINE_STAGES.MATRIX.label, count: stageMap.MATRIX.pending + stageMap.MATRIX.processing, ...stageMap.MATRIX, color: PIPELINE_STAGES.MATRIX.color },
      { stage: 'FRONTEND', label: 'Frontend', count: 3, pending: 3, processing: 0, color: '#f472b6' },
    ]

    res.json(successResponse(stages))
  } catch (err) {
    console.error('GET /api/atlas/pipeline error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// WIRES — Wire Diagram Definitions
// ============================================================================

/**
 * GET /api/atlas/wires
 * Wire diagram definitions. Filter by product_line, data_domain.
 */
atlasRoutes.get('/wires', async (req: Request, res: Response) => {
  try {
    let wires = [...WIRE_DEFINITIONS]
    const productLine = req.query.product_line as string
    const dataDomain = req.query.data_domain as string

    if (productLine) {
      wires = wires.filter((w) => w.product_line === productLine || w.product_line === 'ALL')
    }
    if (dataDomain) {
      wires = wires.filter((w) => w.data_domain === dataDomain || w.data_domain === 'ALL')
    }

    res.json(successResponse(wires, { pagination: { count: wires.length, total: wires.length } }))
  } catch (err) {
    console.error('GET /api/atlas/wires error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// DIGEST — Slack Summary
// ============================================================================

/**
 * POST /api/atlas/digest
 * Generate and send a Slack digest to JDM DM.
 * Uses SLACK_BOT_TOKEN env var.
 */
atlasRoutes.post('/digest', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const slackToken = process.env.SLACK_BOT_TOKEN
    const JDM_SLACK_ID = 'U09BBHTN8F2'

    // Gather stats
    const sourceSnap = await db.collection(SOURCE_COLLECTION).where('status', '==', 'ACTIVE').get()
    const sources = sourceSnap.docs.map((d) => d.data() as Record<string, unknown>)

    let green = 0, yellow = 0, red = 0, gray = 0
    let totalAuto = 0, autoCount = 0

    sources.forEach((s) => {
      const gap = String(s.gap_status || '').toUpperCase()
      if (gap === 'GREEN') green++
      else if (gap === 'YELLOW') yellow++
      else if (gap === 'RED') red++
      else gray++
      if (s.automation_pct !== undefined) {
        totalAuto += Number(s.automation_pct)
        autoCount++
      }
    })

    const avgAutomation = autoCount > 0 ? Math.round(totalAuto / autoCount) : 0

    // Build Slack message
    const text = [
      '*ATLAS Weekly Digest*',
      '',
      `*Sources:* ${sources.length} total`,
      `:large_green_circle: GREEN: ${green} | :large_yellow_circle: YELLOW: ${yellow} | :red_circle: RED: ${red} | :white_circle: GRAY: ${gray}`,
      `*Avg Automation:* ${avgAutomation}%`,
      '',
      `_Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}_`,
    ].join('\n')

    if (!slackToken) {
      // Dry run — return the message but don't send
      res.json(successResponse({ dry_run: true, message: text, note: 'SLACK_BOT_TOKEN not set' }))
      return
    }

    // Send to Slack
    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackToken}`,
      },
      body: JSON.stringify({ channel: JDM_SLACK_ID, text }),
    })

    const slackData = await slackRes.json() as Record<string, unknown>

    if (!slackData.ok) {
      res.status(500).json(errorResponse(`Slack API error: ${slackData.error}`))
      return
    }

    res.json(successResponse({ sent: true, channel: JDM_SLACK_ID }))
  } catch (err) {
    console.error('POST /api/atlas/digest error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// HEALTH — Real-time ATLAS Health Dashboard
// ============================================================================

const STALENESS_THRESHOLD_DAYS = 7

/**
 * GET /api/atlas/health
 * Real-time health dashboard: wire statuses, source registry aggregates,
 * recent import runs, and overall health score.
 */
atlasRoutes.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()

    // 1. Load recent import runs (last per wire)
    const recentRuns = await getRecentRuns(100)

    // Build a map of wire_id -> most recent run
    const wireLastRun = new Map<string, ImportRunRecord>()
    for (const run of recentRuns) {
      if (run.wire_id && !wireLastRun.has(run.wire_id)) {
        wireLastRun.set(run.wire_id, run)
      }
    }

    // 2. Calculate wire health statuses
    const now = Date.now()
    const staleThresholdMs = STALENESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000

    const wireStatuses = WIRE_DEFINITIONS.map(wire => {
      const lastRun = wireLastRun.get(wire.wire_id)

      let status: 'healthy' | 'stale' | 'error' | 'no_data' = 'no_data'
      let lastRunAt: string | undefined
      let lastRunStatus: string | undefined

      if (lastRun) {
        lastRunAt = lastRun.completed_at || lastRun.started_at
        lastRunStatus = lastRun.status

        if (lastRun.status === 'failed') {
          status = 'error'
        } else {
          const runTime = new Date(lastRunAt).getTime()
          if (now - runTime > staleThresholdMs) {
            status = 'stale'
          } else {
            status = 'healthy'
          }
        }
      }

      return {
        wire_id: wire.wire_id,
        name: wire.name,
        product_line: wire.product_line,
        data_domain: wire.data_domain,
        status,
        last_run_at: lastRunAt,
        last_run_status: lastRunStatus,
      }
    })

    // 3. Source registry aggregates
    const sourceSnap = await db.collection(SOURCE_COLLECTION)
      .where('status', '==', 'ACTIVE')
      .get()
    const sources = sourceSnap.docs.map(d => d.data() as Record<string, unknown>)

    let greenCount = 0, yellowCount = 0, redCount = 0, grayCount = 0
    for (const s of sources) {
      const gap = String(s.gap_status || '').toUpperCase()
      if (gap === 'GREEN') greenCount++
      else if (gap === 'YELLOW') yellowCount++
      else if (gap === 'RED') redCount++
      else grayCount++
    }

    // 4. Last 10 import runs
    const last10Runs = recentRuns.slice(0, 10).map(r => ({
      run_id: r.run_id,
      import_type: r.import_type,
      source: r.source,
      status: r.status,
      imported: r.imported,
      errors: r.errors,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_ms: r.duration_ms,
    }))

    // 5. Overall health score
    const healthyWires = wireStatuses.filter(w => w.status === 'healthy').length
    const totalWiresWithData = wireStatuses.filter(w => w.status !== 'no_data').length
    const wireHealthPct = totalWiresWithData > 0
      ? Math.round((healthyWires / totalWiresWithData) * 100)
      : 0

    const totalSources = sources.length
    const sourceHealthPct = totalSources > 0
      ? Math.round(((greenCount * 100) + (yellowCount * 50)) / totalSources)
      : 0

    const overallHealth = totalWiresWithData > 0
      ? Math.round((wireHealthPct + sourceHealthPct) / 2)
      : sourceHealthPct

    res.json(successResponse({
      overall_health: overallHealth,
      wire_health_pct: wireHealthPct,
      source_health_pct: sourceHealthPct,
      wires: wireStatuses,
      sources: {
        total: totalSources,
        green: greenCount,
        yellow: yellowCount,
        red: redCount,
        gray: grayCount,
      },
      recent_runs: last10Runs,
      checked_at: new Date().toISOString(),
    }))
  } catch (err) {
    console.error('GET /api/atlas/health error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// IMPORT RUNS — History + Detail + Retry
// ============================================================================

const IMPORT_RUNS_COLLECTION = 'import_runs'

/**
 * GET /api/atlas/import-runs
 * Import run history with filters. Query: import_type, source, status, limit (default 20, max 100)
 */
atlasRoutes.get('/import-runs', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const limitParam = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100)

    let query: Query<DocumentData> = db.collection(IMPORT_RUNS_COLLECTION)
      .orderBy('started_at', 'desc')

    if (req.query.import_type) query = query.where('import_type', '==', req.query.import_type)
    if (req.query.source) query = query.where('source', '==', req.query.source)
    if (req.query.status) query = query.where('status', '==', req.query.status)

    const snap = await query.limit(limitParam).get()
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Record<string, unknown>)

    res.json(successResponse(data, { pagination: { count: data.length, total: data.length } }))
  } catch (err) {
    console.error('GET /api/atlas/import-runs error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/atlas/import-runs/:id
 * Single import run detail.
 */
atlasRoutes.get('/import-runs/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(IMPORT_RUNS_COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Import run not found')); return }
    res.json(successResponse({ id: doc.id, ...doc.data() } as Record<string, unknown>))
  } catch (err) {
    console.error('GET /api/atlas/import-runs/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/atlas/import-runs/:id/retry
 * Mark a failed import run for retry (resets status to 'running').
 */
atlasRoutes.post('/import-runs/:id/retry', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(IMPORT_RUNS_COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) { res.status(404).json(errorResponse('Import run not found')); return }

    const data = doc.data() as ImportRunRecord
    if (data.status !== 'failed' && data.status !== 'partial') {
      res.status(400).json(errorResponse(`Cannot retry run with status "${data.status}" — only failed/partial runs can be retried`))
      return
    }

    const now = new Date().toISOString()
    await docRef.update({
      status: 'running',
      started_at: now,
      completed_at: null,
      duration_ms: null,
      errors: 0,
      error_details: [],
    })

    res.json(successResponse({ id, status: 'running', retried_at: now }))
  } catch (err) {
    console.error('POST /api/atlas/import-runs/:id/retry error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// FORMAT LIBRARY — CRUD for saved carrier/export formats
// ============================================================================

/**
 * GET /api/atlas/formats
 * List saved formats. Filter by carrier_name, default_category.
 */
atlasRoutes.get('/formats', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection('atlas').doc('formats').collection('items')
    if (req.query.carrier_name) query = query.where('carrier_name', '==', req.query.carrier_name)
    if (req.query.default_category) query = query.where('default_category', '==', req.query.default_category)
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
    const snap = await query.orderBy('last_used_at', 'desc').limit(limit).get()
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(data, { pagination: { count: data.length, total: data.length } }))
  } catch (err) {
    console.error('GET /api/atlas/formats error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/atlas/formats
 * Create a new format in the library.
 */
atlasRoutes.post('/formats', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const formatId = `FMT_${randomUUID().slice(0, 8)}`
    const data = {
      format_id: formatId,
      ...req.body,
      times_used: 0,
      last_used_at: now,
      created_at: now,
      updated_at: now,
    }
    await db.collection('atlas').doc('formats').collection('items').doc(formatId).set(data)
    res.status(201).json(successResponse({ id: formatId, ...data }))
  } catch (err) {
    console.error('POST /api/atlas/formats error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/atlas/formats/:id
 * Update a saved format.
 */
atlasRoutes.patch('/formats/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const ref = db.collection('atlas').doc('formats').collection('items').doc(id)
    const doc = await ref.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Format not found')); return }
    const updates = { ...req.body, updated_at: new Date().toISOString() }
    await ref.update(updates)
    res.json(successResponse({ id, updated_at: updates.updated_at }))
  } catch (err) {
    console.error('PATCH /api/atlas/formats/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// INTROSPECTION ENGINE — Column mapping + format detection
// ============================================================================

/**
 * POST /api/atlas/introspect
 * Main introspection endpoint. Accepts headers + sample_rows, returns column mappings.
 * Tries: 1) fingerprint match, 2) carrier format detection, 3) full introspection.
 */
atlasRoutes.post('/introspect', async (req: Request, res: Response) => {
  try {
    const { headers, sample_rows, target_category } = req.body as {
      headers: string[]; sample_rows: Record<string, unknown>[]; target_category?: string
    }
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      res.status(400).json(errorResponse('headers (string[]) is required')); return
    }
    if (!sample_rows || !Array.isArray(sample_rows) || sample_rows.length === 0) {
      res.status(400).json(errorResponse('sample_rows (Record[]) is required')); return
    }

    const db = getFirestore()
    const now = new Date().toISOString()
    const fingerprint = hashHeaderFingerprint(headers)
    const runId = `INTR_${randomUUID().slice(0, 8)}`

    // 1. Check format library for fingerprint match
    const fmtSnap = await db.collection('atlas').doc('formats').collection('items').get()
    const savedFormats = fmtSnap.docs.map(d => d.data() as AtlasFormat)
    const fpMatch = matchFingerprint(fingerprint, headers, savedFormats)

    if (fpMatch && fpMatch.confidence === 100) {
      // Exact match — return saved mapping
      const mappings: ColumnMapping[] = headers.map(h => ({
        csv_header: h,
        firestore_field: fpMatch.format.column_map[h] || '',
        confidence: fpMatch.format.column_map[h] ? 100 : 0,
        status: fpMatch.format.column_map[h] ? 'auto' as const : 'unmapped' as const,
        alternatives: [],
      }))

      const run = {
        run_id: runId, format_id: fpMatch.format.format_id,
        header_fingerprint: fingerprint, headers, target_category: target_category || fpMatch.format.default_category,
        match_method: 'fingerprint_exact' as const, overall_confidence: 100,
        column_mappings: mappings, triggered_by: 'api', created_at: now,
      }
      await db.collection('atlas').doc('introspect_runs').collection('items').doc(runId).set(run)

      // Increment times_used
      const fmtRef = db.collection('atlas').doc('formats').collection('items').doc(fpMatch.format.format_id)
      await fmtRef.update({ times_used: (fpMatch.format.times_used || 0) + 1, last_used_at: now })

      res.json(successResponse({
        run_id: runId, match_method: 'fingerprint_exact', format_id: fpMatch.format.format_id,
        overall_confidence: 100, column_mappings: mappings,
        carrier_detection: { detected_carrier: fpMatch.format.carrier_name, carrier_confidence: 100, default_category: fpMatch.format.default_category },
        sample_normalized: [],
      }))
      return
    }

    // 2. Try carrier format detection
    const carrierMatch = detectCarrierFormat(headers)
    if (carrierMatch) {
      const mappings: ColumnMapping[] = headers.map(h => ({
        csv_header: h,
        firestore_field: carrierMatch.column_map[h] || '',
        confidence: carrierMatch.column_map[h] ? 95 : 0,
        status: (carrierMatch.column_map[h] ? 'auto' : 'unmapped') as 'auto' | 'unmapped',
        alternatives: [],
      }))
      const overallConf = Math.round(mappings.filter(m => m.confidence > 0).length / mappings.length * 100)

      const run = {
        run_id: runId, format_id: null, header_fingerprint: fingerprint, headers,
        target_category: target_category || carrierMatch.default_category,
        match_method: 'carrier_detect' as const, overall_confidence: overallConf,
        column_mappings: mappings, triggered_by: 'api', created_at: now,
      }
      await db.collection('atlas').doc('introspect_runs').collection('items').doc(runId).set(run)

      res.json(successResponse({
        run_id: runId, match_method: 'carrier_detect', format_id: null,
        overall_confidence: overallConf, column_mappings: mappings,
        carrier_detection: { detected_carrier: carrierMatch.carrier_name, carrier_confidence: overallConf, default_category: carrierMatch.default_category },
        sample_normalized: [],
      }))
      return
    }

    // 3. Full introspection — sample collection docs and compare profiles
    const category = target_category || 'medicare'
    const collectionPath = 'clients' // Sample from clients collection
    const sampleSnap = await db.collection(collectionPath).limit(50).get()
    const sampleDocs = sampleSnap.docs.map(d => d.data() as Record<string, unknown>)

    const csvProfiles = profileCsvColumns(headers, sample_rows)
    const collectionProfiles = profileCollection(sampleDocs)

    // Gather all carrier column maps for matching boost
    const allCarrierMaps = savedFormats.map(f => f.column_map)
    const mappings = matchProfiles(csvProfiles, collectionProfiles, allCarrierMaps)
    const overallConf = mappings.length > 0
      ? Math.round(mappings.reduce((s, m) => s + m.confidence, 0) / mappings.length)
      : 0

    const run = {
      run_id: runId, format_id: fpMatch?.format.format_id || null,
      header_fingerprint: fingerprint, headers, target_category: category,
      match_method: (fpMatch ? 'fingerprint_partial' : 'full_introspect') as 'fingerprint_partial' | 'full_introspect',
      overall_confidence: overallConf, column_mappings: mappings,
      triggered_by: 'api', created_at: now,
    }
    await db.collection('atlas').doc('introspect_runs').collection('items').doc(runId).set(run)

    res.json(successResponse({
      run_id: runId, match_method: run.match_method,
      format_id: fpMatch?.format.format_id || null,
      overall_confidence: overallConf, column_mappings: mappings,
      carrier_detection: { detected_carrier: null, carrier_confidence: 0, default_category: category },
      sample_normalized: [],
    }))
  } catch (err) {
    console.error('POST /api/atlas/introspect error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * POST /api/atlas/introspect/confirm
 * Confirm mappings from an introspect run + optionally save to format library.
 */
atlasRoutes.post('/introspect/confirm', async (req: Request, res: Response) => {
  try {
    const { run_id, confirmed_mappings, carrier_export_type, save_to_format_library } = req.body as {
      run_id: string
      confirmed_mappings: { csv_header: string; firestore_field: string }[]
      carrier_export_type?: string
      save_to_format_library?: boolean
    }
    if (!run_id) { res.status(400).json(errorResponse('run_id is required')); return }
    if (!confirmed_mappings || !Array.isArray(confirmed_mappings)) {
      res.status(400).json(errorResponse('confirmed_mappings is required')); return
    }

    const db = getFirestore()
    const now = new Date().toISOString()

    // Load the introspect run
    const runRef = db.collection('atlas').doc('introspect_runs').collection('items').doc(run_id)
    const runDoc = await runRef.get()
    if (!runDoc.exists) { res.status(404).json(errorResponse('Introspect run not found')); return }
    const runData = runDoc.data() as Record<string, unknown>

    // Update run with confirmed mappings
    const updatedMappings = confirmed_mappings.map(cm => ({
      csv_header: cm.csv_header,
      firestore_field: cm.firestore_field,
      confidence: 100,
      status: 'auto' as const,
      alternatives: [],
    }))
    await runRef.update({ column_mappings: updatedMappings, updated_at: now })

    let formatId: string | null = null

    // Save to format library if requested
    if (save_to_format_library !== false) {
      formatId = `FMT_${randomUUID().slice(0, 8)}`
      const columnMap: Record<string, string> = {}
      for (const cm of confirmed_mappings) {
        if (cm.firestore_field) columnMap[cm.csv_header] = cm.firestore_field
      }
      const formatData = {
        format_id: formatId,
        carrier_export_type: carrier_export_type || 'unknown',
        carrier_name: '',
        header_fingerprint: runData.header_fingerprint,
        column_map: columnMap,
        value_patterns: {},
        dedup_keys: [],
        default_category: runData.target_category || 'medicare',
        times_used: 1,
        last_used_at: now,
        created_by: 'api',
        created_at: now,
        updated_at: now,
      }
      await db.collection('atlas').doc('formats').collection('items').doc(formatId).set(formatData)
    }

    res.json(successResponse({
      format_id: formatId,
      mappings_confirmed: confirmed_mappings.length,
      ready_for_import: true,
    }))
  } catch (err) {
    console.error('POST /api/atlas/introspect/confirm error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
