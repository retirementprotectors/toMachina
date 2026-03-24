/**
 * DEX Rules Seeder — 5-layer form selection rules
 *
 * Seeds the `dex_rules` Firestore collection with rules that map:
 *   platform + registration_type + action  -->  form_id arrays for 5 layers
 *
 * Logic extracted from DEX_Rules.gs evaluateRules(), _addSchwabForms(),
 * _addRBCForms(), and addDisclosures().
 *
 * Each rule document stores form_id arrays per layer:
 *   firm_client:     Form IDs always included at the client level
 *   firm_account:    TAF + IAA + L-Share (platform-dependent)
 *   product_forms:   Custodian/carrier-specific forms (registration + action dependent)
 *   supporting:      Trust docs, AdvisoryLink, etc.
 *   disclosures:     CRS, Privacy, ADV, 408(b)(2), etc.
 *
 * The rule_id format is: {platform_key}__{registration_key}__{action_key}
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-dex-rules.ts --all
 *   npx tsx services/api/src/scripts/seed-dex-rules.ts --all --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { COLLECTIONS, PLATFORMS, REGISTRATION_TYPES, ACCOUNT_ACTIONS } from '../../../../packages/core/src/dex/config'

// ============================================================================
// Constants
// ============================================================================

const BATCH_LIMIT = 500

// ============================================================================
// Form ID Constants (matching seed-dex-forms.ts)
// ============================================================================

const F = {
  COMRA: 'FORM_0001',
  CAF: 'FORM_0002',
  LEGAL_ENTITY_CAF: 'FORM_0003',
  GWM_TAF: 'FORM_0004',
  RBC_TAF: 'FORM_0005',
  VA_TAF: 'FORM_0006',
  FIA_TAF: 'FORM_0007',
  VUL_TAF: 'FORM_0008',
  MF_TAF: 'FORM_0009',
  REIT_TAF: 'FORM_0010',
  FP_TAF: 'FORM_0011',
  IAA: 'FORM_0012',
  L_SHARE_LETTER: 'FORM_0013',
  SCHWAB_LPOA: 'FORM_0014',
  SCHWAB_IRA_APP: 'FORM_0015',
  SCHWAB_ONE: 'FORM_0016',
  SCHWAB_ACAT: 'FORM_0017',
  SCHWAB_TOD: 'FORM_0018',
  SCHWAB_ACH: 'FORM_0019',
  SCHWAB_TRUST: 'FORM_0020',
  RBC_IRA_APP: 'FORM_0021',
  RBC_INDIV_JOINT: 'FORM_0022',
  RBC_TRUST: 'FORM_0023',
  RBC_TRANSFER: 'FORM_0024',
  RBC_BENE: 'FORM_0025',
  RBC_ACH: 'FORM_0026',
  GI_DISCLOSURE: 'FORM_0027',
  GI_PROPOSAL: 'FORM_0028',
  GI_SCHED_A: 'FORM_0029',
  GI_SCHED_B: 'FORM_0030',
  GI_SCHED_C: 'FORM_0031',
  GI_SCHED_D: 'FORM_0032',
  GI_SCHED_E: 'FORM_0033',
  GI_SCHED_F: 'FORM_0034',
  CARRIER_VA: 'FORM_0035',
  CARRIER_FIA: 'FORM_0036',
  CARRIER_VUL: 'FORM_0037',
  TRUST_CERT: 'FORM_0042',
  TRUST_COPY: 'FORM_0043',
  ADVISORY_LINK: 'FORM_0044',
  GS_CRS: 'FORM_0047',
  GI_PRIVACY: 'FORM_0048',
  GI_CRS: 'FORM_0049',
  GI_ADV: 'FORM_0050',
  DISCLOSURE_408: 'FORM_0051',
  ESTATE_INTAKE: 'FORM_0053',
  ESTATE_QUESTIONNAIRE: 'FORM_0054',
  ESTATE_BLUEPRINT: 'FORM_0055',
} as const

// ============================================================================
// TAF Mapping (platform -> TAF form ID)
// ============================================================================

const TAF_MAP: Record<string, string | null> = {
  'GWM (Schwab)': F.GWM_TAF,
  'RBC Brokerage': F.RBC_TAF,
  'VA (Direct)': F.VA_TAF,
  'FIA (Direct)': F.FIA_TAF,
  'VUL (Direct)': F.VUL_TAF,
  'MF (Direct)': F.MF_TAF,
  'REIT': F.REIT_TAF,
  '401k': F.FP_TAF,
  'Financial Planning': F.FP_TAF,
  'Estate Guru': null,
  'Medicare Advantage': null,
  'Medicare Supplement': null,
  'Part D': null,
}

// ============================================================================
// Rule Interfaces
// ============================================================================

interface DexRuleDoc {
  rule_id: string
  platform: string
  registration_type: string
  account_action: string
  firm_client: string[]
  firm_account: string[]
  product_forms: string[]
  supporting: string[]
  disclosures: string[]
  total_forms: number
  notes: string
  created_at: string
  updated_at: string
  _created_by: string
}

// ============================================================================
// Rule Builder
// ============================================================================

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
}

function buildRule(platform: string, registrationType: string, accountAction: string): DexRuleDoc | null {
  const now = new Date().toISOString()
  const ruleId = `${slugify(platform)}__${slugify(registrationType)}__${slugify(accountAction)}`

  const firmClient: string[] = []
  const firmAccount: string[] = []
  const productForms: string[] = []
  const supporting: string[] = []
  const disclosures: string[] = []

  // ---------------------------------------------------------------------------
  // Layer 1: Firm:Client
  // ---------------------------------------------------------------------------
  if (platform !== '401k') {
    firmClient.push(F.COMRA, F.CAF)
  } else {
    firmClient.push(F.LEGAL_ENTITY_CAF)
  }

  // ---------------------------------------------------------------------------
  // Layer 2: Firm:Account — TAF
  // ---------------------------------------------------------------------------
  const tafId = TAF_MAP[platform]
  if (tafId) {
    firmAccount.push(tafId)
  }

  // IAA for advisory platforms
  if (['GWM (Schwab)', 'RBC Brokerage', 'Financial Planning'].includes(platform)) {
    firmAccount.push(F.IAA)
  }

  // ---------------------------------------------------------------------------
  // Layer 3: Product Forms — Platform + Registration + Action dependent
  // ---------------------------------------------------------------------------

  // GWM (Schwab) platform
  if (platform === 'GWM (Schwab)') {
    // GI forms always included for GWM
    productForms.push(F.GI_DISCLOSURE, F.GI_PROPOSAL)
    productForms.push(F.GI_SCHED_A, F.GI_SCHED_B, F.GI_SCHED_C, F.GI_SCHED_D, F.GI_SCHED_E, F.GI_SCHED_F)

    // Schwab forms based on action + registration
    if (accountAction === 'LPOA/Transfer') {
      productForms.push(F.SCHWAB_LPOA)
    }

    if (accountAction === 'New Account' || accountAction === 'ACAT Transfer') {
      if (registrationType === 'Traditional IRA' || registrationType === 'Roth IRA') {
        productForms.push(F.SCHWAB_IRA_APP)
      } else if (registrationType === 'Individual (NQ)' || registrationType === 'Joint WROS') {
        productForms.push(F.SCHWAB_ONE)
      } else if (registrationType === 'Trust') {
        productForms.push(F.SCHWAB_TRUST)
      }
    }

    if (accountAction === 'ACAT Transfer') {
      productForms.push(F.SCHWAB_ACAT)
    }

    // TOD for non-qualified
    if (registrationType === 'Individual (NQ)' || registrationType === 'Joint WROS') {
      productForms.push(F.SCHWAB_TOD)
    }

    // ACH always optional but included
    productForms.push(F.SCHWAB_ACH)
  }

  // RBC Brokerage platform
  if (platform === 'RBC Brokerage') {
    // Account application based on registration
    if (registrationType === 'Traditional IRA' || registrationType === 'Roth IRA') {
      productForms.push(F.RBC_IRA_APP)
    } else if (registrationType === 'Individual (NQ)' || registrationType === 'Joint WROS') {
      productForms.push(F.RBC_INDIV_JOINT)
    } else if (registrationType === 'Trust') {
      productForms.push(F.RBC_TRUST)
    }

    if (accountAction === 'ACAT Transfer') {
      productForms.push(F.RBC_TRANSFER)
    }

    // Always included for RBC
    productForms.push(F.RBC_BENE, F.RBC_ACH)
  }

  // Direct carrier platforms
  if (platform === 'VA (Direct)') {
    productForms.push(F.CARRIER_VA)
  }
  if (platform === 'FIA (Direct)') {
    productForms.push(F.CARRIER_FIA)
  }
  if (platform === 'VUL (Direct)') {
    productForms.push(F.CARRIER_VUL)
  }

  // Estate Guru
  if (platform === 'Estate Guru') {
    productForms.push(F.ESTATE_INTAKE, F.ESTATE_QUESTIONNAIRE, F.ESTATE_BLUEPRINT)
  }

  // ---------------------------------------------------------------------------
  // Layer 4: Supporting
  // ---------------------------------------------------------------------------
  if (registrationType === 'Trust') {
    supporting.push(F.TRUST_CERT, F.TRUST_COPY)
  }

  if (platform === 'RBC Brokerage') {
    supporting.push(F.ADVISORY_LINK)
  }

  // ---------------------------------------------------------------------------
  // Layer 5: Disclosures
  // ---------------------------------------------------------------------------
  // GS CRS always required
  disclosures.push(F.GS_CRS)

  // GI disclosures for GWM
  if (platform === 'GWM (Schwab)') {
    disclosures.push(F.GI_PRIVACY, F.GI_CRS, F.GI_ADV)
  }

  // 401k specific
  if (platform === '401k') {
    disclosures.push(F.DISCLOSURE_408)
  }

  // Skip rules for platforms where the registration/action combo is nonsensical
  // (Medicare platforms only use enrollment-specific forms, not wealth registrations)
  if (['Medicare Advantage', 'Medicare Supplement', 'Part D'].includes(platform)) {
    // Medicare platforms only make sense with specific registrations
    if (!['Individual (NQ)', 'Joint WROS'].includes(registrationType)) {
      return null
    }
    // Only New Account action is relevant for Medicare
    if (accountAction !== 'New Account') {
      return null
    }
  }

  const allFormIds = [...firmClient, ...firmAccount, ...productForms, ...supporting, ...disclosures]

  return {
    rule_id: ruleId,
    platform,
    registration_type: registrationType,
    account_action: accountAction,
    firm_client: firmClient,
    firm_account: firmAccount,
    product_forms: productForms,
    supporting,
    disclosures,
    total_forms: allFormIds.length,
    notes: `Auto-generated by seed-dex-rules. ${allFormIds.length} forms across 5 layers.`,
    created_at: now,
    updated_at: now,
    _created_by: 'seed-dex-rules',
  }
}

// ============================================================================
// CLI
// ============================================================================

interface CliArgs {
  all: boolean
  dryRun: boolean
  platform?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { all: false, dryRun: false }

  for (const arg of args) {
    if (arg === '--all') result.all = true
    else if (arg === '--dry-run') result.dryRun = true
    else if (arg.startsWith('--platform=')) {
      result.platform = arg.split('=')[1]
    }
  }

  return result
}

// ============================================================================
// Seed Logic
// ============================================================================

async function seedRules(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean,
  platformFilter?: string,
): Promise<number> {
  const rules: DexRuleDoc[] = []

  const platforms = platformFilter
    ? PLATFORMS.filter((p) => p.toLowerCase().includes(platformFilter.toLowerCase()))
    : [...PLATFORMS]

  // Generate all platform x registration x action combinations
  for (const platform of platforms) {
    for (const regType of REGISTRATION_TYPES) {
      for (const action of ACCOUNT_ACTIONS) {
        const rule = buildRule(platform, regType, action)
        if (rule) {
          rules.push(rule)
        }
      }
    }
  }

  console.log(`  Generated ${rules.length} rules from ${platforms.length} platforms x ${REGISTRATION_TYPES.length} registrations x ${ACCOUNT_ACTIONS.length} actions`)

  if (dryRun) {
    console.log(`\n  [DRY RUN] Would write ${rules.length} docs to ${COLLECTIONS.RULES}:`)
    // Show first 20 for brevity
    const shown = rules.slice(0, 20)
    for (const r of shown) {
      console.log(`    ${r.rule_id} (${r.total_forms} forms)`)
    }
    if (rules.length > 20) {
      console.log(`    ... and ${rules.length - 20} more`)
    }
    return rules.length
  }

  // Batched writes
  const writes = rules.map((r) => ({ docId: r.rule_id, data: r as Record<string, unknown> }))

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_LIMIT)

    for (const w of chunk) {
      const ref = db.collection(COLLECTIONS.RULES).doc(w.docId)
      batch.set(ref, w.data)
    }

    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} docs)`)
  }

  return rules.length
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  if (!args.all && !args.platform) {
    console.error('Usage:')
    console.error('  npx tsx services/api/src/scripts/seed-dex-rules.ts --all')
    console.error('  npx tsx services/api/src/scripts/seed-dex-rules.ts --platform=GWM')
    console.error('  npx tsx services/api/src/scripts/seed-dex-rules.ts --all --dry-run')
    process.exit(1)
  }

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      initializeApp({ credential: cert(serviceAccount) })
    } else {
      initializeApp()
    }
  }
  const db = getFirestore()

  console.log(`\nSeeding DEX rules${args.platform ? ` (platform filter: ${args.platform})` : ' (all platforms)'}${args.dryRun ? ' [DRY RUN]' : ''}...\n`)

  const count = await seedRules(db, args.dryRun, args.platform)

  console.log('')
  console.log('='.repeat(60))
  console.log(`TOTAL: ${count} rules seeded to ${COLLECTIONS.RULES}`)
  if (args.dryRun) console.log('[DRY RUN - no data was written to Firestore]')
  console.log('')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
