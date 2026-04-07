// ---------------------------------------------------------------------------
// ATLAS Wire Definitions v2 — super tool composition
// Replaces old 16 wire definitions + CLIENT_IMPORT_TOOL_CHAIN with
// 3 composable wires built from super tools.
// ---------------------------------------------------------------------------

import type { WireDefinitionV2, WireDefinition } from './types'

// ---------------------------------------------------------------------------
// Wire Definitions (v2 — super tool composition)
// ---------------------------------------------------------------------------

// Wires that MUST run the client import tool chain before writing to clients collection
export const WIRES_REQUIRING_CLIENT_TOOL_CHAIN = [
  'WIRE_MAPD_ENROLLMENT',
  'WIRE_CLIENT_ENRICHMENT',
  'WIRE_MEDICARE_ACCOUNTS',
  'WIRE_LIFE_ANNUITY_ACCOUNTS',
  'WIRE_INVESTMENT_ACCOUNTS',
  'WIRE_DOC_INTAKE_MAIL',
  'WIRE_DOC_INTAKE_EMAIL',
  'WIRE_MEETING_PROCESSING',
  'WIRE_INCOMING_CORRESPONDENCE',
] as const

export const WIRE_DEFINITIONS_V2: WireDefinitionV2[] = [
  {
    wire_id: 'WIRE_DATA_IMPORT',
    name: 'Data Import Pipeline',
    description:
      'Universal data import wire. Handles CSV/file ingestion for clients, accounts, and producers. Replaces old WIRE_MAPD_ENROLLMENT, WIRE_LIFE_ANNUITY_ACCOUNTS, WIRE_INVESTMENT_ACCOUNTS, WIRE_MEDICARE_ACCOUNTS, WIRE_CLIENT_ENRICHMENT, WIRE_DOC_INTAKE_MAIL, WIRE_DOC_INTAKE_EMAIL, WIRE_MEETING_PROCESSING, WIRE_AGENT_MANAGEMENT.',
    product_lines: ['ALL'],
    data_domains: ['ENROLLMENT', 'ACCOUNTS', 'DEMOGRAPHICS'],
    super_tools: [
      'SUPER_EXTRACT',     // Fingerprint → format match → column mapping → route
      'SUPER_VALIDATE',    // Qualification gate (name + contact OR account ref)
      'SUPER_NORMALIZE',   // All 16 normalizers across 90+ fields
      'SUPER_MATCH',       // 3-tier dedup: exact, contact, name-only
      'SUPER_WRITE',       // Prepare write batch (create/update/skip)
    ],
    stages: [
      { type: 'EXTERNAL', name: 'Source Data', detail: 'CSV, email attachment, scanned doc, or API payload' },
      { type: 'SCRIPT', name: 'SUPER_EXTRACT', project: 'packages/core', detail: 'Fingerprint + format match + column mapping + collection routing' },
      { type: 'SCRIPT', name: 'SUPER_VALIDATE', project: 'packages/core', detail: 'Qualification gate — name + contact OR account ref required' },
      { type: 'SCRIPT', name: 'SUPER_NORMALIZE', project: 'packages/core', detail: '16 normalizer types across 90+ fields' },
      { type: 'SCRIPT', name: 'SUPER_MATCH', project: 'packages/core', detail: '3-tier dedup: exact (name+DOB), contact (name+phone/email), name-only' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Human review for REVIEW_NEEDED records' },
      { type: 'SCRIPT', name: 'SUPER_WRITE', project: 'packages/core', detail: 'Prepare write batch with create/update/skip operations' },
      { type: 'API_ENDPOINT', name: 'POST /api/import/execute', project: 'services/api', detail: 'Execute write batch to Firestore' },
      { type: 'FRONTEND', name: 'CLIENT360', platform: 'ProDashX', view: '/contacts/[id]', detail: 'Imported data visible in client profile' },
    ],
  },
  {
    wire_id: 'WIRE_COMMISSION_SYNC',
    name: 'Commission Statement Processing',
    description:
      'Commission/revenue data pipeline. Extracts commission rows from carrier statements, normalizes amounts and carrier names, matches to existing accounts, writes revenue records.',
    product_lines: ['ALL'],
    data_domains: ['COMMISSIONS'],
    super_tools: [
      'SUPER_EXTRACT',     // Detect commission statement format
      'SUPER_VALIDATE',    // Must have amount + carrier/policy reference
      'SUPER_NORMALIZE',   // Normalize carrier names, amounts, dates
      'SUPER_MATCH',       // Match to existing accounts
      'SUPER_WRITE',       // Write revenue records
    ],
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Commission Statement', detail: 'CSV/PDF from carrier or IMO' },
      { type: 'LAUNCHD', name: 'scanSpcFolders', project: 'services/intake', detail: 'SPC intake scanner picks up statement' },
      { type: 'SCRIPT', name: 'SUPER_EXTRACT', project: 'packages/core', detail: 'Detect format, map columns, route to revenue collection' },
      { type: 'SCRIPT', name: 'SUPER_VALIDATE', project: 'packages/core', detail: 'Validate commission rows have required fields' },
      { type: 'SCRIPT', name: 'SUPER_NORMALIZE', project: 'packages/core', detail: 'Normalize carrier names, amounts, dates' },
      { type: 'SCRIPT', name: 'SUPER_MATCH', project: 'packages/core', detail: 'Match commission rows to existing accounts' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Human review for unmatched rows' },
      { type: 'SCRIPT', name: 'SUPER_WRITE', project: 'packages/core', detail: 'Prepare revenue write batch' },
      { type: 'API_ENDPOINT', name: 'POST /api/revenue/batch', project: 'services/api', detail: 'Execute revenue batch write' },
      { type: 'FRONTEND', name: 'CAM Dashboard', platform: 'All Portals', view: '/modules/cam', detail: 'Revenue visible in CAM' },
    ],
  },
  {
    wire_id: 'WIRE_REFERENCE_SEED',
    name: 'Reference Data Seeding',
    description:
      'Seed and update reference data: carriers, products, NAIC codes, rate tables. Replaces WIRE_NAIC_CARRIER_SEEDING.',
    product_lines: ['ALL'],
    data_domains: ['REFERENCE', 'RATES'],
    super_tools: [
      'SUPER_EXTRACT',     // Detect reference data format
      'SUPER_NORMALIZE',   // Normalize carrier names, product types
      'SUPER_MATCH',       // Match to existing carriers/products
      'SUPER_WRITE',       // Upsert reference records
    ],
    stages: [
      { type: 'EXTERNAL', name: 'Reference Data Source', detail: 'NAIC/SERFF filings, carrier product lists, rate tables' },
      { type: 'SCRIPT', name: 'SUPER_EXTRACT', project: 'packages/core', detail: 'Detect format, map columns' },
      { type: 'SCRIPT', name: 'SUPER_NORMALIZE', project: 'packages/core', detail: 'Normalize carrier names, product types' },
      { type: 'SCRIPT', name: 'SUPER_MATCH', project: 'packages/core', detail: 'Match to existing carriers/products for upsert' },
      { type: 'SCRIPT', name: 'SUPER_WRITE', project: 'packages/core', detail: 'Prepare reference data write batch' },
      { type: 'API_ENDPOINT', name: 'POST /api/reference/seed', project: 'services/api', detail: 'Execute reference data upserts' },
      { type: 'FRONTEND', name: 'ATLAS', platform: 'All Portals', view: '/modules/atlas', detail: 'Reference data visible in ATLAS' },
    ],
  },
  {
    wire_id: 'WIRE_INCOMING_CORRESPONDENCE',
    name: 'Incoming Correspondence Processing',
    description:
      'Physical mail scan \u2192 classify \u2192 split \u2192 extract \u2192 validate \u2192 normalize \u2192 match \u2192 approve \u2192 write \u2192 ACF',
    product_lines: ['ALL'],
    data_domains: ['CORRESPONDENCE', 'DEMOGRAPHICS', 'ACCOUNTS'],
    super_tools: [
      'SUPER_PREPARE',
      'SUPER_CLASSIFY',
      'SUPER_EXTRACT',
      'SUPER_VALIDATE',
      'SUPER_NORMALIZE',
      'SUPER_MATCH',
      'SUPER_WRITE',
      'ACF_FINALIZE',
    ],
    stages: [
      { type: 'EXTERNAL', name: 'Google Drive', detail: 'Scanned mail PDF in intake folder' },
      { type: 'CLOUD_FUNCTION', name: 'Intake Trigger', project: 'services/intake', detail: 'Firestore onCreate on intake_queue' },
      { type: 'SCRIPT', name: 'SUPER_PREPARE', project: 'packages/core', detail: 'Download from Drive, convert PDF to page images' },
      { type: 'SCRIPT', name: 'SUPER_CLASSIFY', project: 'packages/core', detail: 'Boundary detect, split, label' },
      { type: 'SCRIPT', name: 'SUPER_EXTRACT', project: 'packages/core', detail: 'Claude Vision document extraction (mode: vision)' },
      { type: 'SCRIPT', name: 'SUPER_VALIDATE', project: 'packages/core', detail: 'Qualification gate' },
      { type: 'SCRIPT', name: 'SUPER_NORMALIZE', project: 'packages/core', detail: '16 normalizers' },
      { type: 'SCRIPT', name: 'SUPER_MATCH', project: 'packages/core', detail: '3-tier dedup' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Human review in Notifications APPROVALS tab' },
      { type: 'SCRIPT', name: 'SUPER_WRITE', project: 'packages/core', detail: 'Write to Firestore' },
      { type: 'SCRIPT', name: 'ACF_FINALIZE', project: 'packages/core', detail: 'Route file to ACF subfolder, update document_index' },
      { type: 'NOTIFICATION', name: 'Slack + In-App', detail: 'Notifications Module DATA tab' },
    ],
  },
  {
    wire_id: 'WIRE_ACF_CLEANUP',
    name: 'ACF Cleanup Wire',
    description:
      'Full Active Client File hygiene: folder structure, document naming, dedup, audit. The Digital Files pillar of the Trinity Data Method.',
    product_lines: ['ALL'],
    data_domains: ['DOCUMENTS', 'DEMOGRAPHICS'],
    super_tools: ['SUPER_FOLDER_CLEANUP', 'SUPER_DOCUMENT_CLEANUP', 'SUPER_AUDIT_REVIEW'],
    stages: [
      { type: 'SCRIPT', name: 'ACF_SNAPSHOT', project: 'packages/core', detail: 'Before snapshot — capture folder inventory' },
      { type: 'SCRIPT', name: 'SUPER_FOLDER_CLEANUP', project: 'packages/core', detail: 'Rename, merge, subfolder, route, link' },
      { type: 'SCRIPT', name: 'ACF_SNAPSHOT', project: 'packages/core', detail: 'After snapshot — verify structural changes' },
      { type: 'SCRIPT', name: 'SUPER_DOCUMENT_CLEANUP', project: 'packages/core', detail: 'Flatten, dedupe, rename, reclassify' },
      { type: 'SCRIPT', name: 'ACF_SNAPSHOT', project: 'packages/core', detail: 'After snapshot — verify document changes' },
      { type: 'SCRIPT', name: 'SUPER_AUDIT_REVIEW', project: 'packages/core', detail: 'Generate exceptions report for human review' },
      { type: 'SCRIPT', name: 'ACF_SNAPSHOT', project: 'packages/core', detail: 'Final snapshot — audit trail' },
      { type: 'FRONTEND', name: 'ACF Grid', platform: 'ProDashX', view: '/acf', detail: 'Dedup review + exceptions in ACF module' },
    ],
  },

  // ─── System Synergy Wires (ZRD-SYN-020) ─────────────────────────────
  {
    wire_id: 'WIRE_KNOWLEDGE_PROMOTE',
    name: 'Knowledge Promotion Pipeline',
    description:
      'Daily 4am — entity extraction from warrior sessions, confidence scoring, auto-write to CLAUDE.md, Slack digest to JDM DM.',
    product_lines: ['ALL'],
    data_domains: ['KNOWLEDGE'],
    super_tools: ['SUPER_KNOWLEDGE_PIPELINE_STATUS'],
    stages: [
      { type: 'SCRIPT', name: 'entity-extractor', project: 'services/learning-loop', detail: 'Extract entities from warrior soul/spirit/brain files' },
      { type: 'SCRIPT', name: 'knowledge-promote', project: 'services/learning-loop', detail: 'Confidence scoring + auto-write to CLAUDE.md' },
      { type: 'NOTIFICATION', name: 'Slack DM', detail: 'Digest to JDM DM (U09BBHTN8F2)' },
    ],
  },
  {
    wire_id: 'WIRE_BRAIN_SYNC',
    name: 'Brain Sync — Daily Export',
    description:
      'Daily 2am — find new sessions since last run, extract transcripts (PHI-redacted), append to warrior brain.txt files.',
    product_lines: ['ALL'],
    data_domains: ['KNOWLEDGE'],
    super_tools: ['SUPER_WARRIOR_READINESS'],
    stages: [
      { type: 'SCRIPT', name: 'session-inventory', project: 'services/api', detail: 'Find new sessions since last run' },
      { type: 'SCRIPT', name: 'wire-brain-sync', project: 'services/learning-loop', detail: 'Extract, PHI-redact, append to brain.txt' },
      { type: 'SCRIPT', name: 'brain-health', project: 'services/api', detail: 'Verify append succeeded' },
    ],
  },
  {
    wire_id: 'WIRE_PLATFORM_AUDIT',
    name: 'Platform Audit — Weekly Cleanup',
    description:
      'Weekly Sunday 3am — auto-delete orphaned session-envs older than 30 days, auto-archive stale sprints, cleanup report to JDM DM.',
    product_lines: ['ALL'],
    data_domains: ['PLATFORM'],
    super_tools: ['SUPER_PLATFORM_HEALTH', 'SUPER_SESSION_FORENSICS'],
    stages: [
      { type: 'SCRIPT', name: 'wire-platform-audit', project: 'services/learning-loop', detail: 'Platform health + session forensics + duplicate detection' },
      { type: 'SCRIPT', name: 'auto-cleanup', project: 'services/learning-loop', detail: 'Delete orphaned session-envs > 30 days, archive stale sprints' },
      { type: 'NOTIFICATION', name: 'Slack DM', detail: 'Cleanup report to JDM DM (U09BBHTN8F2)' },
    ],
  },
  {
    wire_id: 'WIRE_WARRIOR_BRIEFING',
    name: 'Warrior Briefing — Session Start',
    description:
      'Triggered on session start — check warrior context freshness, cross-warrior knowledge query, inject briefing into session.',
    product_lines: ['ALL'],
    data_domains: ['KNOWLEDGE'],
    super_tools: ['SUPER_WARRIOR_READINESS'],
    stages: [
      { type: 'SCRIPT', name: 'wire-warrior-briefing', project: 'services/learning-loop', detail: 'Warrior readiness + cross-warrior knowledge query' },
      { type: 'SCRIPT', name: 'session-start-hook', project: 'services/learning-loop/deploy/hooks', detail: 'Inject briefing into warrior session context' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Legacy compatibility — map v2 wires to old WireDefinition shape
// ---------------------------------------------------------------------------

export const WIRE_DEFINITIONS: WireDefinition[] = WIRE_DEFINITIONS_V2.map((v2) => ({
  wire_id: v2.wire_id,
  name: v2.name,
  product_line: v2.product_lines.join(','),
  data_domain: v2.data_domains.join(','),
  stages: v2.stages,
}))

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all wire definitions (v2 format).
 */
export function getWiresV2(filter?: {
  product_line?: string
  data_domain?: string
}): WireDefinitionV2[] {
  if (!filter) return WIRE_DEFINITIONS_V2
  return WIRE_DEFINITIONS_V2.filter((w) => {
    if (filter.product_line && !w.product_lines.includes(filter.product_line) && !w.product_lines.includes('ALL')) {
      return false
    }
    if (filter.data_domain && !w.data_domains.includes(filter.data_domain)) {
      return false
    }
    return true
  })
}

/**
 * Get all wire definitions (legacy v1 format for backward compatibility).
 */
export function getWires(filter?: { product_line?: string; data_domain?: string }): WireDefinition[] {
  if (!filter) return WIRE_DEFINITIONS
  return WIRE_DEFINITIONS.filter((w) => {
    if (filter.product_line && w.product_line !== filter.product_line && w.product_line !== 'ALL') return false
    if (filter.data_domain && w.data_domain !== filter.data_domain) return false
    return true
  })
}

/**
 * Get wire stats.
 */
export function getWireStats(): {
  totalWires: number
  totalStages: number
  totalSuperTools: number
  stageTypes: Record<string, number>
} {
  let totalStages = 0
  const stageTypes: Record<string, number> = {}
  const superToolSet = new Set<string>()

  for (const wire of WIRE_DEFINITIONS_V2) {
    totalStages += wire.stages.length
    for (const stage of wire.stages) {
      stageTypes[stage.type] = (stageTypes[stage.type] || 0) + 1
    }
    for (const st of wire.super_tools) {
      superToolSet.add(st)
    }
  }

  return {
    totalWires: WIRE_DEFINITIONS_V2.length,
    totalStages,
    totalSuperTools: superToolSet.size,
    stageTypes,
  }
}

/**
 * Get the super tool execution sequence for a wire.
 */
export function getWireSuperTools(wireId: string): string[] | null {
  const wire = WIRE_DEFINITIONS_V2.find((w) => w.wire_id === wireId)
  return wire ? wire.super_tools : null
}
