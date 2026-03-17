/**
 * QUE Seed Script — populates QUE engine reference data in Firestore:
 *
 * 1. que_profiles — 4 product-line quoting profiles
 * 2. que_sources — 11 quoting sources (APIs, portals, manual)
 * 3. que_output_templates — 7 output templates
 * 4. tool_registry — 6 ATLAS entries (4 super tools + 2 wires)
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-que.ts
 *   npx tsx services/api/src/scripts/seed-que.ts --dry-run
 *
 * Requires Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ============================================================================
// Types
// ============================================================================

interface QueProfile {
  profile_id: string
  profile_name: string
  product_line: string
  description: string
  source_ids: string[]
  comparison_algorithm: string
  output_template_ids: string[]
  solution_categories: string[]
  required_client_fields: string[]
  default_parameters: Record<string, string>
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

interface QueSource {
  que_source_id: string
  source_name: string
  product_lines: string[]
  adapter_type: 'api' | 'manual' | 'scrape'
  adapter_config: Record<string, unknown>
  input_schema: Record<string, string>
  output_schema: Record<string, string>
  automation_level: 'full' | 'semi' | 'manual'
  current_method: string
  target_method: string
  automation_pct: number
  gap_status: 'GREEN' | 'YELLOW' | 'RED'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

interface QueOutputTemplate {
  template_id: string
  template_name: string
  product_lines: string[]
  output_type: string
  data_mapping: Record<string, unknown>
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

interface AtlasToolEntry {
  id: string
  type: 'SUPER_TOOL' | 'WIRE'
  domain: string
  name: string
  description: string
  tools?: string[]
  super_tools?: string[]
  status: 'PLANNED' | 'ACTIVE' | 'DEPRECATED'
  created_at: string
  updated_at: string
}

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ID = 'claude-mcp-484718'
const BATCH_LIMIT = 400
const NOW = new Date().toISOString()

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

// ============================================================================
// QUE Profiles
// ============================================================================

const PROFILES: QueProfile[] = [
  {
    profile_id: 'QUE_LIFE',
    profile_name: 'Life Insurance Quoting',
    product_line: 'LIFE',
    description: 'Life insurance competitive analysis — WinFlex, carrier portals, in-force illustrations',
    source_ids: ['QSRC_WINFLEX', 'QSRC_FORESTERS', 'QSRC_KCL', 'QSRC_AMERITAS'],
    comparison_algorithm: 'best_value',
    output_template_ids: ['QOUT_COMPARISON_LIFE', 'QOUT_ILLUSTRATION'],
    solution_categories: ['ESTATE_MAX', 'INCOME_NOW', 'INCOME_LATER', 'LTC_MAX'],
    required_client_fields: ['dob', 'gender', 'state', 'tobacco_status'],
    default_parameters: {},
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    profile_id: 'QUE_ANNUITY',
    profile_name: 'Annuity Quoting',
    product_line: 'ANNUITY',
    description: 'Annuity competitive analysis — Annuity Rate Watch, carrier illustrations, income projections',
    source_ids: ['QSRC_ARW', 'QSRC_NASSAU', 'QSRC_INDEX_STD'],
    comparison_algorithm: 'best_value',
    output_template_ids: ['QOUT_COMPARISON_ANNUITY', 'QOUT_ILLUSTRATION'],
    solution_categories: ['INCOME_NOW', 'INCOME_LATER', 'GROWTH_MAX', 'ESTATE_MAX'],
    required_client_fields: ['dob', 'gender', 'state'],
    default_parameters: {},
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    profile_id: 'QUE_MEDICARE',
    profile_name: 'Medicare Quoting',
    product_line: 'MEDICARE',
    description: 'Medicare Supplement quoting — CSG Actuarial API, plan comparison',
    source_ids: ['QSRC_CSG'],
    comparison_algorithm: 'lowest_premium',
    output_template_ids: ['QOUT_COMPARISON_MEDICARE'],
    solution_categories: [],
    required_client_fields: ['dob', 'gender', 'zip', 'tobacco_status'],
    default_parameters: { plan_letter: 'G' },
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    profile_id: 'QUE_INVESTMENT',
    profile_name: 'Investment Analysis',
    product_line: 'INVESTMENT',
    description: 'Investment analysis — Nitrogen risk scoring, Signal Wealth reports, MoneyGuidePro',
    source_ids: ['QSRC_NITROGEN', 'QSRC_SIGNAL', 'QSRC_MGP'],
    comparison_algorithm: 'carrier_rated',
    output_template_ids: ['QOUT_ANALYSIS_INVEST'],
    solution_categories: ['GROWTH_MAX', 'INCOME_NOW', 'INCOME_LATER', 'ROTH_CONVERSION', 'TAX_HARVEST'],
    required_client_fields: ['dob', 'risk_tolerance'],
    default_parameters: {},
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
]

// ============================================================================
// QUE Sources
// ============================================================================

const SOURCES: QueSource[] = [
  {
    que_source_id: 'QSRC_CSG',
    source_name: 'CSG Actuarial Medicare Quoting',
    product_lines: ['MEDICARE'],
    adapter_type: 'api',
    adapter_config: { endpoint: 'https://que-api-r6j33zf47q-uc.a.run.app', auth_type: 'bearer_token' },
    input_schema: { zip: 'string', dob: 'string', gender: 'string', tobacco: 'boolean', plan_letter: 'string', effective_date: 'string' },
    output_schema: { carrier: 'string', plan_letter: 'string', monthly_premium: 'number', annual_premium: 'number', am_best_rating: 'string' },
    automation_level: 'full',
    current_method: 'API_FEED',
    target_method: 'API_FEED',
    automation_pct: 100,
    gap_status: 'GREEN',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_WINFLEX',
    source_name: 'WinFlex Life Insurance Quoting',
    product_lines: ['LIFE'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.winflexweb.com/ifx/clienteditor.aspx', prefill_fields: ['insured_name', 'age', 'gender', 'state', 'class', 'face_amount', 'premium'] },
    input_schema: { insured_name: 'string', age: 'number', gender: 'string', state: 'string', class: 'string', permanent_pct: 'string', face_amount: 'number', premium: 'number' },
    output_schema: { carrier: 'string', product: 'string', face_amount: 'number', premium_annual: 'number', guaranteed_years: 'number', cash_value_yr10: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PLAYWRIGHT_SCRAPE',
    automation_pct: 10,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_ARW',
    source_name: 'Annuity Rate Watch',
    product_lines: ['ANNUITY'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.annuityratewatch.com' },
    input_schema: { deposit_amount: 'number', term: 'number', product_type: 'string', state: 'string' },
    output_schema: { carrier: 'string', product: 'string', rate: 'number', guarantee_period: 'number', am_best_rating: 'string' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PLAYWRIGHT_SCRAPE',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_NITROGEN',
    source_name: 'Nitrogen / Riskalyze',
    product_lines: ['INVESTMENT'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://app.nitrogen.com' },
    input_schema: { portfolio_value: 'number', risk_tolerance: 'number' },
    output_schema: { risk_number: 'number', expected_return: 'number', downside_risk: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'API_FEED',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_SIGNAL',
    source_name: 'Signal Wealth Platform',
    product_lines: ['INVESTMENT'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://signal.com' },
    input_schema: { account_number: 'string', report_type: 'string' },
    output_schema: { report_url: 'string', performance_ytd: 'number', fees_total: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PLAYWRIGHT_SCRAPE',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_FORESTERS',
    source_name: 'Foresters Financial Portal',
    product_lines: ['LIFE'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.foresters.com/agent' },
    input_schema: { insured_name: 'string', age: 'number', gender: 'string', face_amount: 'number' },
    output_schema: { product: 'string', premium_annual: 'number', face_amount: 'number', cash_value_yr10: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'CARRIER_API',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_KCL',
    source_name: 'Kansas City Life Portal',
    product_lines: ['LIFE'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.kclife.com/agent' },
    input_schema: { insured_name: 'string', age: 'number', gender: 'string', face_amount: 'number' },
    output_schema: { product: 'string', premium_annual: 'number', face_amount: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PORTAL_PULL',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_AMERITAS',
    source_name: 'Ameritas In-Force Portal',
    product_lines: ['LIFE'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.ameritas.com/agent' },
    input_schema: { policy_number: 'string', insured_name: 'string' },
    output_schema: { product: 'string', face_amount: 'number', cash_value: 'number', premium_annual: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PLAYWRIGHT_SCRAPE',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_NASSAU',
    source_name: 'Nassau Carrier Portal',
    product_lines: ['ANNUITY'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://salesnet.nfg.com' },
    input_schema: { contract_number: 'string', annuitant_name: 'string' },
    output_schema: { product: 'string', account_value: 'number', benefit_base: 'number', gmib_amount: 'number', rollup_rate: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PLAYWRIGHT_SCRAPE',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_INDEX_STD',
    source_name: 'The Index Standard',
    product_lines: ['ANNUITY'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.theindexstandard.com' },
    input_schema: { product_type: 'string', carrier: 'string' },
    output_schema: { index_score: 'number', fee_score: 'number', carrier_rating: 'string' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PLAYWRIGHT_SCRAPE',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    que_source_id: 'QSRC_MGP',
    source_name: 'MoneyGuidePro',
    product_lines: ['INVESTMENT'],
    adapter_type: 'manual',
    adapter_config: { manual_url: 'https://www.moneyguidepro.com' },
    input_schema: { client_name: 'string', retirement_age: 'number', income_need: 'number' },
    output_schema: { probability_of_success: 'number', recommended_savings_rate: 'number' },
    automation_level: 'manual',
    current_method: 'PORTAL_PULL',
    target_method: 'PORTAL_PULL',
    automation_pct: 0,
    gap_status: 'RED',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
]

// ============================================================================
// QUE Output Templates
// ============================================================================

const OUTPUT_TEMPLATES: QueOutputTemplate[] = [
  { template_id: 'QOUT_COMPARISON_LIFE', template_name: 'Life Insurance Carrier Comparison', product_lines: ['LIFE'], output_type: 'comparison', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
  { template_id: 'QOUT_COMPARISON_ANNUITY', template_name: 'Annuity Competitive Comparison', product_lines: ['ANNUITY'], output_type: 'comparison', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
  { template_id: 'QOUT_COMPARISON_MEDICARE', template_name: 'Medicare Plan Comparison', product_lines: ['MEDICARE'], output_type: 'comparison', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
  { template_id: 'QOUT_ANALYSIS_INVEST', template_name: 'Investment Analysis Report', product_lines: ['INVESTMENT'], output_type: 'recommendation', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
  { template_id: 'QOUT_ILLUSTRATION', template_name: 'Product Illustration Package', product_lines: ['LIFE', 'ANNUITY'], output_type: 'illustration', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
  { template_id: 'QOUT_CASEWORK_SUMMARY', template_name: 'Casework Summary (Tier 1)', product_lines: ['LIFE', 'ANNUITY', 'MEDICARE', 'INVESTMENT'], output_type: 'summary', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
  { template_id: 'QOUT_FACTFINDER', template_name: 'RPI Factfinder', product_lines: ['LIFE', 'ANNUITY', 'MEDICARE', 'INVESTMENT'], output_type: 'factfinder', data_mapping: {}, status: 'active', created_at: NOW, updated_at: NOW },
]

// ============================================================================
// ATLAS Tool Registry Entries
// ============================================================================

const ATLAS_ENTRIES: AtlasToolEntry[] = [
  {
    id: 'QUE_GATHER',
    type: 'SUPER_TOOL',
    domain: 'que',
    name: 'QUE Gather',
    description: 'Pull household data + ACF documents + extract contract terms',
    tools: ['gather-household-data', 'gather-acf-documents', 'extract-contract-terms'],
    status: 'PLANNED',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'QUE_QUOTE',
    type: 'SUPER_TOOL',
    domain: 'que',
    name: 'QUE Quote',
    description: 'Execute quotes against registered sources (CSG, WinFlex, ARW, carriers)',
    tools: ['query-csg', 'query-winflex', 'query-arw', 'query-carrier-portal', 'query-nitrogen', 'query-signal'],
    status: 'PLANNED',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'QUE_COMPARE',
    type: 'SUPER_TOOL',
    domain: 'que',
    name: 'QUE Compare',
    description: 'Score, rank, and tax-adjust quotes for comparison',
    tools: ['compare-quotes', 'calc-tax-impact', 'calc-rollup-impact'],
    status: 'PLANNED',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'QUE_RECOMMEND',
    type: 'SUPER_TOOL',
    domain: 'que',
    name: 'QUE Recommend',
    description: 'Build recommendation + generate casework output + file to ACF',
    tools: ['build-recommendation', 'generate-comparison-html', 'file-to-acf'],
    status: 'PLANNED',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'WIRE_CASEWORK',
    type: 'WIRE',
    domain: 'que',
    name: 'Casework Wire',
    description: 'Complete Yellow Stage Phase 1: QUE_GATHER -> QUE_QUOTE -> QUE_COMPARE -> QUE_RECOMMEND',
    super_tools: ['QUE_GATHER', 'QUE_QUOTE', 'QUE_COMPARE', 'QUE_RECOMMEND'],
    status: 'PLANNED',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'WIRE_ASSEMBLE_B4',
    type: 'WIRE',
    domain: 'que',
    name: 'Assemble B4 Wire',
    description: 'Generate 5 Yellow Stage outputs and file to household ACF B4 Recommendations',
    super_tools: ['generate-ai3', 'collect-reports', 'collect-illustrations', 'generate-casework', 'generate-factfinder', 'html-to-pdf', 'file-to-acf'],
    status: 'PLANNED',
    created_at: NOW,
    updated_at: NOW,
  },
]

// ============================================================================
// Seed Functions
// ============================================================================

async function seedProfiles(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<number> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 1: Seeding que_profiles collection')
  console.log('='.repeat(60))

  console.log(`  Prepared ${PROFILES.length} profile documents`)

  if (dryRun) {
    console.log('  [DRY RUN] Would write:')
    for (const p of PROFILES) {
      console.log(`    que_profiles/${p.profile_id} (${p.profile_name} — ${p.source_ids.length} sources)`)
    }
    return PROFILES.length
  }

  const batch = db.batch()
  for (const p of PROFILES) {
    const ref = db.collection('que_profiles').doc(p.profile_id)
    batch.set(ref, p)
  }
  await batch.commit()
  console.log(`  Done: ${PROFILES.length} profile docs written`)
  return PROFILES.length
}

async function seedSources(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<number> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 2: Seeding que_sources collection')
  console.log('='.repeat(60))

  console.log(`  Prepared ${SOURCES.length} source documents`)

  if (dryRun) {
    console.log('  [DRY RUN] Would write:')
    for (const s of SOURCES) {
      console.log(`    que_sources/${s.que_source_id} (${s.source_name} — ${s.adapter_type}, ${s.automation_pct}% auto)`)
    }
    return SOURCES.length
  }

  const batch = db.batch()
  for (const s of SOURCES) {
    const ref = db.collection('que_sources').doc(s.que_source_id)
    batch.set(ref, s)
  }
  await batch.commit()
  console.log(`  Done: ${SOURCES.length} source docs written`)
  return SOURCES.length
}

async function seedOutputTemplates(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<number> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 3: Seeding que_output_templates collection')
  console.log('='.repeat(60))

  console.log(`  Prepared ${OUTPUT_TEMPLATES.length} template documents`)

  if (dryRun) {
    console.log('  [DRY RUN] Would write:')
    for (const t of OUTPUT_TEMPLATES) {
      console.log(`    que_output_templates/${t.template_id} (${t.template_name} — ${t.output_type})`)
    }
    return OUTPUT_TEMPLATES.length
  }

  const batch = db.batch()
  for (const t of OUTPUT_TEMPLATES) {
    const ref = db.collection('que_output_templates').doc(t.template_id)
    batch.set(ref, t)
  }
  await batch.commit()
  console.log(`  Done: ${OUTPUT_TEMPLATES.length} template docs written`)
  return OUTPUT_TEMPLATES.length
}

async function seedAtlasEntries(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<number> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 4: Seeding tool_registry (QUE super tools + wires)')
  console.log('='.repeat(60))

  console.log(`  Prepared ${ATLAS_ENTRIES.length} ATLAS entries`)

  if (dryRun) {
    console.log('  [DRY RUN] Would write:')
    for (const e of ATLAS_ENTRIES) {
      console.log(`    tool_registry/${e.id} (${e.name} — ${e.type})`)
    }
    return ATLAS_ENTRIES.length
  }

  const batch = db.batch()
  for (const e of ATLAS_ENTRIES) {
    const ref = db.collection('tool_registry').doc(e.id)
    batch.set(ref, e)
  }
  await batch.commit()
  console.log(`  Done: ${ATLAS_ENTRIES.length} ATLAS entries written`)
  return ATLAS_ENTRIES.length
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  // Initialize Firebase
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID })
  }
  const db = getFirestore()

  console.log(`\nQUE Seed Script${args.dryRun ? ' [DRY RUN]' : ''}`)
  console.log(`Tasks: que_profiles, que_sources, que_output_templates, tool_registry (QUE)`)

  const profileCount = await seedProfiles(db, args.dryRun)
  const sourceCount = await seedSources(db, args.dryRun)
  const templateCount = await seedOutputTemplates(db, args.dryRun)
  const atlasCount = await seedAtlasEntries(db, args.dryRun)

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Profiles:         ${profileCount}`)
  console.log(`  Sources:          ${sourceCount}`)
  console.log(`  Output Templates: ${templateCount}`)
  console.log(`  ATLAS Entries:    ${atlasCount}`)
  console.log(`  Total:            ${profileCount + sourceCount + templateCount + atlasCount} documents`)
  if (args.dryRun) console.log('\n  [DRY RUN] No writes were made.')
  console.log('')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
