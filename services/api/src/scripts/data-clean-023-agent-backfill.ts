/**
 * TRK-023: Backfill assigned_user_id for all clients with unresolved agent_id
 *
 * Resolution priority:
 *   1. AGENT_ID_TO_USER_ID map (row_N → UUID)
 *   2. Email-based resolution (email → user doc → user_id UUID)
 *   3. Log unmapped values for manual review
 *
 * Idempotent — safe to re-run. Only updates clients missing assigned_user_id.
 *
 * Run: cd ~/Projects/toMachina && npx tsx services/api/src/scripts/data-clean-023-agent-backfill.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

// row_N → user_id UUID map (from migrate-agent-user-plumbing.ts)
const AGENT_ID_TO_USER_ID: Record<string, string> = {
  'row_4':  'a8f2252f-aec9-4b66-a0b5-db98e4ff0396', // Josh Millang
  'row_5':  '5f6ee380-b9b6-424b-8423-cfdb3f5e82f2', // Vince Vazquez
  'row_6':  'bc7b0041-f09e-415e-b28c-abe55a862f98', // Josh Archer
  'row_7':  '92fd3964-cef4-4771-9afe-53e4e0fe4e26', // Shane Parmenter
  'row_8':  'b9bb459c-fb51-4447-89ec-c4b2820fb51f', // Alex (offboarded)
  'row_9':  'dcb8a9c7-2bad-4940-9c2f-fdcc238341e7', // John Behn
  'row_12': '139bd8e3-4838-4bef-ae16-51e0925c2719', // Lucas Dexter
  'row_13': '21cb9b21-c02a-4cfc-9a9d-50ea12fcc1d8', // Aprille
  'row_14': '9fa0a6c9-bc1f-4889-9dbe-eb46a3576204', // Matt McCormick
}

// External producers — these should NOT get an assigned_user_id (they're not RPI users)
const EXTERNAL_PRODUCER_IDS = new Set(['row_16', 'row_17', 'row_18'])

async function run() {
  console.log('TRK-023: Agent name backfill\n')

  // Build email → user_id map from all users
  const usersSnap = await db.collection('users').get()
  const emailToUserId = new Map<string, string>()
  for (const doc of usersSnap.docs) {
    const userId = doc.data().user_id
    if (userId && doc.id.includes('@')) {
      emailToUserId.set(doc.id, userId)
    }
  }
  console.log(`Built email→UUID map: ${emailToUserId.size} users\n`)

  // Scan all clients
  const clientsSnap = await db.collection('clients').get()
  console.log(`Scanning ${clientsSnap.size} clients...\n`)

  let updated = 0
  let alreadyOk = 0
  let external = 0
  const unmapped: { clientId: string; agentId: string; name: string }[] = []

  const MAX_BATCH = 490
  let batch = db.batch()
  let batchCount = 0

  for (const doc of clientsSnap.docs) {
    const data = doc.data()
    const assignedId = String(data.assigned_user_id || '')
    const agentId = String(data.agent_id || '')
    const clientName = `${data.first_name || ''} ${data.last_name || ''}`.trim()

    // Skip if already has a valid assigned_user_id (UUID format)
    if (assignedId && assignedId.includes('-') && assignedId.length > 20) {
      alreadyOk++
      continue
    }

    // Skip external producers
    if (EXTERNAL_PRODUCER_IDS.has(agentId)) {
      external++
      continue
    }

    // No agent_id at all — nothing to resolve
    if (!agentId) continue

    // Try resolution chain
    let resolvedUserId: string | null = null

    // 1. row_N map
    if (AGENT_ID_TO_USER_ID[agentId]) {
      resolvedUserId = AGENT_ID_TO_USER_ID[agentId]
    }
    // 2. Email-based (agent_id is an email)
    else if (agentId.includes('@')) {
      resolvedUserId = emailToUserId.get(agentId) || null
    }

    if (resolvedUserId) {
      batch.update(doc.ref, {
        assigned_user_id: resolvedUserId,
        updated_at: new Date().toISOString(),
      })
      batchCount++
      updated++

      if (batchCount >= MAX_BATCH) {
        await batch.commit()
        batch = db.batch()
        batchCount = 0
      }
    } else {
      unmapped.push({ clientId: doc.id, agentId, name: clientName })
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit()
  }

  // Report
  console.log(`Results:`)
  console.log(`  Already resolved: ${alreadyOk}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  External producers (skipped): ${external}`)
  console.log(`  Unmapped (need manual review): ${unmapped.length}`)

  if (unmapped.length > 0) {
    console.log(`\nUnmapped agent_id values:`)
    const grouped = new Map<string, number>()
    for (const u of unmapped) {
      grouped.set(u.agentId, (grouped.get(u.agentId) || 0) + 1)
    }
    for (const [agentId, count] of [...grouped.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  "${agentId}" → ${count} clients`)
    }
  }

  // Verification: count clients that still lack a resolvable agent
  const verifySnap = await db.collection('clients').get()
  let noAgent = 0
  let hasAgent = 0
  for (const doc of verifySnap.docs) {
    const d = doc.data()
    if (d.assigned_user_id || d.agent_id || d.agent_name) hasAgent++
    else noAgent++
  }
  console.log(`\nVerification: ${hasAgent} clients with agent data, ${noAgent} without any agent`)

  if (unmapped.length === 0) {
    console.log('\n✅ TRK-023 COMPLETE — all agent_id values resolved')
  } else {
    console.log(`\n⚠ TRK-023 PARTIAL — ${unmapped.length} clients need manual review`)
  }
}

run().catch(console.error)
