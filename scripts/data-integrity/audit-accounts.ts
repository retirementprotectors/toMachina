#!/usr/bin/env npx tsx
/**
 * Phase 1: AUDIT — Read-only analysis of accounts subcollections
 *
 * Scans all clients/{id}/accounts docs (~18,949) and produces:
 *   1a: Account type distribution (count by account_type_category)
 *   1b: Field completeness by type (critical fields per category)
 *   1c: FK integrity (carrier_name -> carriers, product_name -> products, agent_id -> agents)
 *   1d: Orphan detection (parent client doesn't exist, duplicate accounts)
 *   1e: Empty doc detection (docs with <3 non-empty fields)
 *
 * Output: ~/Projects/toMachina/DATA_AUDIT_ACCOUNTS.md
 *
 * Usage: npx tsx scripts/data-integrity/audit-accounts.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ID = 'claude-mcp-484718'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}
const db = getFirestore()

// ============================================================================
// Types
// ============================================================================

interface AuditStats {
  totalAccounts: number
  typeDistribution: Record<string, number>
  fieldCompleteness: Record<string, Record<string, { present: number; total: number }>>
  fkIntegrity: {
    carrierMissing: { docPath: string; value: string }[]
    productMissing: { docPath: string; value: string }[]
    agentMissing: { docPath: string; value: string }[]
    carrierTotal: number
    productTotal: number
    agentTotal: number
  }
  orphans: {
    parentMissing: { docPath: string; clientId: string }[]
    duplicates: { key: string; paths: string[] }[]
  }
  emptyDocs: { docPath: string; fieldCount: number }[]
  fieldFrequency: Record<string, number>
  statusDistribution: Record<string, number>
  carrierDistribution: Record<string, number>
  sampleErrors: string[]
}

// Critical fields per account type category
const CRITICAL_FIELDS: Record<string, string[]> = {
  annuity: ['carrier_name', 'product_name', 'product_type', 'policy_number', 'status', 'premium', 'account_value', 'effective_date', 'issue_date', 'client_id'],
  life: ['carrier_name', 'product_name', 'product_type', 'policy_number', 'status', 'premium', 'face_amount', 'effective_date', 'issue_date', 'client_id'],
  medicare: ['carrier_name', 'plan_name', 'product_type', 'policy_number', 'status', 'premium', 'effective_date', 'client_id'],
  bdria: ['carrier_name', 'product_type', 'account_value', 'status', 'client_id'],
  banking: ['carrier_name', 'account_value', 'status', 'client_id'],
  unknown: ['carrier_name', 'status', 'client_id'],
}

// ============================================================================
// Helpers
// ============================================================================

function countNonEmpty(data: Record<string, unknown>): number {
  let count = 0
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_')) continue // skip metadata
    if (val !== null && val !== undefined && val !== '' && val !== 0) {
      count++
    }
  }
  return count
}

// ============================================================================
// Main Audit
// ============================================================================

async function runAudit(): Promise<AuditStats> {
  console.log('=== Phase 1: AUDIT — accounts subcollections ===')
  console.log(`   Timestamp: ${new Date().toISOString()}`)

  const stats: AuditStats = {
    totalAccounts: 0,
    typeDistribution: {},
    fieldCompleteness: {},
    fkIntegrity: {
      carrierMissing: [],
      productMissing: [],
      agentMissing: [],
      carrierTotal: 0,
      productTotal: 0,
      agentTotal: 0,
    },
    orphans: {
      parentMissing: [],
      duplicates: [],
    },
    emptyDocs: [],
    fieldFrequency: {},
    statusDistribution: {},
    carrierDistribution: {},
    sampleErrors: [],
  }

  // Step 1: Load reference collections for FK checks
  console.log('\n   Loading reference collections...')

  const carrierNames = new Set<string>()
  const carrierSnap = await db.collection('carriers').get()
  for (const doc of carrierSnap.docs) {
    const data = doc.data()
    const name = String(data.carrier_name || data.name || '').trim().toLowerCase()
    if (name) carrierNames.add(name)
    // Also add the doc ID
    carrierNames.add(doc.id.toLowerCase())
  }
  console.log(`   Carriers loaded: ${carrierNames.size} unique names`)

  const productNames = new Set<string>()
  const productSnap = await db.collection('products').get()
  for (const doc of productSnap.docs) {
    const data = doc.data()
    const name = String(data.product_name || data.name || '').trim().toLowerCase()
    if (name) productNames.add(name)
    productNames.add(doc.id.toLowerCase())
  }
  console.log(`   Products loaded: ${productNames.size} unique names`)

  const agentIds = new Set<string>()
  const agentSnap = await db.collection('agents').get()
  for (const doc of agentSnap.docs) {
    agentIds.add(doc.id)
  }
  console.log(`   Agents loaded: ${agentIds.size}`)

  // Step 2: Load all client IDs for orphan check
  console.log('   Loading client IDs...')
  const clientIds = new Set<string>()
  const clientSnap = await db.collection('clients').select().get()
  for (const doc of clientSnap.docs) {
    clientIds.add(doc.id)
  }
  console.log(`   Clients loaded: ${clientIds.size}`)

  // Step 3: Query all accounts via collection group
  console.log('\n   Querying all accounts (collection group)...')
  const accountsSnap = await db.collectionGroup('accounts').get()
  stats.totalAccounts = accountsSnap.size
  console.log(`   Total account docs: ${stats.totalAccounts}`)

  // Track duplicates: key = clientId + policy_number
  const seenAccounts = new Map<string, string[]>()

  // Step 4: Process each account
  let processed = 0
  for (const doc of accountsSnap.docs) {
    const data = doc.data()
    const docPath = doc.ref.path // e.g., clients/abc123/accounts/pol456

    // Extract client ID from path
    const pathParts = docPath.split('/')
    const clientId = pathParts.length >= 2 ? pathParts[1] : ''

    // 1a: Type distribution
    const typeCategory = String(data.account_type_category || 'unknown').toLowerCase()
    stats.typeDistribution[typeCategory] = (stats.typeDistribution[typeCategory] || 0) + 1

    // 1b: Field completeness
    const criticalFields = CRITICAL_FIELDS[typeCategory] || CRITICAL_FIELDS['unknown']
    if (!stats.fieldCompleteness[typeCategory]) {
      stats.fieldCompleteness[typeCategory] = {}
      for (const f of criticalFields) {
        stats.fieldCompleteness[typeCategory][f] = { present: 0, total: 0 }
      }
    }
    for (const f of criticalFields) {
      if (!stats.fieldCompleteness[typeCategory][f]) {
        stats.fieldCompleteness[typeCategory][f] = { present: 0, total: 0 }
      }
      stats.fieldCompleteness[typeCategory][f].total++
      const val = data[f]
      if (val !== null && val !== undefined && val !== '' && val !== 0) {
        stats.fieldCompleteness[typeCategory][f].present++
      }
    }

    // Field frequency tracking (all fields)
    for (const key of Object.keys(data)) {
      if (!key.startsWith('_')) {
        stats.fieldFrequency[key] = (stats.fieldFrequency[key] || 0) + 1
      }
    }

    // Status distribution
    const status = String(data.status || data.account_status || data.policy_status || '').trim()
    if (status) {
      stats.statusDistribution[status] = (stats.statusDistribution[status] || 0) + 1
    } else {
      stats.statusDistribution['(empty)'] = (stats.statusDistribution['(empty)'] || 0) + 1
    }

    // Carrier distribution
    const carrier = String(data.carrier_name || data.carrier || '').trim()
    if (carrier) {
      stats.carrierDistribution[carrier] = (stats.carrierDistribution[carrier] || 0) + 1
    }

    // 1c: FK integrity
    if (carrier) {
      stats.fkIntegrity.carrierTotal++
      if (!carrierNames.has(carrier.toLowerCase())) {
        if (stats.fkIntegrity.carrierMissing.length < 200) {
          stats.fkIntegrity.carrierMissing.push({ docPath, value: carrier })
        }
      }
    }

    const productName = String(data.product_name || '').trim()
    if (productName) {
      stats.fkIntegrity.productTotal++
      if (!productNames.has(productName.toLowerCase())) {
        if (stats.fkIntegrity.productMissing.length < 200) {
          stats.fkIntegrity.productMissing.push({ docPath, value: productName })
        }
      }
    }

    const agentId = String(data.agent_id || '').trim()
    if (agentId) {
      stats.fkIntegrity.agentTotal++
      if (!agentIds.has(agentId)) {
        if (stats.fkIntegrity.agentMissing.length < 200) {
          stats.fkIntegrity.agentMissing.push({ docPath, value: agentId })
        }
      }
    }

    // 1d: Orphan detection
    if (clientId && !clientIds.has(clientId)) {
      stats.orphans.parentMissing.push({ docPath, clientId })
    }

    // Duplicate tracking (clientId + policy_number)
    const policyNumber = String(data.policy_number || '').trim()
    if (clientId && policyNumber) {
      const dupeKey = `${clientId}::${policyNumber}`
      if (!seenAccounts.has(dupeKey)) {
        seenAccounts.set(dupeKey, [])
      }
      seenAccounts.get(dupeKey)!.push(docPath)
    }

    // 1e: Empty doc detection
    const nonEmptyCount = countNonEmpty(data)
    if (nonEmptyCount < 3) {
      stats.emptyDocs.push({ docPath, fieldCount: nonEmptyCount })
    }

    processed++
    if (processed % 5000 === 0) {
      console.log(`   Processed ${processed}/${stats.totalAccounts}...`)
    }
  }

  // Collect duplicates
  for (const [key, paths] of seenAccounts.entries()) {
    if (paths.length > 1) {
      stats.orphans.duplicates.push({ key, paths })
    }
  }

  console.log(`   Processed ${processed} accounts total`)
  return stats
}

// ============================================================================
// Report Generator
// ============================================================================

function generateReport(stats: AuditStats): string {
  const lines: string[] = []
  const ts = new Date().toISOString()

  lines.push('# DATA AUDIT: Accounts Subcollections')
  lines.push('')
  lines.push(`**Generated**: ${ts}`)
  lines.push(`**Total Account Documents**: ${stats.totalAccounts.toLocaleString()}`)
  lines.push(`**Scope**: \`clients/*/accounts\` (subcollection group query)`)
  lines.push('')

  // 1a: Type Distribution
  lines.push('## 1a: Account Type Distribution')
  lines.push('')
  lines.push('| Category | Count | % |')
  lines.push('|----------|------:|--:|')
  const sortedTypes = Object.entries(stats.typeDistribution).sort((a, b) => b[1] - a[1])
  for (const [type, count] of sortedTypes) {
    const pct = ((count / stats.totalAccounts) * 100).toFixed(1)
    lines.push(`| ${type} | ${count.toLocaleString()} | ${pct}% |`)
  }
  lines.push('')

  // Status Distribution
  lines.push('## Status Distribution')
  lines.push('')
  lines.push('| Status | Count | % |')
  lines.push('|--------|------:|--:|')
  const sortedStatuses = Object.entries(stats.statusDistribution).sort((a, b) => b[1] - a[1])
  for (const [status, count] of sortedStatuses) {
    const pct = ((count / stats.totalAccounts) * 100).toFixed(1)
    lines.push(`| ${status} | ${count.toLocaleString()} | ${pct}% |`)
  }
  lines.push('')

  // Carrier Distribution (top 30)
  lines.push('## Top 30 Carriers')
  lines.push('')
  lines.push('| Carrier | Count |')
  lines.push('|---------|------:|')
  const sortedCarriers = Object.entries(stats.carrierDistribution).sort((a, b) => b[1] - a[1])
  for (const [carrier, count] of sortedCarriers.slice(0, 30)) {
    lines.push(`| ${carrier} | ${count.toLocaleString()} |`)
  }
  if (sortedCarriers.length > 30) {
    lines.push(`| *(${sortedCarriers.length - 30} more)* | |`)
  }
  lines.push('')

  // 1b: Field Completeness
  lines.push('## 1b: Field Completeness by Account Type')
  lines.push('')
  for (const [type, fields] of Object.entries(stats.fieldCompleteness)) {
    const total = Object.values(fields)[0]?.total || 0
    lines.push(`### ${type} (${total.toLocaleString()} accounts)`)
    lines.push('')
    lines.push('| Field | Present | Missing | Fill Rate |')
    lines.push('|-------|--------:|--------:|----------:|')
    const sortedFields = Object.entries(fields).sort((a, b) => {
      const rateA = a[1].total > 0 ? a[1].present / a[1].total : 0
      const rateB = b[1].total > 0 ? b[1].present / b[1].total : 0
      return rateA - rateB
    })
    for (const [field, { present, total: t }] of sortedFields) {
      const missing = t - present
      const rate = t > 0 ? ((present / t) * 100).toFixed(1) : '0.0'
      const flag = parseFloat(rate) < 50 ? ' **LOW**' : ''
      lines.push(`| ${field} | ${present.toLocaleString()} | ${missing.toLocaleString()} | ${rate}%${flag} |`)
    }
    lines.push('')
  }

  // 1c: FK Integrity
  lines.push('## 1c: FK Integrity')
  lines.push('')
  lines.push('| FK Field | Docs with FK | Missing in Reference | Hit Rate |')
  lines.push('|----------|-------------:|---------------------:|---------:|')

  const carrierHit = stats.fkIntegrity.carrierTotal > 0
    ? (((stats.fkIntegrity.carrierTotal - stats.fkIntegrity.carrierMissing.length) / stats.fkIntegrity.carrierTotal) * 100).toFixed(1)
    : 'N/A'
  lines.push(`| carrier_name -> carriers | ${stats.fkIntegrity.carrierTotal.toLocaleString()} | ${stats.fkIntegrity.carrierMissing.length} | ${carrierHit}% |`)

  const productHit = stats.fkIntegrity.productTotal > 0
    ? (((stats.fkIntegrity.productTotal - stats.fkIntegrity.productMissing.length) / stats.fkIntegrity.productTotal) * 100).toFixed(1)
    : 'N/A'
  lines.push(`| product_name -> products | ${stats.fkIntegrity.productTotal.toLocaleString()} | ${stats.fkIntegrity.productMissing.length} | ${productHit}% |`)

  const agentHit = stats.fkIntegrity.agentTotal > 0
    ? (((stats.fkIntegrity.agentTotal - stats.fkIntegrity.agentMissing.length) / stats.fkIntegrity.agentTotal) * 100).toFixed(1)
    : 'N/A'
  lines.push(`| agent_id -> agents | ${stats.fkIntegrity.agentTotal.toLocaleString()} | ${stats.fkIntegrity.agentMissing.length} | ${agentHit}% |`)
  lines.push('')

  // FK Missing Details (sample)
  if (stats.fkIntegrity.carrierMissing.length > 0) {
    lines.push('### Missing Carrier Names (unique values, top 30)')
    lines.push('')
    const uniqueCarriers = new Map<string, number>()
    for (const { value } of stats.fkIntegrity.carrierMissing) {
      uniqueCarriers.set(value, (uniqueCarriers.get(value) || 0) + 1)
    }
    const sortedMissing = [...uniqueCarriers.entries()].sort((a, b) => b[1] - a[1])
    lines.push('| Carrier Name | Occurrences |')
    lines.push('|--------------|------------:|')
    for (const [name, count] of sortedMissing.slice(0, 30)) {
      lines.push(`| ${name} | ${count} |`)
    }
    lines.push('')
  }

  if (stats.fkIntegrity.productMissing.length > 0) {
    lines.push('### Missing Product Names (unique values, top 30)')
    lines.push('')
    const uniqueProducts = new Map<string, number>()
    for (const { value } of stats.fkIntegrity.productMissing) {
      uniqueProducts.set(value, (uniqueProducts.get(value) || 0) + 1)
    }
    const sortedMissing = [...uniqueProducts.entries()].sort((a, b) => b[1] - a[1])
    lines.push('| Product Name | Occurrences |')
    lines.push('|--------------|------------:|')
    for (const [name, count] of sortedMissing.slice(0, 30)) {
      lines.push(`| ${name} | ${count} |`)
    }
    lines.push('')
  }

  // 1d: Orphan Detection
  lines.push('## 1d: Orphan Detection')
  lines.push('')
  lines.push(`**Accounts with missing parent client**: ${stats.orphans.parentMissing.length}`)
  lines.push(`**Duplicate accounts** (same client + policy_number): ${stats.orphans.duplicates.length}`)
  lines.push('')

  if (stats.orphans.parentMissing.length > 0) {
    lines.push('### Orphan Accounts (sample, max 20)')
    lines.push('')
    lines.push('| Doc Path | Client ID |')
    lines.push('|----------|-----------|')
    for (const { docPath, clientId } of stats.orphans.parentMissing.slice(0, 20)) {
      lines.push(`| ${docPath} | ${clientId} |`)
    }
    lines.push('')
  }

  if (stats.orphans.duplicates.length > 0) {
    lines.push('### Duplicate Accounts (sample, max 20)')
    lines.push('')
    lines.push('| Client + Policy | Count | Paths |')
    lines.push('|-----------------|------:|-------|')
    for (const { key, paths } of stats.orphans.duplicates.slice(0, 20)) {
      lines.push(`| ${key} | ${paths.length} | ${paths.join(', ')} |`)
    }
    lines.push('')
  }

  // 1e: Empty Docs
  lines.push('## 1e: Empty Document Detection')
  lines.push('')
  lines.push(`**Documents with < 3 non-empty fields**: ${stats.emptyDocs.length}`)
  lines.push('')
  if (stats.emptyDocs.length > 0) {
    lines.push('| Doc Path | Non-Empty Fields |')
    lines.push('|----------|----------------:|')
    for (const { docPath, fieldCount } of stats.emptyDocs.slice(0, 30)) {
      lines.push(`| ${docPath} | ${fieldCount} |`)
    }
    if (stats.emptyDocs.length > 30) {
      lines.push(`| *(${stats.emptyDocs.length - 30} more)* | |`)
    }
    lines.push('')
  }

  // Field Frequency (all fields observed)
  lines.push('## Field Frequency (all observed fields)')
  lines.push('')
  lines.push('| Field | Occurrences | % of Accounts |')
  lines.push('|-------|------------:|--------------:|')
  const sortedFreq = Object.entries(stats.fieldFrequency).sort((a, b) => b[1] - a[1])
  for (const [field, count] of sortedFreq) {
    const pct = ((count / stats.totalAccounts) * 100).toFixed(1)
    lines.push(`| ${field} | ${count.toLocaleString()} | ${pct}% |`)
  }
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    const stats = await runAudit()

    // Generate and write report
    const report = generateReport(stats)

    const reportPath = path.resolve('/Users/joshd.millang/Projects/toMachina/DATA_AUDIT_ACCOUNTS.md')
    fs.writeFileSync(reportPath, report, 'utf-8')
    console.log(`\n   Report written to: ${reportPath}`)

    // Also write stats JSON for programmatic use
    const jsonPath = path.resolve('/Users/joshd.millang/Projects/toMachina-data2/scripts/data-integrity/audit-accounts-stats.json')
    fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2), 'utf-8')
    console.log(`   Stats JSON written to: ${jsonPath}`)

    // Summary
    console.log('\n=== AUDIT SUMMARY ===')
    console.log(`   Total accounts: ${stats.totalAccounts.toLocaleString()}`)
    console.log(`   Type categories: ${Object.keys(stats.typeDistribution).length}`)
    console.log(`   Orphan accounts (no parent client): ${stats.orphans.parentMissing.length}`)
    console.log(`   Duplicate accounts: ${stats.orphans.duplicates.length}`)
    console.log(`   Empty docs (<3 fields): ${stats.emptyDocs.length}`)
    console.log(`   FK: carrier misses = ${stats.fkIntegrity.carrierMissing.length}, product misses = ${stats.fkIntegrity.productMissing.length}, agent misses = ${stats.fkIntegrity.agentMissing.length}`)

    return stats
  } catch (err) {
    console.error('AUDIT FAILED:', err)
    process.exit(1)
  }
}

// Export for use in verification
export { main as runAudit, AuditStats }

main()
