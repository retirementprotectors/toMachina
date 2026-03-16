/**
 * Agent/User Plumbing Migration
 *
 * TRK-188 through TRK-198: Unify agent/user/producer data architecture
 *
 * Steps:
 *   1. Add is_agent + npn to user docs
 *   2. Create offboarded user doc for Christa
 *   3. Remap client.agent_id → client.assigned_user_id (row_N → UUID)
 *   4. Create producers collection from external agent records
 *   5. Delete all docs from agents collection
 *   6. Print comprehensive validation report
 *
 * Run: cd ~/Projects/toMachina && npx tsx services/api/src/scripts/migrate-agent-user-plumbing.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'

// Firebase init
if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// ─── Constants ───────────────────────────────────────────────────────

const CHRISTA_USER_ID = randomUUID()

// User agent/NPN mapping (TRK-188, TRK-189)
const USER_AGENT_MAP: Record<string, { is_agent: boolean; npn?: string }> = {
  'josh@retireprotected.com':      { is_agent: true, npn: '7384626' },
  'shane@retireprotected.com':     { is_agent: true, npn: '13842713' },
  'vince@retireprotected.com':     { is_agent: true, npn: '17967934' },
  'archer@retireprotected.com':    { is_agent: true, npn: '12124476' },
  'lucas@retireprotected.com':     { is_agent: true, npn: '18952291' },
  'matt@retireprotected.com':      { is_agent: true },  // NPN needs manual entry
  'nikki@retireprotected.com':     { is_agent: false },
  'johnbehn@retireprotected.com':  { is_agent: false },
  'aprille@retireprotected.com':   { is_agent: false },
  'susan@retireprotected.com':     { is_agent: false },
  'angelique@retireprotected.com': { is_agent: false },
  'robert@retireprotected.com':    { is_agent: false },
  'alex@retireprotected.com':      { is_agent: false, npn: '8832586' },
}

// row_N → user_id UUID mapping (TRK-191, TRK-192)
const AGENT_ID_TO_USER_ID: Record<string, string> = {
  'row_4':  'a8f2252f-aec9-4b66-a0b5-db98e4ff0396', // Josh Millang
  'row_5':  '5f6ee380-b9b6-424b-8423-cfdb3f5e82f2', // Vince Vazquez
  'row_6':  'bc7b0041-f09e-415e-b28c-abe55a862f98', // Josh Archer
  'row_7':  '92fd3964-cef4-4771-9afe-53e4e0fe4e26', // Shane Parmenter
  'row_8':  'b9bb459c-fb51-4447-89ec-c4b2820fb51f', // Alex (offboarded)
  'row_9':  'dcb8a9c7-2bad-4940-9c2f-fdcc238341e7', // John Behn
  'row_11': CHRISTA_USER_ID,                          // Christa (offboarded, created in Step 2)
  'row_12': '139bd8e3-4838-4bef-ae16-51e0925c2719', // Lucas Dexter
  'row_13': '21cb9b21-c02a-4cfc-9a9d-50ea12fcc1d8', // Aprille
  'row_14': '9fa0a6c9-bc1f-4889-9dbe-eb46a3576204', // Matt McCormick
}

// External producers to keep (TRK-195, TRK-196)
const EXTERNAL_PRODUCER_IDS = ['row_16', 'row_17', 'row_18']

// ─── Helpers ─────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 490

async function commitBatches(ops: Array<() => void>): Promise<number> {
  let committed = 0
  for (let i = 0; i < ops.length; i += MAX_BATCH_SIZE) {
    const batch = db.batch()
    const chunk = ops.slice(i, i + MAX_BATCH_SIZE)
    // Each op is a closure that takes a batch — we need to restructure
    // Actually, let's use a different approach with pre-built batch ops
    for (const op of chunk) {
      op()
    }
    // This won't work because ops don't have batch ref. Let me use a proper batching approach.
  }
  return committed
}

// Better batching: collect write instructions, execute in batches
interface WriteOp {
  type: 'set' | 'update' | 'delete'
  ref: FirebaseFirestore.DocumentReference
  data?: Record<string, unknown>
  merge?: boolean
}

async function executeBatchedWrites(ops: WriteOp[]): Promise<number> {
  let committed = 0
  for (let i = 0; i < ops.length; i += MAX_BATCH_SIZE) {
    const batch = db.batch()
    const chunk = ops.slice(i, i + MAX_BATCH_SIZE)
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data!, { merge: op.merge ?? false })
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data!)
      } else if (op.type === 'delete') {
        batch.delete(op.ref)
      }
    }
    await batch.commit()
    committed += chunk.length
  }
  return committed
}

function timestamp(): string {
  return new Date().toISOString()
}

// ─── Step 1: Add is_agent + npn to users (TRK-188, TRK-189) ─────────

async function step1_addAgentFieldsToUsers(): Promise<{ updated: number; agentCount: number; npnCount: number }> {
  console.log('\n=== STEP 1: Add is_agent + npn to user docs ===')

  const ops: WriteOp[] = []
  let agentCount = 0
  let npnCount = 0

  for (const [email, config] of Object.entries(USER_AGENT_MAP)) {
    const ref = db.collection('users').doc(email)
    const doc = await ref.get()

    if (!doc.exists) {
      console.log(`  WARN: User doc not found for ${email} — skipping`)
      continue
    }

    const updateData: Record<string, unknown> = {
      is_agent: config.is_agent,
    }

    if (config.npn) {
      updateData.npn = config.npn
      npnCount++
    }

    if (config.is_agent) agentCount++

    ops.push({ type: 'update', ref, data: updateData })
    console.log(`  ${email}: is_agent=${config.is_agent}${config.npn ? `, npn=${config.npn}` : ''}`)
  }

  const updated = await executeBatchedWrites(ops)
  console.log(`  Done: ${updated} users updated (${agentCount} agents, ${npnCount} with NPN)`)

  return { updated, agentCount, npnCount }
}

// ─── Step 2: Create Christa user doc (TRK-193) ──────────────────────

async function step2_createChristaUser(): Promise<boolean> {
  console.log('\n=== STEP 2: Create Christa offboarded user doc ===')

  const email = 'christa@retireprotected.com'
  const ref = db.collection('users').doc(email)
  const existing = await ref.get()

  if (existing.exists) {
    console.log(`  Christa user doc already exists — checking user_id`)
    const data = existing.data()
    if (data?.user_id) {
      // Update our mapping to use the existing UUID
      AGENT_ID_TO_USER_ID['row_11'] = data.user_id
      console.log(`  Using existing user_id: ${data.user_id}`)
      // Still update is_agent and status
      await ref.update({ is_agent: false, status: 'offboarded' })
      console.log(`  Updated: is_agent=false, status=offboarded`)
      return true
    }
  }

  const christaDoc = {
    user_id: CHRISTA_USER_ID,
    email,
    first_name: 'Christa',
    last_name: '',
    status: 'offboarded',
    is_agent: false,
    created_at: timestamp(),
    updated_at: timestamp(),
  }

  await ref.set(christaDoc)
  console.log(`  Created: ${email} with user_id=${CHRISTA_USER_ID}`)
  console.log(`  Status: offboarded (preserves FK chain for RetireWise clients)`)

  return true
}

// ─── Step 3: Remap client.agent_id → assigned_user_id (TRK-191, TRK-192) ─

async function step3_remapClientAgentIds(): Promise<{
  total: number
  remapped: number
  agentIdRemoved: number
  agentNameRemoved: number
  skipped: string[]
  alreadyMigrated: number
}> {
  console.log('\n=== STEP 3: Remap client.agent_id → client.assigned_user_id ===')

  const clientsSnap = await db.collection('clients').get()
  const total = clientsSnap.size
  console.log(`  Total client docs: ${total}`)

  const ops: WriteOp[] = []
  let remapped = 0
  let agentIdRemoved = 0
  let agentNameRemoved = 0
  let alreadyMigrated = 0
  const skipped: string[] = []

  for (const doc of clientsSnap.docs) {
    const data = doc.data()
    const agentId = data.agent_id
    const hasAssignedUserId = !!data.assigned_user_id

    // Skip if already migrated (has assigned_user_id and no agent_id)
    if (hasAssignedUserId && !agentId) {
      alreadyMigrated++
      continue
    }

    // If no agent_id, nothing to remap
    if (!agentId) {
      continue
    }

    const userId = AGENT_ID_TO_USER_ID[agentId]
    if (!userId) {
      skipped.push(`${doc.id} (agent_id=${agentId})`)
      continue
    }

    const updateData: Record<string, unknown> = {
      assigned_user_id: userId,
      agent_id: FieldValue.delete(),
    }

    // Remove agent_name field if it exists
    if ('agent_name' in data) {
      updateData.agent_name = FieldValue.delete()
      agentNameRemoved++
    }

    ops.push({ type: 'update', ref: doc.ref, data: updateData })
    remapped++
    agentIdRemoved++
  }

  if (skipped.length > 0) {
    console.log(`  WARNING: ${skipped.length} clients skipped (unmapped agent_id):`)
    for (const s of skipped) {
      console.log(`    - ${s}`)
    }
  }

  console.log(`  Queued: ${ops.length} writes`)
  await executeBatchedWrites(ops)
  console.log(`  Done: ${remapped} remapped, ${agentIdRemoved} agent_id removed, ${agentNameRemoved} agent_name removed`)
  if (alreadyMigrated > 0) {
    console.log(`  Already migrated (skipped): ${alreadyMigrated}`)
  }

  return { total, remapped, agentIdRemoved, agentNameRemoved, skipped, alreadyMigrated }
}

// ─── Step 4: Create producers collection (TRK-195, TRK-196) ─────────

async function step4_createProducers(): Promise<number> {
  console.log('\n=== STEP 4: Create producers collection from external agent records ===')

  let created = 0

  for (const agentDocId of EXTERNAL_PRODUCER_IDS) {
    const agentRef = db.collection('agents').doc(agentDocId)
    const agentDoc = await agentRef.get()

    if (!agentDoc.exists) {
      console.log(`  WARN: ${agentDocId} not found in agents — skipping`)
      continue
    }

    const agentData = agentDoc.data()!
    const producerId = randomUUID()

    // Build producer doc from agent data
    const producerDoc: Record<string, unknown> = {
      ...agentData,
      producer_id: producerId,
      producer_status: agentData.status || 'Prospect',
      source_collection: 'agents',
      source_doc_id: agentDocId,
      migrated_at: timestamp(),
    }

    // Remove internal fields that don't apply
    delete producerDoc.row_number

    const producerRef = db.collection('producers').doc(producerId)
    await producerRef.set(producerDoc)
    created++

    const name = `${agentData.first_name || ''} ${agentData.last_name || ''}`.trim() || agentDocId
    console.log(`  Created producer: ${name} (${producerId}) from ${agentDocId}`)
  }

  console.log(`  Done: ${created} producers created`)
  return created
}

// ─── Step 5: Clean agents collection (TRK-194, TRK-197) ─────────────

async function step5_cleanAgentsCollection(): Promise<number> {
  console.log('\n=== STEP 5: Delete ALL docs from agents collection ===')

  const agentsSnap = await db.collection('agents').get()
  console.log(`  Found ${agentsSnap.size} docs in agents collection`)

  if (agentsSnap.size === 0) {
    console.log('  Nothing to delete')
    return 0
  }

  const ops: WriteOp[] = agentsSnap.docs.map(doc => ({
    type: 'delete' as const,
    ref: doc.ref,
  }))

  const deleted = await executeBatchedWrites(ops)

  // Log what was deleted (IDs only — no PHI)
  for (const doc of agentsSnap.docs) {
    const data = doc.data()
    const label = data.email || doc.id
    console.log(`  Deleted: ${doc.id} (${label})`)
  }

  console.log(`  Done: ${deleted} agent docs deleted`)
  return deleted
}

// ─── Step 6: Validation + Report (TRK-198) ──────────────────────────

async function step6_validationReport(results: {
  step1: { updated: number; agentCount: number; npnCount: number }
  step2: boolean
  step3: { total: number; remapped: number; agentIdRemoved: number; agentNameRemoved: number; skipped: string[]; alreadyMigrated: number }
  step4: number
  step5: number
}): Promise<void> {
  console.log('\n=== STEP 6: Post-Migration Validation ===')

  // Validate users
  const usersSnap = await db.collection('users').get()
  let usersWithIsAgentTrue = 0
  let usersWithNpn = 0
  for (const doc of usersSnap.docs) {
    const data = doc.data()
    if (data.is_agent === true) usersWithIsAgentTrue++
    if (data.npn) usersWithNpn++
  }

  // Validate clients
  const clientsSnap = await db.collection('clients').get()
  let clientsWithAssignedUserId = 0
  let clientsWithAgentIdRemaining = 0
  for (const doc of clientsSnap.docs) {
    const data = doc.data()
    if (data.assigned_user_id) clientsWithAssignedUserId++
    if (data.agent_id) clientsWithAgentIdRemaining++
  }

  // Validate producers
  const producersSnap = await db.collection('producers').get()

  // Validate agents gone
  const agentsSnap = await db.collection('agents').get()

  // Christa check
  const christaDoc = await db.collection('users').doc('christa@retireprotected.com').get()
  const christaExists = christaDoc.exists

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         AGENT/USER PLUMBING MIGRATION REPORT                ║
╠══════════════════════════════════════════════════════════════╣
║  Date: ${new Date().toISOString().padEnd(52)}║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  USERS:                                                      ║
║    is_agent: true set on: ${String(results.step1.agentCount).padEnd(4)} users                       ║
║    npn added to: ${String(results.step1.npnCount).padEnd(4)} users                              ║
║    Total users updated: ${String(results.step1.updated).padEnd(4)}                             ║
║    Christa user doc created: ${christaExists ? 'YES' : 'NO '}                          ║
║                                                              ║
║  CLIENTS:                                                    ║
║    Total in collection: ${String(results.step3.total).padEnd(6)}                           ║
║    Remapped to assigned_user_id: ${String(results.step3.remapped).padEnd(6)}                   ║
║    agent_id field removed: ${String(results.step3.agentIdRemoved).padEnd(6)}                      ║
║    agent_name field removed: ${String(results.step3.agentNameRemoved).padEnd(6)}                    ║
║    Already migrated (skipped): ${String(results.step3.alreadyMigrated).padEnd(6)}                  ║
║    Skipped (no mapping): ${String(results.step3.skipped.length).padEnd(6)}                        ║
║                                                              ║
║  PRODUCERS:                                                  ║
║    Created in producers collection: ${String(results.step4).padEnd(4)}                     ║
║                                                              ║
║  AGENTS COLLECTION:                                          ║
║    Deleted: ${String(results.step5).padEnd(4)} docs                                    ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  POST-MIGRATION VALIDATION                                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Users with is_agent=true: ${String(usersWithIsAgentTrue).padEnd(4)} (expected 6)              ║
║  Users with npn: ${String(usersWithNpn).padEnd(4)} (expected 6)                          ║
║  Clients with assigned_user_id: ${String(clientsWithAssignedUserId).padEnd(6)}                   ║
║  Clients with agent_id remaining: ${String(clientsWithAgentIdRemaining).padEnd(4)} (expected 0)        ║
║  Producers collection docs: ${String(producersSnap.size).padEnd(4)} (expected 3)             ║
║  Agents collection docs: ${String(agentsSnap.size).padEnd(4)} (expected 0)                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝`)

  // List skipped clients if any
  if (results.step3.skipped.length > 0) {
    console.log('\nSkipped clients (unmapped agent_id):')
    for (const s of results.step3.skipped) {
      console.log(`  - ${s}`)
    }
  }

  // Validation checks
  const issues: string[] = []
  if (usersWithIsAgentTrue !== 6) issues.push(`Expected 6 users with is_agent=true, got ${usersWithIsAgentTrue}`)
  if (usersWithNpn !== 6) issues.push(`Expected 6 users with npn, got ${usersWithNpn}`)
  if (clientsWithAgentIdRemaining > 0) issues.push(`${clientsWithAgentIdRemaining} clients still have agent_id`)
  if (producersSnap.size !== 3) issues.push(`Expected 3 producers, got ${producersSnap.size}`)
  if (agentsSnap.size !== 0) issues.push(`Expected 0 agents, got ${agentsSnap.size}`)
  if (!christaExists) issues.push('Christa user doc was not created')

  if (issues.length === 0) {
    console.log('\n  ALL VALIDATIONS PASSED')
  } else {
    console.log('\n  VALIDATION ISSUES:')
    for (const issue of issues) {
      console.log(`    - ${issue}`)
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  AGENT/USER PLUMBING MIGRATION                             ║')
  console.log('║  TRK-188 through TRK-198                                   ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Started: ${new Date().toISOString().padEnd(49)}║`)
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // Pre-flight: show before counts
  console.log('\n--- PRE-FLIGHT COUNTS ---')
  const preUsers = await db.collection('users').get()
  const preClients = await db.collection('clients').get()
  const preAgents = await db.collection('agents').get()
  const preProducers = await db.collection('producers').get()

  console.log(`  Users: ${preUsers.size}`)
  console.log(`  Clients: ${preClients.size}`)
  console.log(`  Agents: ${preAgents.size}`)
  console.log(`  Producers: ${preProducers.size}`)

  // Count clients with agent_id before migration
  let preClientsWithAgentId = 0
  let preClientsWithAgentName = 0
  for (const doc of preClients.docs) {
    const data = doc.data()
    if (data.agent_id) preClientsWithAgentId++
    if ('agent_name' in data) preClientsWithAgentName++
  }
  console.log(`  Clients with agent_id: ${preClientsWithAgentId}`)
  console.log(`  Clients with agent_name field: ${preClientsWithAgentName}`)

  // List agents collection contents
  console.log('\n  Agents collection contents:')
  for (const doc of preAgents.docs) {
    const data = doc.data()
    console.log(`    ${doc.id}: ${data.email || '(no email)'}`)
  }

  // Execute steps sequentially
  const step1Result = await step1_addAgentFieldsToUsers()
  const step2Result = await step2_createChristaUser()
  const step3Result = await step3_remapClientAgentIds()
  const step4Result = await step4_createProducers()
  const step5Result = await step5_cleanAgentsCollection()

  // Final validation report
  await step6_validationReport({
    step1: step1Result,
    step2: step2Result,
    step3: step3Result,
    step4: step4Result,
    step5: step5Result,
  })

  console.log(`\nMigration completed at ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('MIGRATION FAILED:', err)
  process.exit(1)
})
