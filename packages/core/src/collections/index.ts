/**
 * TABLE_ROUTING — maps every MATRIX tab to its platform.
 * Ported from CORE_Database.gs TABLE_ROUTING (lines 53-147).
 *
 * In GAS, this routes reads/writes to the correct Sheets spreadsheet.
 * In toMachina, this maps to Firestore collection routing and bridge service config.
 */

export type Platform = 'RAPID' | 'SENTINEL' | 'PRODASH'

export const TABLE_ROUTING: Record<string, Platform> = {
  // === PRODASH (B2C) — Client/Account data ===
  '_CLIENT_MASTER': 'PRODASH',
  '_ACCOUNT_ANNUITY': 'PRODASH',
  '_ACCOUNT_LIFE': 'PRODASH',
  '_ACCOUNT_MEDICARE': 'PRODASH',
  '_ACCOUNT_INVESTMENTS': 'PRODASH',
  '_ACCOUNT_BANKING': 'PRODASH',
  '_ACCOUNT_MASTER': 'PRODASH',
  '_INTAKE_QUEUE': 'PRODASH',
  '_PIPELINES': 'PRODASH',
  '_OPPORTUNITIES': 'PRODASH',
  '_RELATIONSHIPS': 'PRODASH',
  '_ACTIVITY_LOG': 'PRODASH',
  '_PERMISSIONS': 'PRODASH',
  '_CASE_TASKS': 'PRODASH',

  // === SENTINEL (B2B) — Producer/Deal data ===
  '_AGENT_MASTER': 'SENTINEL',
  '_PRODUCER_MASTER': 'SENTINEL',
  'Opportunities': 'SENTINEL',
  '_REVENUE_MASTER': 'SENTINEL',

  // === RAPID (Shared) — Reference/Taxonomy data ===
  '_CARRIER_MASTER': 'RAPID',
  '_PRODUCT_MASTER': 'RAPID',
  '_IMO_MASTER': 'RAPID',
  '_ACCOUNT_TYPE_MASTER': 'RAPID',
  '_TRANSACTION_MASTER': 'RAPID',
  '_MAPD_COMP_GRID': 'RAPID',
  '_LIFE_COMP_GRID': 'RAPID',
  '_ANNUITY_COMP_GRID': 'RAPID',
  '_MEDSUP_COMP_GRID': 'RAPID',
  '_CMS_PLANS_2026': 'RAPID',
  '_SPECIALIST_FOLDERS': 'RAPID',
  '_DOCUMENT_TAXONOMY': 'RAPID',
  '_TAXONOMY_SUGGESTIONS': 'RAPID',
  '_EXTRACTION_TRAINING': 'RAPID',
  '_RECONCILIATION_LOG': 'RAPID',
  '_AI_ANALYTICS': 'RAPID',

  // === ADMIN TABS (RAPID) — User/Org hierarchy ===
  '_USER_HIERARCHY': 'RAPID',
  '_COMPANY_STRUCTURE': 'RAPID',
  '_PIPELINE_CONFIG': 'RAPID',

  // === CAMPAIGN ENGINE (PRODASH) ===
  '_CONTENT_BLOCKS': 'PRODASH',
  '_TEMPLATES': 'PRODASH',
  '_CAMPAIGNS': 'PRODASH',
  '_BOB_CONFIG': 'PRODASH',
  '_BOB_CAMPAIGNS': 'PRODASH',
  '_CAMPAIGN_LOG': 'PRODASH',
  '_CAMPAIGN_SEND_LOG': 'PRODASH',
  '_CAMPAIGN_ENROLLMENTS': 'PRODASH',
  '_QUEUED_SENDS': 'PRODASH',

  // === CONTACTS + COMMUNICATIONS ===
  '_CONTACTS_CARRIERS': 'RAPID',
  '_CONTACTS_IMOS': 'RAPID',
  '_CONTACTS_INTERNAL': 'RAPID',
  '_COMMUNICATION_LOG': 'RAPID',
  '_INTEGRATION_STATUS': 'RAPID',

  // === ATLAS (Source of Truth Registry) ===
  '_SOURCE_REGISTRY': 'RAPID',
  '_SOURCE_TASKS': 'RAPID',
  '_SOURCE_HISTORY': 'RAPID',
  '_SOURCE_METRICS': 'RAPID',
  '_TOOL_REGISTRY': 'RAPID',
  '_PIPELINE_STATUS': 'RAPID',
  '_AUTOMATION_REGISTRY': 'RAPID',

  // === BOOKING ENGINE ===
  '_BOOKING_LOG': 'RAPID',

  // === ROLE TEMPLATES ===
  '_ROLE_TEMPLATES': 'RAPID',

  // === AUTOMATION RULES ENGINE ===
  '_AUTOMATION_RULES': 'RAPID',

  // === SERFF RATE ACTIONS ===
  '_RATE_ACTIONS': 'RAPID',

  // === RAPID_FLOW (Universal Workflow Engine) ===
  '_FLOW_PIPELINES': 'RAPID',
  '_FLOW_STAGES': 'RAPID',
  '_FLOW_WORKFLOWS': 'RAPID',
  '_FLOW_STEPS': 'RAPID',
  '_FLOW_TASK_TEMPLATES': 'RAPID',
  '_FLOW_INSTANCES': 'RAPID',
  '_FLOW_INSTANCE_TASKS': 'RAPID',
  '_FLOW_ACTIVITY': 'RAPID',
}

