/**
 * Client Qualification Validator
 *
 * TASK 1: Register validate-client-qualification tool in ATLAS tool_registry
 * TASK 2: Run all 365 new clients (ghl_export_20260316) through the validator
 * TASK 3: Delete DISQUALIFIED records from Firestore
 *
 * Rule: A contact qualifies if:
 *   A) Has at least 1 account in their accounts subcollection, OR
 *   B) Has first_name AND last_name AND at least 1 of: phone, email, address
 *
 * Run: cd ~/Projects/toMachina && npx tsx services/api/src/scripts/validate-client-qualification.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase init
if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ============================================================================
// TYPES
// ============================================================================

interface ClientRecord {
  doc_id: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  address?: string
  client_status?: string
  book_of_business?: string
  ghl_contact_id?: string
  _source?: string
  account_count: number
  qualified: boolean
  disqualification_reason?: string
}

// ============================================================================
// TASK 1: Register tool in ATLAS tool_registry
// ============================================================================

async function registerTool(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('TASK 1: Registering validate-client-qualification in tool_registry')
  console.log('═══════════════════════════════════════════════════════════════')

  const toolData = {
    id: 'validate-client-qualification',
    name: 'Client Qualification Validator',
    description: 'Validates that a contact meets minimum data requirements: has an account OR has first+last name plus at least one contact method (phone, email, address)',
    type: 'VALIDATOR',
    status: 'ACTIVE',
    rule: 'HAS_ACCOUNT || (first_name && last_name && (phone || email || address))',
    placement: 'Pre-import filter on all client demographic wires',
    created_at: new Date().toISOString(),
  }

  const ref = db.collection('tool_registry').doc('validate-client-qualification')
  await ref.set(toolData)
  console.log('Registered: validate-client-qualification')
  console.log(`  Type: ${toolData.type}`)
  console.log(`  Rule: ${toolData.rule}`)
  console.log(`  Placement: ${toolData.placement}`)
  console.log('')
}

// ============================================================================
// TASK 2: Validate all 365 new clients
// ============================================================================

function hasValue(val: unknown): boolean {
  if (val === undefined || val === null) return false
  if (typeof val === 'string') return val.trim().length > 0
  return true
}

async function validateClients(): Promise<{ qualified: ClientRecord[]; disqualified: ClientRecord[] }> {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('TASK 2: Validating 365 new clients from ghl_export_20260316')
  console.log('═══════════════════════════════════════════════════════════════')

  // Query clients with _source = ghl_export_20260316
  const snap = await db.collection('clients')
    .where('_source', '==', 'ghl_export_20260316')
    .get()

  console.log(`Found ${snap.size} clients with _source = ghl_export_20260316`)

  // Filter by createTime on 2026-03-16
  const targetDate = '2026-03-16'
  const newClients = snap.docs.filter(doc => {
    const createTime = doc.createTime
    if (!createTime) return false
    const created = createTime.toDate().toISOString().slice(0, 10)
    return created === targetDate
  })

  console.log(`${newClients.length} of those were created on ${targetDate} (Firestore createTime)`)
  console.log('')

  const qualified: ClientRecord[] = []
  const disqualified: ClientRecord[] = []

  // Process in batches to avoid overwhelming Firestore
  const BATCH_SIZE = 50
  for (let i = 0; i < newClients.length; i += BATCH_SIZE) {
    const batch = newClients.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(async (doc) => {
      const data = doc.data()

      // Check accounts subcollection
      const accountsSnap = await db.collection(`clients/${doc.id}/accounts`).limit(1).get()
      const accountCount = accountsSnap.size

      const hasAccount = accountCount > 0
      const hasFirstName = hasValue(data.first_name)
      const hasLastName = hasValue(data.last_name)
      const hasPhone = hasValue(data.phone)
      const hasEmail = hasValue(data.email)
      const hasAddress = hasValue(data.address)
      const hasContactMethod = hasPhone || hasEmail || hasAddress
      const hasNameAndContact = hasFirstName && hasLastName && hasContactMethod

      const isQualified = hasAccount || hasNameAndContact

      const record: ClientRecord = {
        doc_id: doc.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        client_status: data.client_status || '',
        book_of_business: data.book_of_business || '',
        ghl_contact_id: data.ghl_contact_id || '',
        _source: data._source || '',
        account_count: accountCount,
        qualified: isQualified,
      }

      if (!isQualified) {
        const reasons: string[] = []
        if (!hasAccount) reasons.push('no accounts')
        if (!hasFirstName) reasons.push('missing first_name')
        if (!hasLastName) reasons.push('missing last_name')
        if (!hasContactMethod) reasons.push('no contact method (phone/email/address)')
        record.disqualification_reason = reasons.join(', ')
      }

      return record
    }))

    for (const r of results) {
      if (r.qualified) {
        qualified.push(r)
      } else {
        disqualified.push(r)
      }
    }

    if (i + BATCH_SIZE < newClients.length) {
      process.stdout.write(`  Processed ${Math.min(i + BATCH_SIZE, newClients.length)}/${newClients.length}...\r`)
    }
  }

  console.log(`\nResults:`)
  console.log(`  QUALIFIED:    ${qualified.length}`)
  console.log(`  DISQUALIFIED: ${disqualified.length}`)
  console.log(`  TOTAL:        ${qualified.length + disqualified.length}`)
  console.log('')

  // Print DISQUALIFIED list
  if (disqualified.length > 0) {
    console.log('─── DISQUALIFIED RECORDS ──────────────────────────────────────')
    console.log('')
    for (const r of disqualified) {
      console.log(`  ${r.doc_id}`)
      console.log(`    Name:       ${r.first_name || '(empty)'} ${r.last_name || '(empty)'}`)
      console.log(`    Status:     ${r.client_status || '(empty)'}`)
      console.log(`    BoB:        ${r.book_of_business || '(empty)'}`)
      console.log(`    Phone:      ${r.phone || '(empty)'}`)
      console.log(`    Email:      ${r.email || '(empty)'}`)
      console.log(`    Address:    ${r.address || '(empty)'}`)
      console.log(`    GHL ID:     ${r.ghl_contact_id || '(empty)'}`)
      console.log(`    Accounts:   ${r.account_count}`)
      console.log(`    Reason:     ${r.disqualification_reason}`)
      console.log('')
    }
  }

  // Print QUALIFIED list (compact)
  if (qualified.length > 0) {
    console.log('─── QUALIFIED RECORDS ────────────────────────────────────────')
    console.log('')
    for (const r of qualified) {
      const name = `${r.first_name || '?'} ${r.last_name || '?'}`
      const contact = [r.phone, r.email, r.address].filter(Boolean).join(' | ')
      const accts = r.account_count > 0 ? ` [${r.account_count} acct(s)]` : ''
      console.log(`  ${r.doc_id} — ${name} — ${contact || '(no contact info)'}${accts}`)
    }
    console.log('')
  }

  return { qualified, disqualified }
}

// ============================================================================
// TASK 3: Delete DISQUALIFIED records
// ============================================================================

async function deleteDisqualified(records: ClientRecord[]): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`TASK 3: Deleting ${records.length} disqualified records`)
  console.log('═══════════════════════════════════════════════════════════════')

  if (records.length === 0) {
    console.log('No disqualified records to delete.')
    return
  }

  let totalAccountsDeleted = 0
  let totalClientsDeleted = 0

  // Process in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 400 // leave headroom for subcollection deletes
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE)
    const batch = db.batch()

    for (const record of chunk) {
      // Check for and delete any accounts subcollection docs
      const accountsSnap = await db.collection(`clients/${record.doc_id}/accounts`).get()
      for (const acctDoc of accountsSnap.docs) {
        batch.delete(acctDoc.ref)
        totalAccountsDeleted++
      }

      // Delete the client doc
      batch.delete(db.collection('clients').doc(record.doc_id))
      totalClientsDeleted++
    }

    await batch.commit()
    console.log(`  Batch committed: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
  }

  console.log('')
  console.log(`Delete Summary:`)
  console.log(`  Client docs deleted:  ${totalClientsDeleted}`)
  console.log(`  Account docs deleted: ${totalAccountsDeleted}`)
  console.log(`  Total docs deleted:   ${totalClientsDeleted + totalAccountsDeleted}`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║   CLIENT QUALIFICATION VALIDATOR                             ║')
  console.log('║   Rule: HAS_ACCOUNT || (name + contact method)              ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log('')

  // TASK 1
  await registerTool()

  // TASK 2
  const { disqualified } = await validateClients()

  // TASK 3
  await deleteDisqualified(disqualified)

  console.log('')
  console.log('Done.')
}

main().catch(console.error)
