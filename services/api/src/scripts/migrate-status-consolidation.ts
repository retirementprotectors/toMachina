/**
 * Status Consolidation Migration
 *
 * Client statuses: Merges Active-Internal → Active, Deleted → Inactive,
 *   normalizes all duplicates to 9 canonical values.
 * Account statuses: Normalizes all duplicates to 11 canonical values.
 *
 * Run: npx tsx services/api/src/scripts/migrate-status-consolidation.ts [--dry-run]
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, WriteBatch } from 'firebase-admin/firestore'

const app = initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore(app)

const DRY_RUN = process.argv.includes('--dry-run')

// ============================================================================
// CLIENT STATUS MAPPING (old → new)
// ============================================================================
const CLIENT_STATUS_MAP: Record<string, string> = {
  'Active': 'Active',
  'Active- INTERNAL': 'Active',
  'Active - Internal': 'Active',
  'Active - External': 'Active',
  'Active- AFFILIATE (OK)': 'Active - Affiliate (OK to Market)',
  'Active- AFFILIATE (DO NOT MARKET!)': 'Active - Affiliate (Do Not Market)',
  'Prospect': 'Prospect',
  'Inactive': 'Inactive',
  'Deleted': 'Inactive',
  'Inactive - No Active Accounts': 'Inactive',
  'Inactive- FIRED': 'Inactive - Fired',
  'Inactive - Fired': 'Inactive - Fired',
  'Inactive- DECEASED': 'Inactive - Deceased',
  'Inactive - Deceased': 'Inactive - Deceased',
  'Inactive- DEATH CLAIM': 'Inactive - Deceased',
  'Deceased': 'Inactive - Deceased',
  'Inactive- COMPLAINT': 'Inactive - Complaint',
  'Unknown': 'Unknown',
}

// ============================================================================
// ACCOUNT STATUS MAPPING (old → new)
// ============================================================================
const ACCOUNT_STATUS_MAP: Record<string, string> = {
  'Active': 'Active',
  'Active Policy': 'Active',
  'issued': 'Active',
  'Paid Up': 'Active',
  'Pending': 'Pending',
  'new business submission': 'Pending',
  'issued contract': 'Pending',
  'account funding': 'Pending',
  'carrier underwriting': 'Pending',
  'approved, pending req': 'Pending',
  'Pending Placement': 'Pending',
  'Inactive': 'Inactive',
  'Deleted': 'Inactive',
  'Attrited': 'Inactive',
  'Terminated': 'Terminated',
  'T': 'Terminated',
  'Rolled Over To Aspida': 'Terminated',
  'Surrendered': 'Surrendered',
  'surrendered': 'Surrendered',
  'Cancelled': 'Cancelled',
  'Lapsed': 'Lapsed',
  'Matured': 'Matured',
  'ANNPAYO': 'Matured',
  'Deceased': 'Deceased',
  'Death': 'Deceased',
  'Claim': 'Claim',
  'Annuity': 'Unknown',
  // Date-suffix variants found in data
  'cancelled eff 06/14/25': 'Cancelled',
  'Decease 07/2020': 'Deceased',
  'Maturity date 10/01/2021': 'Matured',
  'Deceased 04/25/25': 'Deceased',
  'Matured - 2/28/2024': 'Matured',
}

async function migrateClientStatuses(): Promise<{ updated: number; skipped: number; errors: string[] }> {
  console.log('\n=== MIGRATING CLIENT STATUSES ===')
  const snapshot = await db.collection('clients').get()
  let updated = 0
  let skipped = 0
  const errors: string[] = []
  let batch: WriteBatch = db.batch()
  let batchCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const currentStatus = data.client_status || ''

    if (!currentStatus) {
      // No status → Unknown
      if (!DRY_RUN) {
        batch.update(doc.ref, { client_status: 'Unknown' })
        batchCount++
      }
      updated++
      continue
    }

    const newStatus = CLIENT_STATUS_MAP[currentStatus]
    if (!newStatus) {
      // Unmapped — try regex for date-suffix variants
      const cleaned = currentStatus.replace(/\s*[-]\s*\d[\d/\s]*$/, '').replace(/\s+\d{4,}$/, '').trim()
      const fallback = CLIENT_STATUS_MAP[cleaned]
      if (fallback) {
        if (!DRY_RUN) {
          batch.update(doc.ref, { client_status: fallback })
          batchCount++
        }
        updated++
      } else {
        errors.push(`Unmapped client_status: "${currentStatus}" (doc ${doc.id})`)
        if (!DRY_RUN) {
          batch.update(doc.ref, { client_status: 'Unknown' })
          batchCount++
        }
        updated++
      }
    } else if (newStatus !== currentStatus) {
      if (!DRY_RUN) {
        batch.update(doc.ref, { client_status: newStatus })
        batchCount++
      }
      updated++
    } else {
      skipped++
    }

    if (batchCount >= 490) {
      if (!DRY_RUN) await batch.commit()
      batch = db.batch()
      batchCount = 0
      process.stdout.write('.')
    }
  }

  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit()
  }

  return { updated, skipped, errors }
}

async function migrateAccountStatuses(): Promise<{ updated: number; skipped: number; errors: string[] }> {
  console.log('\n\n=== MIGRATING ACCOUNT STATUSES ===')
  const snapshot = await db.collectionGroup('accounts').get()
  let updated = 0
  let skipped = 0
  const errors: string[] = []
  let batch: WriteBatch = db.batch()
  let batchCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const currentStatus = data.account_status || data.status || ''
    const statusField = data.account_status ? 'account_status' : 'status'

    if (!currentStatus) {
      if (!DRY_RUN) {
        batch.update(doc.ref, { [statusField]: 'Unknown' })
        batchCount++
      }
      updated++
      continue
    }

    const newStatus = ACCOUNT_STATUS_MAP[currentStatus]
    if (!newStatus) {
      // Try regex for date-suffix variants (e.g. "cancelled eff 06/14/25", "Matured - 2/28/2024")
      const cleaned = currentStatus
        .replace(/\s+eff\s+.*$/i, '')
        .replace(/\s+date\s+.*$/i, '')
        .replace(/\s*[-]\s*\d[\d/\s]*$/, '')
        .replace(/\s+\d{4,}$/, '')
        .trim()
      const fallback = ACCOUNT_STATUS_MAP[cleaned]
      if (fallback) {
        if (!DRY_RUN) {
          batch.update(doc.ref, { [statusField]: fallback })
          batchCount++
        }
        updated++
      } else {
        errors.push(`Unmapped account status: "${currentStatus}" (doc ${doc.ref.path})`)
        if (!DRY_RUN) {
          batch.update(doc.ref, { [statusField]: 'Unknown' })
          batchCount++
        }
        updated++
      }
    } else if (newStatus !== currentStatus) {
      if (!DRY_RUN) {
        batch.update(doc.ref, { [statusField]: newStatus })
        batchCount++
      }
      updated++
    } else {
      skipped++
    }

    if (batchCount >= 490) {
      if (!DRY_RUN) await batch.commit()
      batch = db.batch()
      batchCount = 0
      process.stdout.write('.')
    }
  }

  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit()
  }

  return { updated, skipped, errors }
}

async function main() {
  console.log(`Status Consolidation Migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log('='.repeat(60))

  const clientResult = await migrateClientStatuses()
  console.log(`\nClients — Updated: ${clientResult.updated}, Skipped: ${clientResult.skipped}`)
  if (clientResult.errors.length > 0) {
    console.log('Client errors:')
    clientResult.errors.forEach(e => console.log(`  - ${e}`))
  }

  const accountResult = await migrateAccountStatuses()
  console.log(`\nAccounts — Updated: ${accountResult.updated}, Skipped: ${accountResult.skipped}`)
  if (accountResult.errors.length > 0) {
    console.log('Account errors:')
    accountResult.errors.forEach(e => console.log(`  - ${e}`))
  }

  console.log('\n' + '='.repeat(60))
  console.log('DONE')
}

main().catch(console.error)
