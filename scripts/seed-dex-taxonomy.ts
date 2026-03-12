/**
 * Seed script: Load DEX taxonomy data into Firestore.
 * Collections: taxonomy_carriers, taxonomy_products, taxonomy_account_types, taxonomy_transactions
 * Source: DEX_Taxonomy.gs carrier/product/accountType/transaction lookups
 *
 * Run: npx tsx scripts/seed-dex-taxonomy.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

// ---------------------------------------------------------------------------
// Carriers
// ---------------------------------------------------------------------------

const CARRIERS = [
  // Insurance - Health
  { carrier_id: 'CAR_001', carrier_name: 'Aetna', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Advantage', 'Medicare Supplement', 'Part D'] },
  { carrier_id: 'CAR_002', carrier_name: 'UnitedHealthcare', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Advantage', 'Medicare Supplement', 'Part D'] },
  { carrier_id: 'CAR_003', carrier_name: 'Humana', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Advantage', 'Medicare Supplement', 'Part D'] },
  { carrier_id: 'CAR_004', carrier_name: 'Cigna', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Supplement', 'Part D'] },
  { carrier_id: 'CAR_005', carrier_name: 'Mutual of Omaha', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Supplement'] },
  { carrier_id: 'CAR_006', carrier_name: 'Wellcare', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Advantage', 'Part D'] },
  { carrier_id: 'CAR_007', carrier_name: 'SilverScript', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Part D'] },
  { carrier_id: 'CAR_008', carrier_name: 'AARP/UHC', carrier_type: 'INSURANCE', domain: 'HEALTH', lines: ['Medicare Supplement'] },

  // Insurance - Wealth (Life / Annuity)
  { carrier_id: 'CAR_020', carrier_name: 'Nationwide', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'VA', 'Life'] },
  { carrier_id: 'CAR_021', carrier_name: 'Athene', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'MYGA'] },
  { carrier_id: 'CAR_022', carrier_name: 'North American', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'Life'] },
  { carrier_id: 'CAR_023', carrier_name: 'Allianz', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA'] },
  { carrier_id: 'CAR_024', carrier_name: 'Protective', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'MYGA', 'Life'] },
  { carrier_id: 'CAR_025', carrier_name: 'Jackson National', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['VA', 'FIA'] },
  { carrier_id: 'CAR_026', carrier_name: 'Lincoln Financial', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['VA', 'Life', 'FIA'] },
  { carrier_id: 'CAR_027', carrier_name: 'Transamerica', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['Life', 'FIA'] },
  { carrier_id: 'CAR_028', carrier_name: 'Pacific Life', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['VA', 'FIA', 'Life'] },
  { carrier_id: 'CAR_029', carrier_name: 'Catholic Order of Foresters', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'Life'] },
  { carrier_id: 'CAR_030', carrier_name: 'Global Atlantic', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'MYGA'] },
  { carrier_id: 'CAR_031', carrier_name: 'Midland National', carrier_type: 'INSURANCE', domain: 'WEALTH', lines: ['FIA', 'Life'] },

  // Custodians
  { carrier_id: 'CAR_040', carrier_name: 'Charles Schwab', carrier_type: 'CUSTODIAN', domain: 'WEALTH', lines: ['RIA Custody'] },
  { carrier_id: 'CAR_041', carrier_name: 'RBC', carrier_type: 'CUSTODIAN', domain: 'WEALTH', lines: ['BD Custody'] },

  // BD/RIA
  { carrier_id: 'CAR_050', carrier_name: 'Gradient Securities', carrier_type: 'BD_RIA', domain: 'WEALTH', lines: ['BD'] },
  { carrier_id: 'CAR_051', carrier_name: 'Gradient Wealth Management', carrier_type: 'BD_RIA', domain: 'WEALTH', lines: ['RIA'] },
  { carrier_id: 'CAR_052', carrier_name: 'Gradient Investments', carrier_type: 'BD_RIA', domain: 'WEALTH', lines: ['IAR'] },

  // IMO
  { carrier_id: 'CAR_060', carrier_name: 'Gradient', carrier_type: 'IMO', domain: 'BOTH', lines: ['Life', 'Annuity'] },
]

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const PRODUCTS = [
  // Medicare
  { product_id: 'PRD_001', product_name: 'Medicare Advantage (MAPD)', category: 'MEDICARE', domain: 'HEALTH', description: 'Managed care Medicare plan' },
  { product_id: 'PRD_002', product_name: 'Medicare Supplement (Medigap)', category: 'MEDICARE', domain: 'HEALTH', description: 'Supplemental coverage to Original Medicare' },
  { product_id: 'PRD_003', product_name: 'Part D (PDP)', category: 'MEDICARE', domain: 'HEALTH', description: 'Standalone prescription drug plan' },

  // Life
  { product_id: 'PRD_010', product_name: 'Term Life', category: 'LIFE', domain: 'WEALTH', description: 'Term life insurance' },
  { product_id: 'PRD_011', product_name: 'Whole Life', category: 'LIFE', domain: 'WEALTH', description: 'Permanent whole life insurance' },
  { product_id: 'PRD_012', product_name: 'Universal Life (UL)', category: 'LIFE', domain: 'WEALTH', description: 'Flexible premium universal life' },
  { product_id: 'PRD_013', product_name: 'Variable Universal Life (VUL)', category: 'LIFE', domain: 'WEALTH', description: 'Investment-linked life insurance' },
  { product_id: 'PRD_014', product_name: 'Indexed Universal Life (IUL)', category: 'LIFE', domain: 'WEALTH', description: 'Index-linked universal life' },

  // Annuity
  { product_id: 'PRD_020', product_name: 'Fixed Index Annuity (FIA)', category: 'ANNUITY', domain: 'WEALTH', description: 'Index-linked fixed annuity' },
  { product_id: 'PRD_021', product_name: 'Multi-Year Guaranteed Annuity (MYGA)', category: 'ANNUITY', domain: 'WEALTH', description: 'Fixed rate guaranteed annuity' },
  { product_id: 'PRD_022', product_name: 'Variable Annuity (VA)', category: 'ANNUITY', domain: 'WEALTH', description: 'Investment-linked variable annuity' },
  { product_id: 'PRD_023', product_name: 'Single Premium Immediate Annuity (SPIA)', category: 'ANNUITY', domain: 'WEALTH', description: 'Immediate income annuity' },

  // Investment
  { product_id: 'PRD_030', product_name: 'Managed Portfolio', category: 'INVESTMENT', domain: 'WEALTH', description: 'Discretionary managed account' },
  { product_id: 'PRD_031', product_name: 'Mutual Fund', category: 'INVESTMENT', domain: 'WEALTH', description: 'Open-end mutual fund' },
  { product_id: 'PRD_032', product_name: 'ETF', category: 'INVESTMENT', domain: 'WEALTH', description: 'Exchange-traded fund' },
  { product_id: 'PRD_033', product_name: 'REIT', category: 'INVESTMENT', domain: 'WEALTH', description: 'Real estate investment trust' },
  { product_id: 'PRD_034', product_name: '401(k) Plan', category: 'INVESTMENT', domain: 'WEALTH', description: 'Employer-sponsored retirement plan' },
  { product_id: 'PRD_035', product_name: 'Financial Plan', category: 'INVESTMENT', domain: 'WEALTH', description: 'Comprehensive financial plan' },

  // Ancillary
  { product_id: 'PRD_040', product_name: 'Dental/Vision', category: 'ANCILLARY', domain: 'HEALTH', description: 'Supplemental dental/vision' },
  { product_id: 'PRD_041', product_name: 'Hospital Indemnity', category: 'ANCILLARY', domain: 'HEALTH', description: 'Hospital indemnity coverage' },
  { product_id: 'PRD_042', product_name: 'Final Expense', category: 'ANCILLARY', domain: 'WEALTH', description: 'Small whole life for burial costs' },
]

// ---------------------------------------------------------------------------
// Account Types
// ---------------------------------------------------------------------------

const ACCOUNT_TYPES = [
  { account_type_id: 'ACT_001', account_type_name: 'Traditional IRA', domain: 'WEALTH', tax_treatment: 'Tax-Deferred' },
  { account_type_id: 'ACT_002', account_type_name: 'Roth IRA', domain: 'WEALTH', tax_treatment: 'Tax-Free Growth' },
  { account_type_id: 'ACT_003', account_type_name: 'Individual (Non-Qualified)', domain: 'WEALTH', tax_treatment: 'Taxable' },
  { account_type_id: 'ACT_004', account_type_name: 'Joint WROS', domain: 'WEALTH', tax_treatment: 'Taxable' },
  { account_type_id: 'ACT_005', account_type_name: 'Trust', domain: 'WEALTH', tax_treatment: 'Varies' },
  { account_type_id: 'ACT_006', account_type_name: '401(k)', domain: 'WEALTH', tax_treatment: 'Tax-Deferred' },
  { account_type_id: 'ACT_007', account_type_name: 'SEP IRA', domain: 'WEALTH', tax_treatment: 'Tax-Deferred' },
  { account_type_id: 'ACT_008', account_type_name: 'SIMPLE IRA', domain: 'WEALTH', tax_treatment: 'Tax-Deferred' },
  { account_type_id: 'ACT_009', account_type_name: '403(b)', domain: 'WEALTH', tax_treatment: 'Tax-Deferred' },
  { account_type_id: 'ACT_010', account_type_name: 'Custodial (UGMA/UTMA)', domain: 'WEALTH', tax_treatment: 'Taxable' },
  { account_type_id: 'ACT_011', account_type_name: 'Estate', domain: 'WEALTH', tax_treatment: 'Varies' },
  { account_type_id: 'ACT_012', account_type_name: 'Legal Entity', domain: 'WEALTH', tax_treatment: 'Varies' },
  { account_type_id: 'ACT_013', account_type_name: 'Medicare Beneficiary', domain: 'HEALTH', tax_treatment: 'N/A' },
]

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const TRANSACTIONS = [
  { transaction_type_id: 'TXN_001', transaction_type_name: 'New Account', domain: 'WEALTH', description: 'Open a new account' },
  { transaction_type_id: 'TXN_002', transaction_type_name: 'ACAT Transfer', domain: 'WEALTH', description: 'Automated customer account transfer' },
  { transaction_type_id: 'TXN_003', transaction_type_name: 'LPOA/Transfer', domain: 'WEALTH', description: 'Limited power of attorney / in-kind transfer' },
  { transaction_type_id: 'TXN_004', transaction_type_name: '1035 Exchange', domain: 'WEALTH', description: 'Tax-free insurance policy exchange' },
  { transaction_type_id: 'TXN_005', transaction_type_name: 'Rollover', domain: 'WEALTH', description: 'Qualified plan to IRA rollover' },
  { transaction_type_id: 'TXN_006', transaction_type_name: 'Contribution', domain: 'WEALTH', description: 'New money contribution' },
  { transaction_type_id: 'TXN_007', transaction_type_name: 'Distribution', domain: 'WEALTH', description: 'Withdrawal / distribution' },
  { transaction_type_id: 'TXN_008', transaction_type_name: 'RMD', domain: 'WEALTH', description: 'Required Minimum Distribution' },
  { transaction_type_id: 'TXN_009', transaction_type_name: 'Beneficiary Change', domain: 'WEALTH', description: 'Update beneficiary designation' },
  { transaction_type_id: 'TXN_010', transaction_type_name: 'Address Change', domain: 'BOTH', description: 'Update address on file' },
  { transaction_type_id: 'TXN_011', transaction_type_name: 'AEP Enrollment', domain: 'HEALTH', description: 'Annual Enrollment Period plan change' },
  { transaction_type_id: 'TXN_012', transaction_type_name: 'SEP Enrollment', domain: 'HEALTH', description: 'Special Enrollment Period plan change' },
  { transaction_type_id: 'TXN_013', transaction_type_name: 'IEP Enrollment', domain: 'HEALTH', description: 'Initial Enrollment Period' },
  { transaction_type_id: 'TXN_014', transaction_type_name: 'Rebalance', domain: 'WEALTH', description: 'Portfolio rebalance' },
  { transaction_type_id: 'TXN_015', transaction_type_name: 'Fee Change', domain: 'WEALTH', description: 'Advisory fee update' },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = new Date().toISOString()

  // Carriers
  console.log(`Seeding ${CARRIERS.length} carriers...`)
  const carrierBatch = db.batch()
  for (const c of CARRIERS) {
    carrierBatch.set(db.collection('taxonomy_carriers').doc(c.carrier_id), { ...c, created_at: now, updated_at: now })
  }
  await carrierBatch.commit()

  // Products
  console.log(`Seeding ${PRODUCTS.length} products...`)
  const productBatch = db.batch()
  for (const p of PRODUCTS) {
    productBatch.set(db.collection('taxonomy_products').doc(p.product_id), { ...p, created_at: now, updated_at: now })
  }
  await productBatch.commit()

  // Account Types
  console.log(`Seeding ${ACCOUNT_TYPES.length} account types...`)
  const atBatch = db.batch()
  for (const at of ACCOUNT_TYPES) {
    atBatch.set(db.collection('taxonomy_account_types').doc(at.account_type_id), { ...at, created_at: now, updated_at: now })
  }
  await atBatch.commit()

  // Transactions
  console.log(`Seeding ${TRANSACTIONS.length} transactions...`)
  const txnBatch = db.batch()
  for (const t of TRANSACTIONS) {
    txnBatch.set(db.collection('taxonomy_transactions').doc(t.transaction_type_id), { ...t, created_at: now, updated_at: now })
  }
  await txnBatch.commit()

  console.log(`Done. Seeded:`)
  console.log(`  - ${CARRIERS.length} carriers`)
  console.log(`  - ${PRODUCTS.length} products`)
  console.log(`  - ${ACCOUNT_TYPES.length} account types`)
  console.log(`  - ${TRANSACTIONS.length} transactions`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
