/**
 * ATLAS Seed Script — Populates source_registry and tool_registry in Firestore.
 * Usage: npx tsx scripts/seed-atlas.ts
 *
 * Idempotent: checks if collections are already populated before seeding.
 * Source data ported from ATLAS_Seed.gs and ATLAS_ToolSeed.gs.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

const db = getFirestore()

// ---------------------------------------------------------------------------
// SOURCE REGISTRY SEED DATA (~74 sources)
// ---------------------------------------------------------------------------

const SOURCES = [
  // GREEN: AUTOMATED INTEGRATIONS
  { source_id: 'stateable-mapd', carrier_name: 'Stateable', product_line: 'MAPD', data_domain: 'COMMISSIONS', current_method: 'API_FEED', current_frequency: 'DAILY', gap_status: 'GREEN', automation_pct: 100, portal: 'B2C', priority: 'HIGH', notes: 'Automated commission feed' },
  { source_id: 'stateable-medsup', carrier_name: 'Stateable', product_line: 'MED_SUPP', data_domain: 'COMMISSIONS', current_method: 'API_FEED', current_frequency: 'DAILY', gap_status: 'GREEN', automation_pct: 100, portal: 'B2C', priority: 'HIGH', notes: 'Med Supp commission feed' },
  { source_id: 'stateable-fia', carrier_name: 'Stateable', product_line: 'FIA', data_domain: 'COMMISSIONS', current_method: 'API_FEED', current_frequency: 'DAILY', gap_status: 'GREEN', automation_pct: 100, portal: 'B2C', priority: 'HIGH', notes: 'FIA commission feed' },
  { source_id: 'stateable-life', carrier_name: 'Stateable', product_line: 'TERM_LIFE', data_domain: 'COMMISSIONS', current_method: 'API_FEED', current_frequency: 'DAILY', gap_status: 'GREEN', automation_pct: 100, portal: 'B2C', priority: 'MEDIUM', notes: 'Life commission feed' },
  { source_id: 'spark-mapd', carrier_name: 'SPARK', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'WEBHOOK', current_frequency: 'REALTIME', gap_status: 'GREEN', automation_pct: 100, portal: 'B2C', priority: 'HIGH', notes: 'Real-time MAPD enrollment' },
  { source_id: 'spark-medsup', carrier_name: 'SPARK', product_line: 'MED_SUPP', data_domain: 'ENROLLMENT', current_method: 'WEBHOOK', current_frequency: 'REALTIME', gap_status: 'GREEN', automation_pct: 100, portal: 'B2C', priority: 'HIGH', notes: 'Real-time Med Supp enrollment' },
  { source_id: 'phonevalidator', carrier_name: 'PhoneValidator', product_line: 'ALL', data_domain: 'VALIDATION', current_method: 'API_FEED', current_frequency: 'ON_DEMAND', gap_status: 'GREEN', automation_pct: 100, portal: 'ALL', priority: 'MEDIUM', notes: 'Phone validation API' },
  { source_id: 'neverbounce', carrier_name: 'NeverBounce', product_line: 'ALL', data_domain: 'VALIDATION', current_method: 'API_FEED', current_frequency: 'ON_DEMAND', gap_status: 'GREEN', automation_pct: 100, portal: 'ALL', priority: 'MEDIUM', notes: 'Email validation API' },
  { source_id: 'usps', carrier_name: 'USPS', product_line: 'ALL', data_domain: 'VALIDATION', current_method: 'API_FEED', current_frequency: 'ON_DEMAND', gap_status: 'GREEN', automation_pct: 100, portal: 'ALL', priority: 'MEDIUM', notes: 'Address validation API' },
  { source_id: 'google-meet', carrier_name: 'Google Meet', product_line: 'ALL', data_domain: 'DEMOGRAPHICS', current_method: 'API_FEED', current_frequency: 'REALTIME', gap_status: 'GREEN', automation_pct: 100, portal: 'ALL', priority: 'MEDIUM', notes: 'Meeting recordings + transcripts' },
  { source_id: 'twilio', carrier_name: 'Twilio', product_line: 'ALL', data_domain: 'DEMOGRAPHICS', current_method: 'API_FEED', current_frequency: 'REALTIME', gap_status: 'GREEN', automation_pct: 100, portal: 'ALL', priority: 'MEDIUM', notes: 'SMS/Voice communications' },
  { source_id: 'sendgrid', carrier_name: 'SendGrid', product_line: 'ALL', data_domain: 'DEMOGRAPHICS', current_method: 'API_FEED', current_frequency: 'REALTIME', gap_status: 'GREEN', automation_pct: 100, portal: 'ALL', priority: 'MEDIUM', notes: 'Email delivery' },

  // YELLOW: WORKING MANUAL FLOWS — Medicare BoB
  { source_id: 'wellmark-mapd', carrier_name: 'Wellmark', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'HIGH', notes: 'Monthly BoB CSV from portal' },
  { source_id: 'aetna-mapd', carrier_name: 'Aetna', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'HIGH', notes: 'Monthly BoB CSV from portal' },
  { source_id: 'uhc-mapd', carrier_name: 'UnitedHealthcare', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'HIGH', notes: 'Monthly BoB CSV from portal' },
  { source_id: 'humana-mapd', carrier_name: 'Humana', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'HIGH', notes: 'Monthly BoB CSV from portal' },
  { source_id: 'mutual-mapd', carrier_name: 'Mutual of Omaha', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'MEDIUM', notes: 'Monthly BoB CSV' },
  { source_id: 'bcbs-mapd', carrier_name: 'BCBS', product_line: 'MAPD', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'MEDIUM', notes: 'Monthly BoB CSV' },

  // YELLOW: Med Supp BoB
  { source_id: 'wellmark-medsup', carrier_name: 'Wellmark', product_line: 'MED_SUPP', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'HIGH', notes: 'Monthly Med Supp BoB' },
  { source_id: 'mutual-medsup', carrier_name: 'Mutual of Omaha', product_line: 'MED_SUPP', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'MEDIUM', notes: 'Monthly Med Supp BoB' },
  { source_id: 'bcbs-medsup', carrier_name: 'BCBS', product_line: 'MED_SUPP', data_domain: 'ENROLLMENT', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'MEDIUM', notes: 'Monthly Med Supp BoB' },

  // YELLOW: Life BoB
  { source_id: 'nationwide-life', carrier_name: 'Nationwide', product_line: 'TERM_LIFE', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'QUARTERLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'MEDIUM', notes: 'Quarterly life policy report' },
  { source_id: 'mutual-life', carrier_name: 'Mutual of Omaha', product_line: 'WHOLE_LIFE', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'QUARTERLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'MEDIUM', notes: 'Quarterly policy report' },
  { source_id: 'cof-life', carrier_name: 'Catholic Order of Foresters', product_line: 'WHOLE_LIFE', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'QUARTERLY', gap_status: 'YELLOW', automation_pct: 10, portal: 'B2C', priority: 'LOW', notes: 'CoF quarterly report' },

  // YELLOW: Annuity
  { source_id: 'athene-fia', carrier_name: 'Athene', product_line: 'FIA', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 20, portal: 'B2C', priority: 'HIGH', notes: 'FIA account statements' },
  { source_id: 'northamerican-fia', carrier_name: 'North American', product_line: 'FIA', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 20, portal: 'B2C', priority: 'HIGH', notes: 'FIA account statements' },
  { source_id: 'midland-fia', carrier_name: 'Midland National', product_line: 'FIA', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 20, portal: 'B2C', priority: 'MEDIUM', notes: 'FIA account statements' },

  // YELLOW: BD/RIA
  { source_id: 'schwab-bdria', carrier_name: 'Schwab', product_line: 'BDRIA', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 30, portal: 'B2C', priority: 'HIGH', notes: 'RIA custodian data' },
  { source_id: 'gradient-bdria', carrier_name: 'Gradient', product_line: 'BDRIA', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'HIGH', notes: 'BD custodian data' },
  { source_id: 'dst-bdria', carrier_name: 'DST Vision', product_line: 'BDRIA', data_domain: 'ACCOUNTS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 25, portal: 'B2C', priority: 'MEDIUM', notes: 'Mutual fund/VA aggregator' },

  // GREEN: Reference Data
  { source_id: 'naic-serff', carrier_name: 'NAIC/SERFF', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'BIGQUERY', current_frequency: 'MONTHLY', gap_status: 'GREEN', automation_pct: 80, portal: 'B2C', priority: 'HIGH', notes: 'BigQuery SERFF_MedSupp dataset, 1.18M rows' },
  { source_id: 'naic-registry', carrier_name: 'NAIC Carrier Registry', product_line: 'ALL', data_domain: 'DEMOGRAPHICS', current_method: 'API_FEED', current_frequency: 'AS_NEEDED', gap_status: 'GREEN', automation_pct: 80, portal: 'ALL', priority: 'MEDIUM', notes: 'Carrier NAIC code master' },

  // YELLOW/GREEN: Med Supp Rate Carriers
  { source_id: 'csg-medsup', carrier_name: 'CSG Actuarial', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'API_FEED', current_frequency: 'MONTHLY', gap_status: 'GREEN', automation_pct: 75, portal: 'B2C', priority: 'HIGH', notes: 'PRIMARY Med Supp quoting source' },
  { source_id: 'mutual-rates', carrier_name: 'Mutual of Omaha', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 20, portal: 'B2C', priority: 'MEDIUM', notes: 'Manual portal rate pull' },
  { source_id: 'aetna-rates', carrier_name: 'Aetna', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'MEDIUM', notes: 'Manual portal rate pull' },
  { source_id: 'allstate-rates', carrier_name: 'Allstate', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'LOW', notes: 'Manual portal rate pull' },
  { source_id: 'aflac-rates', carrier_name: 'AFLAC', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'LOW', notes: 'Manual portal rate pull' },
  { source_id: 'humana-rates', carrier_name: 'Humana', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'MEDIUM', notes: 'Manual portal rate pull' },
  { source_id: 'uhc-rates', carrier_name: 'UnitedHealthcare', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'MEDIUM', notes: 'Manual portal rate pull' },
  { source_id: 'wellmark-rates', carrier_name: 'Wellmark', product_line: 'MED_SUPP', data_domain: 'RATES', current_method: 'PORTAL_PULL', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 15, portal: 'B2C', priority: 'MEDIUM', notes: 'Manual portal rate pull' },

  // YELLOW: Commission sources
  { source_id: 'wellmark-comm', carrier_name: 'Wellmark', product_line: 'MAPD', data_domain: 'COMMISSIONS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 30, portal: 'B2C', priority: 'HIGH', notes: 'Monthly commission statement' },
  { source_id: 'humana-comm', carrier_name: 'Humana', product_line: 'MAPD', data_domain: 'COMMISSIONS', current_method: 'MANUAL_CSV', current_frequency: 'MONTHLY', gap_status: 'YELLOW', automation_pct: 30, portal: 'B2C', priority: 'HIGH', notes: 'Monthly commission statement' },

  // RED: Known Gaps
  { source_id: 'cof-details', carrier_name: 'Catholic Order of Foresters', product_line: 'WHOLE_LIFE', data_domain: 'ACCOUNTS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'LOW', notes: 'No electronic data access — manual only' },
  { source_id: 'wellmark-demographics', carrier_name: 'Wellmark', product_line: 'MAPD', data_domain: 'DEMOGRAPHICS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'MEDIUM', notes: 'No demographic feed from carrier' },
  { source_id: 'uhc-demographics', carrier_name: 'UnitedHealthcare', product_line: 'MAPD', data_domain: 'DEMOGRAPHICS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'MEDIUM', notes: 'No demographic feed from carrier' },
  { source_id: 'claims-data', carrier_name: 'Multiple', product_line: 'MAPD', data_domain: 'CLAIMS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'LOW', notes: 'No claims data from carriers yet' },
  { source_id: 'nipr-licensing', carrier_name: 'NIPR', product_line: 'ALL', data_domain: 'LICENSING', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2B', priority: 'MEDIUM', notes: 'Agent licensing data needed' },

  // RED: Future Integrations
  { source_id: 'dtcc-fia', carrier_name: 'DTCC', product_line: 'FIA', data_domain: 'ACCOUNTS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'HIGH', notes: 'DTCC feed for FIA accounts' },
  { source_id: 'dtcc-myga', carrier_name: 'DTCC', product_line: 'MYGA', data_domain: 'ACCOUNTS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'MEDIUM', notes: 'DTCC feed for MYGA accounts' },
  { source_id: 'dtcc-life', carrier_name: 'DTCC', product_line: 'TERM_LIFE', data_domain: 'ACCOUNTS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'MEDIUM', notes: 'DTCC feed for life policies' },
  { source_id: 'bluebutton-claims', carrier_name: 'Blue Button', product_line: 'MAPD', data_domain: 'CLAIMS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'LOW', notes: 'CMS Blue Button 2.0 API' },
  { source_id: 'schwab-api', carrier_name: 'Schwab', product_line: 'BDRIA', data_domain: 'ACCOUNTS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'HIGH', notes: 'Schwab API for real-time holdings' },
  { source_id: 'gradient-api', carrier_name: 'Gradient', product_line: 'BDRIA', data_domain: 'ACCOUNTS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'HIGH', notes: 'Gradient API for BD data' },
  { source_id: 'gradient-comm', carrier_name: 'Gradient', product_line: 'ALL', data_domain: 'COMMISSIONS', current_method: 'NOT_AVAILABLE', current_frequency: 'NONE', gap_status: 'RED', automation_pct: 0, portal: 'B2C', priority: 'HIGH', notes: 'Gradient commission feed (BD + RIA)' },
]

// ---------------------------------------------------------------------------
// TOOL REGISTRY SEED DATA (representative subset — full 150 too large for seed)
// ---------------------------------------------------------------------------

const TOOLS = [
  // INTAKE_QUEUING
  { tool_id: 'scan-spc-folders', tool_name: 'scanSpcFolders', source_project: 'services/intake', category: 'INTAKE_QUEUING', tool_type: 'FUNCTION', runnable: true, description: 'Scan specialist Drive folders for new documents' },
  { tool_id: 'scan-meet-recordings', tool_name: 'scanMeetRecordings', source_project: 'services/intake', category: 'INTAKE_QUEUING', tool_type: 'FUNCTION', runnable: true, description: 'Scan Google Meet recordings folder' },
  { tool_id: 'scan-mail-folder', tool_name: 'scanMailIntake', source_project: 'services/intake', category: 'INTAKE_QUEUING', tool_type: 'FUNCTION', runnable: true, description: 'Scan physical mail scan folder' },
  { tool_id: 'scan-email-inboxes', tool_name: 'scanEmailInboxes', source_project: 'services/intake', category: 'INTAKE_QUEUING', tool_type: 'FUNCTION', runnable: true, description: 'Scan configured email inboxes for attachments' },
  { tool_id: 'process-intake-queue', tool_name: 'processIntakeQueue', source_project: 'services/intake', category: 'INTAKE_QUEUING', tool_type: 'FUNCTION', runnable: true, description: 'Process items in intake queue' },
  { tool_id: 'watcher', tool_name: 'document-watcher', source_project: 'services/intake', category: 'INTAKE_QUEUING', tool_type: 'LAUNCHD', runnable: true, description: 'Always-on intake folder watcher' },

  // EXTRACTION_APPROVAL
  { tool_id: 'extract-data', tool_name: 'extractDataFromImages', source_project: 'services/intake', category: 'EXTRACTION_APPROVAL', tool_type: 'FUNCTION', runnable: true, description: 'Claude Vision extraction from document images' },
  { tool_id: 'classify-doc', tool_name: 'classifyDocument', source_project: 'services/intake', category: 'EXTRACTION_APPROVAL', tool_type: 'FUNCTION', runnable: true, description: 'AI document type classification' },
  { tool_id: 'create-approval', tool_name: 'createApprovalBatch', source_project: 'services/api', category: 'EXTRACTION_APPROVAL', tool_type: 'API_ENDPOINT', runnable: true, description: 'POST /api/approval/batches — create approval batch' },
  { tool_id: 'execute-approval', tool_name: 'executeApprovalBatch', source_project: 'services/api', category: 'EXTRACTION_APPROVAL', tool_type: 'API_ENDPOINT', runnable: true, description: 'POST /api/approval/batches/:id/execute — execute approved items' },

  // NORMALIZATION_VALIDATION
  { tool_id: 'normalize-carrier', tool_name: 'normalizeCarrierName', source_project: 'packages/core', category: 'NORMALIZATION_VALIDATION', tool_type: 'FUNCTION', runnable: false, description: 'Normalize carrier name to canonical form' },
  { tool_id: 'normalize-phone', tool_name: 'normalizePhone', source_project: 'packages/core', category: 'NORMALIZATION_VALIDATION', tool_type: 'FUNCTION', runnable: false, description: 'Normalize phone to 10-digit format' },
  { tool_id: 'normalize-date', tool_name: 'normalizeDate', source_project: 'packages/core', category: 'NORMALIZATION_VALIDATION', tool_type: 'FUNCTION', runnable: false, description: 'Normalize date to YYYY-MM-DD' },
  { tool_id: 'normalize-email', tool_name: 'normalizeEmail', source_project: 'packages/core', category: 'NORMALIZATION_VALIDATION', tool_type: 'FUNCTION', runnable: false, description: 'Lowercase and trim email' },
  { tool_id: 'normalize-state', tool_name: 'normalizeState', source_project: 'packages/core', category: 'NORMALIZATION_VALIDATION', tool_type: 'FUNCTION', runnable: false, description: 'Normalize state to 2-letter code' },
  { tool_id: 'validate-phone-api', tool_name: 'validatePhoneAPI', source_project: 'services/MCP-Hub', category: 'NORMALIZATION_VALIDATION', tool_type: 'MCP_TOOL', runnable: true, description: 'PhoneValidator API phone verification' },
  { tool_id: 'validate-email-api', tool_name: 'validateEmailAPI', source_project: 'services/MCP-Hub', category: 'NORMALIZATION_VALIDATION', tool_type: 'MCP_TOOL', runnable: true, description: 'NeverBounce email verification' },
  { tool_id: 'validate-address-api', tool_name: 'validateAddressAPI', source_project: 'services/MCP-Hub', category: 'NORMALIZATION_VALIDATION', tool_type: 'MCP_TOOL', runnable: true, description: 'USPS address standardization' },

  // MATCHING_DEDUP
  { tool_id: 'match-client', tool_name: 'matchClient', source_project: 'packages/core', category: 'MATCHING_DEDUP', tool_type: 'FUNCTION', runnable: false, description: 'Multi-factor client matching (name+DOB, name+phone, email)' },
  { tool_id: 'match-account', tool_name: 'matchAccount', source_project: 'packages/core', category: 'MATCHING_DEDUP', tool_type: 'FUNCTION', runnable: false, description: 'Account matching by policy number or carrier+client' },
  { tool_id: 'find-duplicates', tool_name: 'findDuplicates', source_project: 'packages/core', category: 'MATCHING_DEDUP', tool_type: 'FUNCTION', runnable: false, description: 'Find duplicate client clusters' },
  { tool_id: 'merge-records', tool_name: 'mergeRecords', source_project: 'packages/core', category: 'MATCHING_DEDUP', tool_type: 'FUNCTION', runnable: false, description: 'Merge duplicate client/account records' },

  // EXTERNAL_ENRICHMENT
  { tool_id: 'search-person', tool_name: 'search_person', source_project: 'services/MCP-Hub/rpi-workspace', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'WhitePages person search for demographics' },
  { tool_id: 'npi-search', tool_name: 'npi_search', source_project: 'services/MCP-Hub/rpi-healthcare', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'NPI registry provider search' },
  { tool_id: 'npi-lookup', tool_name: 'npi_lookup', source_project: 'services/MCP-Hub/rpi-healthcare', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'NPI registry full provider lookup' },
  { tool_id: 'search-plans', tool_name: 'search_plans_by_county', source_project: 'services/MCP-Hub/rpi-healthcare', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'CMS Medicare plan search by county' },
  { tool_id: 'compare-plans', tool_name: 'compare_plans', source_project: 'services/MCP-Hub/rpi-healthcare', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'Medicare plan comparison with cost analysis' },
  { tool_id: 'calc-commission', tool_name: 'calculate_commission', source_project: 'services/MCP-Hub/rpi-business', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'Commission calculation for carrier/product' },
  { tool_id: 'pivot-rate', tool_name: 'pivot_rate_lookup', source_project: 'services/MCP-Hub/rpi-healthcare', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'SERFF/BigQuery rate lookup by ZIP/age/carrier' },
  { tool_id: 'analyze-transcript', tool_name: 'analyze_transcript', source_project: 'services/MCP-Hub/rpi-business', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'AI meeting transcript analysis' },
  { tool_id: 'search-diagnosis', tool_name: 'search_diagnosis_codes', source_project: 'services/MCP-Hub/rpi-healthcare', category: 'EXTERNAL_ENRICHMENT', tool_type: 'MCP_TOOL', runnable: true, description: 'ICD-10-CM diagnosis code search' },

  // BULK_OPERATIONS
  { tool_id: 'fix-normalize-clients', tool_name: 'FIX_NormalizeClients', source_project: 'gas/RAPID_IMPORT', category: 'BULK_OPERATIONS', tool_type: 'FUNCTION', runnable: true, description: 'Bulk normalize all client records' },
  { tool_id: 'fix-carrier-names', tool_name: 'FIX_StandardizeCarrierNames', source_project: 'gas/RAPID_IMPORT', category: 'BULK_OPERATIONS', tool_type: 'FUNCTION', runnable: true, description: 'Standardize all carrier names' },
  { tool_id: 'fix-backfill-state', tool_name: 'FIX_BackfillState', source_project: 'gas/RAPID_IMPORT', category: 'BULK_OPERATIONS', tool_type: 'FUNCTION', runnable: true, description: 'Backfill missing state from ZIP codes' },
  { tool_id: 'fix-auto-merge', tool_name: 'FIX_AutoMergeClients', source_project: 'gas/RAPID_IMPORT', category: 'BULK_OPERATIONS', tool_type: 'FUNCTION', runnable: true, description: 'Auto-merge high-confidence duplicate clients' },
  { tool_id: 'debug-orphaned', tool_name: 'DEBUG_ListOrphanedAccounts', source_project: 'gas/RAPID_IMPORT', category: 'BULK_OPERATIONS', tool_type: 'FUNCTION', runnable: true, description: 'Find accounts without valid client references' },
  { tool_id: 'debug-field-coverage', tool_name: 'DEBUG_ClientFieldCoverage', source_project: 'gas/RAPID_IMPORT', category: 'BULK_OPERATIONS', tool_type: 'FUNCTION', runnable: true, description: 'Field completion % report for all clients' },
]

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('ATLAS Seed: Starting...')
  const now = new Date().toISOString()

  // Check if already seeded
  const sourcesSnap = await db.collection('source_registry').limit(1).get()
  const toolsSnap = await db.collection('tool_registry').limit(1).get()

  if (sourcesSnap.size > 0) {
    console.log(`source_registry already has ${sourcesSnap.size}+ docs — skipping source seed`)
  } else {
    console.log(`Seeding ${SOURCES.length} sources...`)
    const batch = db.batch()
    for (const source of SOURCES) {
      const ref = db.collection('source_registry').doc(source.source_id)
      batch.set(ref, { ...source, status: 'ACTIVE', created_at: now, updated_at: now })
    }
    await batch.commit()
    console.log(`Seeded ${SOURCES.length} sources`)
  }

  if (toolsSnap.size > 0) {
    console.log(`tool_registry already has ${toolsSnap.size}+ docs — skipping tool seed`)
  } else {
    console.log(`Seeding ${TOOLS.length} tools...`)
    const batch = db.batch()
    for (const tool of TOOLS) {
      const ref = db.collection('tool_registry').doc(tool.tool_id)
      batch.set(ref, { ...tool, status: 'ACTIVE', created_at: now, updated_at: now })
    }
    await batch.commit()
    console.log(`Seeded ${TOOLS.length} tools`)
  }

  console.log('ATLAS Seed: Complete')
}

main().catch(console.error)