/**
 * Get the platform for a given table name.
 * Defaults to RAPID for unknown tables (same as GAS).
 */
export function getTablePlatform(tabName: string): Platform {
  return TABLE_ROUTING[tabName] || 'RAPID'
}

/**
 * Get list of tables available on a platform.
 */
export function getTablesForPlatform(platform: Platform): string[] {
  return Object.entries(TABLE_ROUTING)
    .filter(([, p]) => p === platform)
    .map(([tab]) => tab)
}

/**
 * Firestore collection name mapping.
 * Maps MATRIX tab names to Firestore collection paths.
 */
export const FIRESTORE_COLLECTIONS: Record<string, string> = {
  '_CLIENT_MASTER': 'clients',
  '_ACCOUNT_ANNUITY': 'clients/{client_id}/accounts',
  '_ACCOUNT_LIFE': 'clients/{client_id}/accounts',
  '_ACCOUNT_MEDICARE': 'clients/{client_id}/accounts',
  '_ACCOUNT_INVESTMENTS': 'clients/{client_id}/accounts',
  '_ACCOUNT_BANKING': 'clients/{client_id}/accounts',
  '_AGENT_MASTER': 'agents',
  '_PRODUCER_MASTER': 'producers',
  '_OPPORTUNITIES': 'opportunities',
  'Opportunities': 'opportunities',
  '_REVENUE_MASTER': 'revenue',
  '_CARRIER_MASTER': 'carriers',
  '_PRODUCT_MASTER': 'products',
  '_USER_HIERARCHY': 'users',
  '_COMPANY_STRUCTURE': 'org',
  '_CAMPAIGNS': 'campaigns',
  '_TEMPLATES': 'templates',
  '_CONTENT_BLOCKS': 'content_blocks',
  '_FLOW_PIPELINES': 'flow/pipelines',
  '_FLOW_INSTANCES': 'flow/instances',
  '_SOURCE_REGISTRY': 'atlas/sources',
  '_MAPD_COMP_GRID': 'comp_grids/mapd',
  '_LIFE_COMP_GRID': 'comp_grids/life',
  '_ANNUITY_COMP_GRID': 'comp_grids/annuity',
  '_MEDSUP_COMP_GRID': 'comp_grids/medsup',
  '_CASE_TASKS': 'case_tasks',
  '_COMMUNICATION_LOG': 'communications',
  '_ACTIVITY_LOG': 'clients/{client_id}/activities',
  '_RELATIONSHIPS': 'clients/{client_id}/relationships',
  '_PIPELINES': 'pipelines',
}

/** Get the Firestore collection path for a MATRIX tab. */
export function getFirestoreCollection(tabName: string): string | null {
  return FIRESTORE_COLLECTIONS[tabName] || null
}
