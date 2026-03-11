#!/usr/bin/env npx tsx
/**
 * Load comp grid seed data into Firestore comp_grids collection.
 *
 * Sources data from CAM_CompGrid.gs constants (PRODUCT_TYPES + CARRIER_MASTER).
 * Creates one document per carrier × product_type combination.
 *
 * Run: npx tsx scripts/load-comp-grids.ts
 * Dry run: npx tsx scripts/load-comp-grids.ts --dry-run
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Seed Data from CAM_CompGrid.gs constants ───

const PRODUCT_TYPES: Record<string, { name: string; defaultRate: number; rateType: 'flat' | 'percent' }> = {
  MAPD: { name: 'Medicare Advantage', defaultRate: 600, rateType: 'flat' },
  MEDSUPP: { name: 'Medicare Supplement', defaultRate: 0.20, rateType: 'percent' },
  PDP: { name: 'Prescription Drug Plan', defaultRate: 100, rateType: 'flat' },
  LIFE: { name: 'Life Insurance', defaultRate: 0.80, rateType: 'percent' },
  ANNUITY: { name: 'Annuities', defaultRate: 0.05, rateType: 'percent' },
}

const CARRIERS = [
  { carrier_id: 'AETNA', carrier_name: 'Aetna' },
  { carrier_id: 'ANTHEM', carrier_name: 'Anthem' },
  { carrier_id: 'CIGNA', carrier_name: 'Cigna' },
  { carrier_id: 'HUMANA', carrier_name: 'Humana' },
  { carrier_id: 'UHC', carrier_name: 'UnitedHealthcare' },
  { carrier_id: 'WELLCARE', carrier_name: 'Wellcare' },
  { carrier_id: 'MUTUAL_OMAHA', carrier_name: 'Mutual of Omaha' },
  { carrier_id: 'TRANSAMERICA', carrier_name: 'Transamerica' },
]

async function main() {
  console.log(`=== Comp Grid Seed Loader ${DRY_RUN ? '(DRY RUN)' : ''} ===`)
  console.log()

  // Check existing data
  const existing = await db.collection('comp_grids').limit(1).get()
  if (!existing.empty) {
    console.log(`comp_grids collection already has data (${existing.size}+ docs).`)
    console.log('To re-seed, delete the collection first.')
    console.log('Continuing will ADD seed data alongside existing records.')
    console.log()
  }

  const now = new Date().toISOString()
  let created = 0

  for (const [productKey, product] of Object.entries(PRODUCT_TYPES)) {
    for (const carrier of CARRIERS) {
      const gridId = `${carrier.carrier_id}_${productKey}`.toLowerCase()
      const data = {
        grid_id: gridId,
        product_type: productKey,
        product_name: product.name,
        carrier_id: carrier.carrier_id,
        carrier_name: carrier.carrier_name,
        rate: product.defaultRate,
        rate_type: product.rateType,
        effective_date: '2026-01-01',
        notes: `Default ${product.rateType} rate for ${carrier.carrier_name} ${product.name}`,
        created_at: now,
        updated_at: now,
        _created_by: 'load-comp-grids',
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${gridId}: ${carrier.carrier_name} × ${product.name} = ${product.rateType === 'flat' ? `$${product.defaultRate}` : `${(product.defaultRate * 100).toFixed(0)}%`}`)
      } else {
        await db.collection('comp_grids').doc(gridId).set(data)
        console.log(`  Created ${gridId}`)
      }
      created++
    }
  }

  console.log()
  console.log(`${DRY_RUN ? 'Would create' : 'Created'} ${created} comp grid entries`)
  console.log(`  ${Object.keys(PRODUCT_TYPES).length} product types × ${CARRIERS.length} carriers`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
