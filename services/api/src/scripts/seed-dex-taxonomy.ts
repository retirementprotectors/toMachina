/**
 * DEX Taxonomy Seeder — Carriers, Products, Account Types, Transactions
 *
 * Seeds four Firestore collections that drive the DEX Kit Builder:
 *   taxonomy_carriers   (~19 carriers)
 *   taxonomy_products   (~22 products)
 *   taxonomy_account_types (~12 types)
 *   taxonomy_transactions  (~10 types)
 *
 * Data ported from DEX_Taxonomy.gs + RAPID_MATRIX _CARRIER_MASTER /
 * _PRODUCT_MASTER / _ACCOUNT_TYPE_MASTER / _TRANSACTION_MASTER tabs.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-dex-taxonomy.ts --all
 *   npx tsx services/api/src/scripts/seed-dex-taxonomy.ts --collection=carriers
 *   npx tsx services/api/src/scripts/seed-dex-taxonomy.ts --all --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { COLLECTIONS } from '../../../../packages/core/src/dex/config'
import type {
  TaxonomyCarrier,
  TaxonomyProduct,
  TaxonomyAccountType,
  TaxonomyTransaction,
} from '../../../../packages/core/src/dex/types'

// ============================================================================
// Constants
// ============================================================================

const BATCH_LIMIT = 500

type TaxonomyCollection = 'carriers' | 'products' | 'account_types' | 'transactions'

const COLLECTION_MAP: Record<TaxonomyCollection, string> = {
  carriers: COLLECTIONS.TAXONOMY_CARRIERS,
  products: COLLECTIONS.TAXONOMY_PRODUCTS,
  account_types: COLLECTIONS.TAXONOMY_ACCOUNT_TYPES,
  transactions: COLLECTIONS.TAXONOMY_TRANSACTIONS,
}

// ============================================================================
// Carrier Data (~19)
// ============================================================================

const CARRIERS: TaxonomyCarrier[] = [
  // BD/RIA
  { carrier_id: 'GRADIENT_SEC', carrier_name: 'Gradient Securities', carrier_type: 'BD_RIA', domain: 'WEALTH' },
  { carrier_id: 'GRADIENT_WM', carrier_name: 'Gradient Wealth Management', carrier_type: 'BD_RIA', domain: 'WEALTH' },
  { carrier_id: 'GRADIENT_INV', carrier_name: 'Gradient Investments', carrier_type: 'BD_RIA', domain: 'WEALTH' },

  // Custodians
  { carrier_id: 'SCHWAB', carrier_name: 'Charles Schwab', carrier_type: 'CUSTODIAN', domain: 'WEALTH' },
  { carrier_id: 'RBC', carrier_name: 'RBC Custody', carrier_type: 'CUSTODIAN', domain: 'WEALTH' },

  // IMOs
  { carrier_id: 'GRADIENT_IMO', carrier_name: 'Gradient Insurance Brokerage', carrier_type: 'IMO', domain: 'BOTH' },

  // Insurance Carriers — Life & Annuity
  { carrier_id: 'JOHN_HANCOCK', carrier_name: 'John Hancock', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'NASSAU', carrier_name: 'Nassau Life & Annuity', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'NATIONWIDE', carrier_name: 'Nationwide', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'ATHENE', carrier_name: 'Athene', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'PROTECTIVE', carrier_name: 'Protective Life', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'NORTH_AMERICAN', carrier_name: 'North American (Sammons)', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'ALLIANZ', carrier_name: 'Allianz Life', carrier_type: 'INSURANCE', domain: 'WEALTH' },
  { carrier_id: 'COF', carrier_name: 'Catholic Order of Foresters', carrier_type: 'INSURANCE', domain: 'WEALTH' },

  // Insurance Carriers — Health
  { carrier_id: 'AETNA', carrier_name: 'Aetna', carrier_type: 'INSURANCE', domain: 'HEALTH' },
  { carrier_id: 'HUMANA', carrier_name: 'Humana', carrier_type: 'INSURANCE', domain: 'HEALTH' },
  { carrier_id: 'UNITEDHEALTHCARE', carrier_name: 'UnitedHealthcare', carrier_type: 'INSURANCE', domain: 'HEALTH' },
  { carrier_id: 'WELLCARE', carrier_name: 'Wellcare by Health Net', carrier_type: 'INSURANCE', domain: 'HEALTH' },
  { carrier_id: 'MUTUAL_OMAHA', carrier_name: 'Mutual of Omaha', carrier_type: 'INSURANCE', domain: 'BOTH' },
]

// ============================================================================
// Product Data (~22)
// ============================================================================

const PRODUCTS: TaxonomyProduct[] = [
  // MEDICARE
  { product_id: 'MAPD', product_name: 'Medicare Advantage Prescription Drug', category: 'MEDICARE', domain: 'HEALTH' },
  { product_id: 'MA_ONLY', product_name: 'Medicare Advantage (No Drug)', category: 'MEDICARE', domain: 'HEALTH' },
  { product_id: 'PDP', product_name: 'Part D Prescription Drug Plan', category: 'MEDICARE', domain: 'HEALTH' },
  { product_id: 'MEDSUP', product_name: 'Medicare Supplement (Medigap)', category: 'MEDICARE', domain: 'HEALTH' },
  { product_id: 'DSNP', product_name: 'Dual-Eligible Special Needs Plan', category: 'MEDICARE', domain: 'HEALTH' },

  // LIFE
  { product_id: 'TERM_LIFE', product_name: 'Term Life Insurance', category: 'LIFE', domain: 'WEALTH' },
  { product_id: 'WHOLE_LIFE', product_name: 'Whole Life Insurance', category: 'LIFE', domain: 'WEALTH' },
  { product_id: 'IUL', product_name: 'Indexed Universal Life', category: 'LIFE', domain: 'WEALTH' },
  { product_id: 'VUL', product_name: 'Variable Universal Life', category: 'LIFE', domain: 'WEALTH' },
  { product_id: 'SURVIVORSHIP', product_name: 'Survivorship Life', category: 'LIFE', domain: 'WEALTH' },

  // ANNUITY
  { product_id: 'FIA', product_name: 'Fixed Index Annuity', category: 'ANNUITY', domain: 'WEALTH' },
  { product_id: 'MYGA', product_name: 'Multi-Year Guaranteed Annuity', category: 'ANNUITY', domain: 'WEALTH' },
  { product_id: 'VA', product_name: 'Variable Annuity', category: 'ANNUITY', domain: 'WEALTH' },
  { product_id: 'SPIA', product_name: 'Single Premium Immediate Annuity', category: 'ANNUITY', domain: 'WEALTH' },
  { product_id: 'DIA', product_name: 'Deferred Income Annuity', category: 'ANNUITY', domain: 'WEALTH' },

  // INVESTMENT
  { product_id: 'MUTUAL_FUND', product_name: 'Mutual Fund', category: 'INVESTMENT', domain: 'WEALTH' },
  { product_id: 'ETF', product_name: 'Exchange Traded Fund', category: 'INVESTMENT', domain: 'WEALTH' },
  { product_id: 'MANAGED_ACCT', product_name: 'Managed Account (TPMM)', category: 'INVESTMENT', domain: 'WEALTH' },
  { product_id: 'REIT', product_name: 'Real Estate Investment Trust', category: 'INVESTMENT', domain: 'WEALTH' },
  { product_id: 'FINANCIAL_PLAN', product_name: 'Financial Plan', category: 'INVESTMENT', domain: 'WEALTH' },

  // ANCILLARY
  { product_id: 'DENTAL_VISION', product_name: 'Dental/Vision/Hearing', category: 'ANCILLARY', domain: 'HEALTH' },
  { product_id: 'HOSPITAL_INDEMNITY', product_name: 'Hospital Indemnity', category: 'ANCILLARY', domain: 'HEALTH' },
]

// ============================================================================
// Account Type Data (~12)
// ============================================================================

const ACCOUNT_TYPES: TaxonomyAccountType[] = [
  { account_type_id: 'INDIVIDUAL', account_type_name: 'Individual (Non-Qualified)', domain: 'WEALTH' },
  { account_type_id: 'JOINT_WROS', account_type_name: 'Joint WROS', domain: 'WEALTH' },
  { account_type_id: 'JOINT_TIC', account_type_name: 'Joint Tenants in Common', domain: 'WEALTH' },
  { account_type_id: 'TRAD_IRA', account_type_name: 'Traditional IRA', domain: 'WEALTH' },
  { account_type_id: 'ROTH_IRA', account_type_name: 'Roth IRA', domain: 'WEALTH' },
  { account_type_id: 'SEP_IRA', account_type_name: 'SEP IRA', domain: 'WEALTH' },
  { account_type_id: 'SIMPLE_IRA', account_type_name: 'SIMPLE IRA', domain: 'WEALTH' },
  { account_type_id: 'TRUST', account_type_name: 'Trust', domain: 'WEALTH' },
  { account_type_id: '401K', account_type_name: '401(k) / ERISA', domain: 'WEALTH' },
  { account_type_id: 'CUSTODIAL', account_type_name: 'Custodial (UGMA/UTMA)', domain: 'WEALTH' },
  { account_type_id: 'ENTITY', account_type_name: 'Legal Entity (LLC/Corp)', domain: 'WEALTH' },
  { account_type_id: 'MEDICARE', account_type_name: 'Medicare Enrollment', domain: 'HEALTH' },
]

// ============================================================================
// Transaction Type Data (~10)
// ============================================================================

const TRANSACTIONS: TaxonomyTransaction[] = [
  { transaction_type_id: 'NEW_ACCOUNT', transaction_type_name: 'New Account Opening', domain: 'WEALTH' },
  { transaction_type_id: 'LPOA_TRANSFER', transaction_type_name: 'LPOA / Advisor Transfer', domain: 'WEALTH' },
  { transaction_type_id: 'ACAT_TRANSFER', transaction_type_name: 'ACAT Transfer', domain: 'WEALTH' },
  { transaction_type_id: 'ADD_MONEY', transaction_type_name: 'Add Money ($10K+)', domain: 'WEALTH' },
  { transaction_type_id: '1035_EXCHANGE', transaction_type_name: '1035 Tax-Free Exchange', domain: 'WEALTH' },
  { transaction_type_id: 'ROLLOVER', transaction_type_name: 'Rollover (401k/IRA)', domain: 'WEALTH' },
  { transaction_type_id: 'DISTRIBUTION', transaction_type_name: 'Distribution / Withdrawal', domain: 'WEALTH' },
  { transaction_type_id: 'BENE_CHANGE', transaction_type_name: 'Beneficiary Change', domain: 'BOTH' },
  { transaction_type_id: 'AEP_ENROLLMENT', transaction_type_name: 'AEP Enrollment', domain: 'HEALTH' },
  { transaction_type_id: 'SEP_ENROLLMENT', transaction_type_name: 'SEP Enrollment', domain: 'HEALTH' },
]

// ============================================================================
// Data map by collection key
// ============================================================================

const DATA_MAP: Record<TaxonomyCollection, Array<Record<string, unknown>>> = {
  carriers: CARRIERS,
  products: PRODUCTS,
  account_types: ACCOUNT_TYPES,
  transactions: TRANSACTIONS,
}

const ID_FIELD_MAP: Record<TaxonomyCollection, string> = {
  carriers: 'carrier_id',
  products: 'product_id',
  account_types: 'account_type_id',
  transactions: 'transaction_type_id',
}

// ============================================================================
// CLI
// ============================================================================

interface CliArgs {
  collection?: TaxonomyCollection
  all: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { all: false, dryRun: false }

  for (const arg of args) {
    if (arg === '--all') result.all = true
    else if (arg === '--dry-run') result.dryRun = true
    else if (arg.startsWith('--collection=')) {
      result.collection = arg.split('=')[1] as TaxonomyCollection
    }
  }

  return result
}

// ============================================================================
// Seed Logic
// ============================================================================

async function seedCollection(
  db: FirebaseFirestore.Firestore,
  collectionKey: TaxonomyCollection,
  dryRun: boolean,
): Promise<number> {
  const collectionName = COLLECTION_MAP[collectionKey]
  const items = DATA_MAP[collectionKey]
  const idField = ID_FIELD_MAP[collectionKey]

  if (!items || items.length === 0) {
    console.log(`  No data for ${collectionKey}`)
    return 0
  }

  const now = new Date().toISOString()
  const writes: Array<{ docId: string; data: Record<string, unknown> }> = []

  for (const item of items) {
    const docId = item[idField] as string
    writes.push({
      docId,
      data: {
        ...item,
        created_at: now,
        updated_at: now,
        _created_by: 'seed-dex-taxonomy',
      },
    })
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would write ${writes.length} docs to ${collectionName}:`)
    for (const w of writes) {
      console.log(`    ${collectionName}/${w.docId}`)
    }
    return writes.length
  }

  // Batched writes
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_LIMIT)

    for (const w of chunk) {
      const ref = db.collection(collectionName).doc(w.docId)
      batch.set(ref, w.data)
    }

    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} docs)`)
  }

  return writes.length
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  if (!args.all && !args.collection) {
    console.error('Usage:')
    console.error('  npx tsx services/api/src/scripts/seed-dex-taxonomy.ts --all')
    console.error('  npx tsx services/api/src/scripts/seed-dex-taxonomy.ts --collection=carriers')
    console.error('  npx tsx services/api/src/scripts/seed-dex-taxonomy.ts --all --dry-run')
    console.error('')
    console.error('Available collections: carriers, products, account_types, transactions')
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

  const collectionKeys: TaxonomyCollection[] = args.all
    ? ['carriers', 'products', 'account_types', 'transactions']
    : [args.collection!]

  console.log(`\nSeeding DEX taxonomy (${collectionKeys.length} collection(s))${args.dryRun ? ' [DRY RUN]' : ''}...\n`)

  let totalDocs = 0

  for (const key of collectionKeys) {
    console.log(`Seeding ${key} -> ${COLLECTION_MAP[key]}...`)
    const count = await seedCollection(db, key, args.dryRun)
    console.log(`  Seeded ${count} ${key}`)
    console.log('')
    totalDocs += count
  }

  console.log('='.repeat(60))
  console.log(`TOTAL: ${totalDocs} documents written across ${collectionKeys.length} collection(s)`)
  if (args.dryRun) console.log('[DRY RUN - no data was written to Firestore]')
  console.log('')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
