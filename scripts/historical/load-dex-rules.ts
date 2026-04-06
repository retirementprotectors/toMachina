/**
 * Migration script: Load DEX Kit Rules into Firestore dex_rules collection.
 * Source: DEX_Rules.gs kit assembly logic
 *
 * Run: npx tsx scripts/load-dex-rules.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const COLLECTION = 'dex_rules'

// Kit assembly rules from DEX_Rules.gs
// product_type (platform) + registration_type + action → form layers
const RULES = [
  // GWM (Schwab) — New Account
  {
    rule_id: 'RULE_GWM_IRA_NEW',
    product_type: 'GWM (Schwab)',
    registration_type: 'Traditional IRA',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0010', 'FORM_0011'],
    product_forms: ['FORM_0012', 'FORM_0013', 'FORM_0014', 'FORM_0031', 'FORM_0034', 'FORM_0035'],
    supporting: [],
    disclosures: ['FORM_0053', 'FORM_0017', 'FORM_0015', 'FORM_0016'],
  },
  {
    rule_id: 'RULE_GWM_ROTH_NEW',
    product_type: 'GWM (Schwab)',
    registration_type: 'Roth IRA',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0010', 'FORM_0011'],
    product_forms: ['FORM_0012', 'FORM_0013', 'FORM_0014', 'FORM_0031', 'FORM_0034', 'FORM_0035'],
    supporting: [],
    disclosures: ['FORM_0053', 'FORM_0017', 'FORM_0015', 'FORM_0016'],
  },
  {
    rule_id: 'RULE_GWM_NQ_NEW',
    product_type: 'GWM (Schwab)',
    registration_type: 'Individual (NQ)',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0010', 'FORM_0011'],
    product_forms: ['FORM_0012', 'FORM_0013', 'FORM_0014', 'FORM_0030', 'FORM_0050', 'FORM_0035'],
    supporting: [],
    disclosures: ['FORM_0053', 'FORM_0017', 'FORM_0015', 'FORM_0016'],
  },
  {
    rule_id: 'RULE_GWM_JOINT_NEW',
    product_type: 'GWM (Schwab)',
    registration_type: 'Joint WROS',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0010', 'FORM_0011'],
    product_forms: ['FORM_0012', 'FORM_0013', 'FORM_0014', 'FORM_0030', 'FORM_0050', 'FORM_0035'],
    supporting: [],
    disclosures: ['FORM_0053', 'FORM_0017', 'FORM_0015', 'FORM_0016'],
  },
  {
    rule_id: 'RULE_GWM_TRUST_NEW',
    product_type: 'GWM (Schwab)',
    registration_type: 'Trust',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0010', 'FORM_0011'],
    product_forms: ['FORM_0012', 'FORM_0013', 'FORM_0014', 'FORM_0030', 'FORM_0050', 'FORM_0035'],
    supporting: ['FORM_0051', 'FORM_0056'],
    disclosures: ['FORM_0053', 'FORM_0017', 'FORM_0015', 'FORM_0016'],
  },
  // GWM — LPOA/Transfer
  {
    rule_id: 'RULE_GWM_IRA_LPOA',
    product_type: 'GWM (Schwab)',
    registration_type: 'Traditional IRA',
    action: 'LPOA/Transfer',
    firm_client: ['FORM_0001'],
    firm_account: ['FORM_0010'],
    product_forms: ['FORM_0032'],
    supporting: [],
    disclosures: ['FORM_0053'],
  },
  // GWM — ACAT Transfer
  {
    rule_id: 'RULE_GWM_IRA_ACAT',
    product_type: 'GWM (Schwab)',
    registration_type: 'Traditional IRA',
    action: 'ACAT Transfer',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0010', 'FORM_0011'],
    product_forms: ['FORM_0012', 'FORM_0013', 'FORM_0014', 'FORM_0031', 'FORM_0033', 'FORM_0034', 'FORM_0035'],
    supporting: [],
    disclosures: ['FORM_0053', 'FORM_0017', 'FORM_0015', 'FORM_0016'],
  },

  // RBC Brokerage — New Account
  {
    rule_id: 'RULE_RBC_IRA_NEW',
    product_type: 'RBC Brokerage',
    registration_type: 'Traditional IRA',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0020'],
    product_forms: ['FORM_0022', 'FORM_0025', 'FORM_0026'],
    supporting: [],
    disclosures: ['FORM_0053'],
  },
  {
    rule_id: 'RULE_RBC_NQ_NEW',
    product_type: 'RBC Brokerage',
    registration_type: 'Individual (NQ)',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0020'],
    product_forms: ['FORM_0021', 'FORM_0025', 'FORM_0026'],
    supporting: ['FORM_0055'],
    disclosures: ['FORM_0053'],
  },
  {
    rule_id: 'RULE_RBC_TRUST_NEW',
    product_type: 'RBC Brokerage',
    registration_type: 'Trust',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0020'],
    product_forms: ['FORM_0023', 'FORM_0025', 'FORM_0026'],
    supporting: ['FORM_0051', 'FORM_0056', 'FORM_0055'],
    disclosures: ['FORM_0053'],
  },
  {
    rule_id: 'RULE_RBC_IRA_ACAT',
    product_type: 'RBC Brokerage',
    registration_type: 'Traditional IRA',
    action: 'ACAT Transfer',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0020'],
    product_forms: ['FORM_0022', 'FORM_0024', 'FORM_0025', 'FORM_0026'],
    supporting: [],
    disclosures: ['FORM_0053'],
  },

  // VA (Direct) — New Account
  {
    rule_id: 'RULE_VA_IRA_NEW',
    product_type: 'VA (Direct)',
    registration_type: 'Traditional IRA',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0040'],
    product_forms: ['FORM_0041'],
    supporting: [],
    disclosures: ['FORM_0053'],
  },

  // FIA (Direct) — New Account
  {
    rule_id: 'RULE_FIA_NQ_NEW',
    product_type: 'FIA (Direct)',
    registration_type: 'Individual (NQ)',
    action: 'New Account',
    firm_client: ['FORM_0001', 'FORM_0003'],
    firm_account: ['FORM_0042'],
    product_forms: ['FORM_0041'],
    supporting: [],
    disclosures: ['FORM_0053'],
  },

  // 401k — New Account
  {
    rule_id: 'RULE_401K_ERISA_NEW',
    product_type: '401k',
    registration_type: '401k/ERISA',
    action: 'New Account',
    firm_client: ['FORM_0002'],
    firm_account: ['FORM_0045'],
    product_forms: [],
    supporting: [],
    disclosures: ['FORM_0053', 'FORM_0054'],
  },
]

async function main() {
  console.log(`Loading ${RULES.length} kit rules into ${COLLECTION}...`)
  const batch = db.batch()
  const now = new Date().toISOString()

  for (const rule of RULES) {
    batch.set(db.collection(COLLECTION).doc(rule.rule_id), {
      ...rule,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
  }

  await batch.commit()
  console.log(`Done. ${RULES.length} rules loaded.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
