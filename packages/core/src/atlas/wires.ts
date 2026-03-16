// ---------------------------------------------------------------------------
// ATLAS Wire Definitions — data flow paths through The Machine
// Ported from ATLAS_Wires.gs WIRE_DEFINITIONS constant
// ---------------------------------------------------------------------------

import type { WireDefinition } from './types'

export const WIRE_DEFINITIONS: WireDefinition[] = [
  {
    wire_id: 'WIRE_MAPD_ENROLLMENT',
    name: 'Medicare Advantage Enrollment',
    product_line: 'MAPD',
    data_domain: 'ENROLLMENT',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier CSV Drop', detail: 'Carrier enrollment file arrives via email or portal' },
      { type: 'LAUNCHD', name: 'scanMailFolder', project: 'services/intake', detail: 'Mail intake scanner detects new files' },
      { type: 'SCRIPT', name: 'extractDataFromImages', project: 'services/intake', detail: 'Claude Vision extracts fields from document' },
      { type: 'API_ENDPOINT', name: 'POST /api/approval/batches', project: 'services/api', detail: 'Creates approval batch for review' },
      { type: 'FRONTEND', name: 'Approval Review', platform: 'ProDashX', view: '/approval', detail: 'Specialist reviews and approves fields' },
      { type: 'API_ENDPOINT', name: 'POST /api/approval/execute', project: 'services/api', detail: 'Writes approved data to Firestore' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', detail: 'Client record created/updated' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_MEDICARE', detail: 'Medicare account created/updated' },
      { type: 'FRONTEND', name: 'CLIENT360', platform: 'ProDashX', view: '/clients/[id]', detail: 'Client visible in ProDashX' },
    ],
  },
  {
    wire_id: 'WIRE_COMMISSION_SYNC',
    name: 'Commission Statement Processing',
    product_line: 'ALL',
    data_domain: 'COMMISSIONS',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Commission Statement', detail: 'Commission CSV/PDF from carrier or IMO' },
      { type: 'LAUNCHD', name: 'scanSpcFolders', project: 'services/intake', detail: 'SPC intake scanner picks up statement' },
      { type: 'SCRIPT', name: 'extractDataFromImages', project: 'services/intake', detail: 'AI extraction of commission rows' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Field-level approval workflow' },
      { type: 'MATRIX_TAB', name: '_REVENUE_MASTER', detail: 'Revenue records created' },
      { type: 'FRONTEND', name: 'CAM Dashboard', platform: 'All Portals', view: '/modules/cam', detail: 'Revenue visible in CAM' },
    ],
  },
  {
    wire_id: 'WIRE_DOC_INTAKE_MAIL',
    name: 'Physical Mail Document Intake',
    product_line: 'ALL',
    data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Physical Mail Scanned', detail: 'Scanned document placed in intake folder' },
      { type: 'LAUNCHD', name: 'scanMailFolder', project: 'services/intake', detail: 'Mail intake detects new scan' },
      { type: 'SCRIPT', name: 'classifyDocument', project: 'services/intake', detail: 'AI classifies document type' },
      { type: 'SCRIPT', name: 'extractDataFromImages', project: 'services/intake', detail: 'AI extracts fields' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Approval workflow' },
      { type: 'MATRIX_TAB', name: 'Target Tab', detail: 'Data written to appropriate collection' },
      { type: 'FRONTEND', name: 'CLIENT360', platform: 'ProDashX', detail: 'Data visible in client profile' },
    ],
  },
  {
    wire_id: 'WIRE_DOC_INTAKE_EMAIL',
    name: 'Email Document Intake',
    product_line: 'ALL',
    data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Email with Attachment', detail: 'Email arrives at intake inbox' },
      { type: 'LAUNCHD', name: 'scanEmailInboxes', project: 'services/intake', detail: 'Email scanner extracts attachments' },
      { type: 'SCRIPT', name: 'classifyDocument', project: 'services/intake', detail: 'AI classifies attachment' },
      { type: 'SCRIPT', name: 'extractDataFromImages', project: 'services/intake', detail: 'AI extracts fields' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Approval workflow' },
      { type: 'MATRIX_TAB', name: 'Target Tab', detail: 'Data written to appropriate collection' },
      { type: 'FRONTEND', name: 'CLIENT360', platform: 'ProDashX', detail: 'Data visible in client profile' },
    ],
  },
  {
    wire_id: 'WIRE_CLIENT_ENRICHMENT',
    name: 'Client Demographic Enrichment',
    product_line: 'ALL',
    data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', detail: 'Client record with gaps' },
      { type: 'MCP_TOOL', name: 'search_person', server: 'rpi-workspace', detail: 'WhitePages person lookup' },
      { type: 'MCP_TOOL', name: 'validate_npi', server: 'rpi-healthcare', detail: 'NPI validation for providers' },
      { type: 'API_ENDPOINT', name: 'PATCH /api/clients/:id', project: 'services/api', detail: 'Update client with enriched data' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', detail: 'Client record enriched' },
      { type: 'FRONTEND', name: 'CLIENT360', platform: 'ProDashX', detail: 'Enriched data visible' },
    ],
  },
  {
    wire_id: 'WIRE_VALIDATION_PIPELINE',
    name: 'Contact Validation Pipeline',
    product_line: 'ALL',
    data_domain: 'VALIDATION',
    stages: [
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', detail: 'Client records to validate' },
      { type: 'MCP_TOOL', name: 'validatePhoneAPI', server: 'rpi-workspace', detail: 'Phone validation via PhoneValidator' },
      { type: 'MCP_TOOL', name: 'validateEmailAPI', server: 'rpi-workspace', detail: 'Email validation via NeverBounce' },
      { type: 'MCP_TOOL', name: 'validateAddressAPI', server: 'rpi-workspace', detail: 'Address validation via USPS' },
      { type: 'API_ENDPOINT', name: 'PATCH /api/clients/:id', project: 'services/api', detail: 'Update validation flags' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', detail: 'Validation flags set' },
    ],
  },
  // WIRE_NPI_LOOKUP — REMOVED 2026-03-15.
  // NPI (National Provider Identifier) is for HEALTHCARE PROVIDERS (doctors, nurses, facilities).
  // NPN (National Producer Number) is for INSURANCE PRODUCERS (agents, brokers).
  // These are completely different registries:
  //   NPI → CMS NPPES → used in QUE-Medicare client workflows
  //   NPN → NIPR (state insurance depts) → used in producer licensing/contracting (LC3)
  // The old wire incorrectly used NPI tools to look up producers by NPN. It never worked
  // because producers aren't healthcare providers.
  //
  // TODO: Replace with WIRE_NIPR_LOOKUP — a proper producer licensing wire that:
  //   1. Takes NPN from producer/agent record
  //   2. Queries NIPR PDB (Producer Database) for licensing status
  //   3. Returns: state licenses, carrier appointments, license expiration dates
  //   4. Updates LC3 subcollection on the user doc (when LC3 module is built)
  //   Source: https://npn-lookup.app.nipr.com/npn-lookup/PacNpnSearch.htm
  {
    wire_id: 'WIRE_MAPD_QUOTING',
    name: 'Medicare Plan Quoting',
    product_line: 'MAPD',
    data_domain: 'ENROLLMENT',
    stages: [
      { type: 'FRONTEND', name: 'QUE Medicare', platform: 'ProDashX', view: '/sales-centers/medicare', detail: 'Agent enters client ZIP/age' },
      { type: 'API_ENDPOINT', name: 'GET /api/medicare-quote', project: 'services/api', detail: 'Fetch available plans' },
      { type: 'MCP_TOOL', name: 'search_plans_by_county', server: 'rpi-healthcare', detail: 'CMS plan database query' },
      { type: 'MCP_TOOL', name: 'compare_plans', server: 'rpi-healthcare', detail: 'Plan comparison with costs' },
      { type: 'FRONTEND', name: 'Plan Comparison', platform: 'ProDashX', detail: 'Agent reviews plan options' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_MEDICARE', detail: 'Selected plan written to account' },
    ],
  },
  {
    wire_id: 'WIRE_LIFE_ANNUITY_ACCOUNTS',
    name: 'Life & Annuity Account Processing',
    product_line: 'FIA',
    data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Statement/App', detail: 'Account document arrives' },
      { type: 'LAUNCHD', name: 'Intake Scanner', project: 'services/intake', detail: 'Document detected and queued' },
      { type: 'SCRIPT', name: 'extractDataFromImages', project: 'services/intake', detail: 'AI extracts policy details' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Field-level approval' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_ANNUITY / _ACCOUNT_LIFE', detail: 'Account record created' },
      { type: 'FRONTEND', name: 'CLIENT360 Accounts', platform: 'ProDashX', detail: 'Account visible in client profile' },
    ],
  },
  {
    wire_id: 'WIRE_BDRIA_ACCOUNTS',
    name: 'BD/RIA Account Processing',
    product_line: 'BDRIA',
    data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Custodian Feed', detail: 'Schwab/RBC/DST account data' },
      { type: 'SCRIPT', name: 'Intake Processing', project: 'services/intake', detail: 'CSV parsing and normalization' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Approval workflow' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_BDRIA', detail: 'BD/RIA account created' },
      { type: 'FRONTEND', name: 'CLIENT360 Accounts', platform: 'ProDashX', detail: 'Account visible' },
    ],
  },
  {
    wire_id: 'WIRE_AGENT_MANAGEMENT',
    name: 'Agent Record Management',
    product_line: 'ALL',
    data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'EXTERNAL', name: 'Agent Application', detail: 'New agent onboarding or update' },
      { type: 'FRONTEND', name: 'DAVID HUB', platform: 'SENTINEL', view: '/modules/david-hub', detail: 'Agent entered via SENTINEL' },
      { type: 'API_ENDPOINT', name: 'POST /api/agents', project: 'services/api', detail: 'Create agent record' },
      { type: 'MATRIX_TAB', name: '_PRODUCER_MASTER', detail: 'Agent record created' },
      { type: 'FRONTEND', name: 'Producers', platform: 'SENTINEL', view: '/producers', detail: 'Agent visible in SENTINEL' },
    ],
  },
  {
    wire_id: 'WIRE_MEETING_PROCESSING',
    name: 'Meeting Transcript Analysis',
    product_line: 'ALL',
    data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'EXTERNAL', name: 'Google Meet Recording', detail: 'Meeting recording with transcript' },
      { type: 'LAUNCHD', name: 'scanMeetRecordings', project: 'services/intake', detail: 'Meet intake detects recording' },
      { type: 'MCP_TOOL', name: 'analyze_transcript', server: 'rpi-business', detail: 'AI transcript analysis' },
      { type: 'API_ENDPOINT', name: 'Approval Pipeline', project: 'services/api', detail: 'Extracted data approval' },
      { type: 'MATRIX_TAB', name: '_CLIENT_MASTER', detail: 'Client data from meeting captured' },
      { type: 'FRONTEND', name: 'CLIENT360 Activity', platform: 'ProDashX', detail: 'Meeting logged in activity' },
    ],
  },
  {
    wire_id: 'WIRE_PORTAL_PRODASHX',
    name: 'ProDashX Portal Stack (B2C)',
    product_line: 'ALL',
    data_domain: 'ENROLLMENT',
    stages: [
      { type: 'FRONTEND', name: 'ProDashX', platform: 'ProDashX', view: '/', detail: 'B2C client portal' },
      { type: 'FRONTEND', name: 'CLIENT360', platform: 'ProDashX', view: '/clients/[id]', detail: '11-tab client detail' },
      { type: 'FRONTEND', name: 'RMD Center', platform: 'ProDashX', view: '/service-centers/rmd', detail: 'IRS RMD calculator' },
      { type: 'FRONTEND', name: 'Beni Center', platform: 'ProDashX', view: '/service-centers/beni', detail: 'Beneficiary review' },
      { type: 'FRONTEND', name: 'QUE Medicare', platform: 'ProDashX', view: '/sales-centers/medicare', detail: 'Plan quoting' },
      { type: 'FRONTEND', name: 'CAM', platform: 'All Portals', view: '/modules/cam', detail: 'Commission accounting' },
      { type: 'FRONTEND', name: 'C3', platform: 'All Portals', view: '/modules/c3', detail: 'Campaign engine' },
      { type: 'FRONTEND', name: 'DEX', platform: 'All Portals', view: '/modules/dex', detail: 'Document center' },
      { type: 'FRONTEND', name: 'ATLAS', platform: 'All Portals', view: '/modules/atlas', detail: 'Source intelligence' },
      { type: 'FRONTEND', name: 'Command Center', platform: 'All Portals', view: '/modules/command-center', detail: 'Leadership dashboard' },
      { type: 'FRONTEND', name: 'Connect', platform: 'All Portals', view: '/connect', detail: 'Communications hub' },
    ],
  },
  {
    wire_id: 'WIRE_PORTAL_SENTINEL',
    name: 'SENTINEL Portal Stack (B2B)',
    product_line: 'ALL',
    data_domain: 'ACCOUNTS',
    stages: [
      { type: 'FRONTEND', name: 'SENTINEL', platform: 'SENTINEL', view: '/', detail: 'B2B deal portal' },
      { type: 'FRONTEND', name: 'Deals Kanban', platform: 'SENTINEL', view: '/deals', detail: 'Deal pipeline' },
      { type: 'FRONTEND', name: 'Producers', platform: 'SENTINEL', view: '/producers', detail: 'Producer directory' },
      { type: 'FRONTEND', name: 'Analysis', platform: 'SENTINEL', view: '/analysis', detail: 'Revenue analysis' },
      { type: 'FRONTEND', name: 'Market Intel', platform: 'SENTINEL', view: '/market-intel', detail: 'Agent/carrier browser' },
      { type: 'FRONTEND', name: 'DAVID HUB', platform: 'SENTINEL', view: '/modules/david-hub', detail: 'M&A calculators' },
      { type: 'FRONTEND', name: 'CAM', platform: 'All Portals', view: '/modules/cam', detail: 'Commission accounting' },
      { type: 'FRONTEND', name: 'C3', platform: 'All Portals', view: '/modules/c3', detail: 'Campaign engine' },
      { type: 'FRONTEND', name: 'ATLAS', platform: 'All Portals', view: '/modules/atlas', detail: 'Source intelligence' },
      { type: 'FRONTEND', name: 'Command Center', platform: 'All Portals', view: '/modules/command-center', detail: 'Leadership dashboard' },
    ],
  },
  {
    wire_id: 'WIRE_PORTAL_RIIMO',
    name: 'RIIMO Portal Stack (B2E)',
    product_line: 'ALL',
    data_domain: 'DEMOGRAPHICS',
    stages: [
      { type: 'FRONTEND', name: 'RIIMO', platform: 'RIIMO', view: '/', detail: 'B2E operations portal' },
      { type: 'FRONTEND', name: 'Ops Dashboard', platform: 'RIIMO', view: '/dashboard', detail: 'Cross-platform overview' },
      { type: 'FRONTEND', name: 'Tasks', platform: 'RIIMO', view: '/tasks', detail: 'Task management' },
      { type: 'FRONTEND', name: 'Pipelines', platform: 'RIIMO', view: '/pipelines', detail: 'Workflow pipelines' },
      { type: 'FRONTEND', name: 'Org Admin', platform: 'RIIMO', view: '/org-admin', detail: 'Company structure' },
      { type: 'FRONTEND', name: 'Intelligence', platform: 'RIIMO', view: '/intelligence', detail: 'AI analytics' },
      { type: 'FRONTEND', name: 'CAM', platform: 'All Portals', view: '/modules/cam', detail: 'Commission accounting' },
      { type: 'FRONTEND', name: 'C3', platform: 'All Portals', view: '/modules/c3', detail: 'Campaign engine' },
      { type: 'FRONTEND', name: 'DEX', platform: 'All Portals', view: '/modules/dex', detail: 'Document center' },
      { type: 'FRONTEND', name: 'ATLAS', platform: 'All Portals', view: '/modules/atlas', detail: 'Source intelligence' },
      { type: 'FRONTEND', name: 'Command Center', platform: 'All Portals', view: '/modules/command-center', detail: 'Leadership dashboard' },
    ],
  },
  {
    wire_id: 'WIRE_MEDICARE_ACCOUNTS',
    name: 'Medicare Account Processing',
    product_line: 'MAPD',
    data_domain: 'ACCOUNTS',
    stages: [
      { type: 'EXTERNAL', name: 'Carrier Medicare Export', detail: 'CSV from carrier/IMO with Medicare account data' },
      { type: 'API_ENDPOINT', name: 'POST /api/atlas/introspect', project: 'services/api', detail: 'Column mapping via introspection engine' },
      { type: 'SCRIPT', name: 'normalizeData()', project: 'packages/core', detail: 'Apply field normalizers to all mapped fields' },
      { type: 'API_ENDPOINT', name: 'POST /api/import/validate-full', project: 'services/api', detail: 'Dry run validation before commit' },
      { type: 'SCRIPT', name: 'matchClient() + matchAccount()', project: 'packages/core', detail: 'Dedup against existing records' },
      { type: 'API_ENDPOINT', name: 'POST /api/import/accounts', project: 'services/api', detail: 'Batch write Medicare accounts' },
      { type: 'MATRIX_TAB', name: '_ACCOUNT_MEDICARE', detail: 'account_category: medicare' },
      { type: 'FRONTEND', name: 'CLIENT360 Accounts', platform: 'ProDashX', view: '/contacts/[id]', detail: 'Medicare accounts visible in client profile' },
    ],
  },
  {
    wire_id: 'WIRE_NAIC_CARRIER_SEEDING',
    name: 'NAIC/SERFF Carrier Data Pipeline',
    product_line: 'MED_SUPP',
    data_domain: 'RATES',
    stages: [
      { type: 'EXTERNAL', name: 'SERFF Rate Filings', detail: 'State rate filings database' },
      { type: 'SCRIPT', name: 'load-serff.js', project: 'services/MCP-Hub', detail: 'Parse SERFF CSV into BigQuery' },
      { type: 'API_ENDPOINT', name: 'BigQuery', platform: 'GCP', detail: 'SERFF_MedSupp dataset (1.18M rows)' },
      { type: 'MCP_TOOL', name: 'pivot_rate_lookup', server: 'rpi-healthcare', detail: 'Rate lookup by ZIP/age/carrier' },
      { type: 'SCRIPT', name: 'FIX_SeedNAICCodes', project: 'services/MCP-Hub', detail: 'Carrier NAIC code population' },
      { type: 'MATRIX_TAB', name: 'NAIC Carrier Registry', detail: 'Carrier master updated' },
      { type: 'MCP_TOOL', name: 'get_annuity_rates', server: 'rpi-healthcare', detail: 'Rate API for Med Supp quoting' },
      { type: 'FRONTEND', name: 'QUE Medicare', platform: 'ProDashX', detail: 'Med Supp plan comparison' },
      { type: 'EXTERNAL', name: 'CSG Actuarial API', detail: 'Primary quoting source for Med Supp' },
    ],
  },
]

/**
 * Get all wire definitions.
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
export function getWireStats(): { totalWires: number; totalStages: number; stageTypes: Record<string, number> } {
  let totalStages = 0
  const stageTypes: Record<string, number> = {}

  for (const wire of WIRE_DEFINITIONS) {
    totalStages += wire.stages.length
    for (const stage of wire.stages) {
      stageTypes[stage.type] = (stageTypes[stage.type] || 0) + 1
    }
  }

  return { totalWires: WIRE_DEFINITIONS.length, totalStages, stageTypes }
}
