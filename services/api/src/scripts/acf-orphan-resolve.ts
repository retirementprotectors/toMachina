/**
 * ACF Orphan Resolve (TRK-13604)
 *
 * Finds orphan accounts (parent client deleted/merged) and resolves them:
 *   - Reads all client IDs into a Set
 *   - Uses collectionGroup('accounts') to find all accounts
 *   - Identifies orphans where parent client_id is NOT in the Set
 *   - Runs matchClient() against all clients to find the best match
 *   - Routes by score: >= 85 auto-link, 50-84 manual review, < 50 unresolvable
 *   - All actions logged to atlas_audit
 *
 * Usage:
 *   npx tsx services/api/src/scripts/acf-orphan-resolve.ts           # Dry run
 *   npx tsx services/api/src/scripts/acf-orphan-resolve.ts --commit  # Execute
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { matchClient } from '@tomachina/core/src/matching/index.js'

// ── Firebase Init ──

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const commitMode = process.argv.includes('--commit')
const BATCH_SIZE = 400

// ── Types ──

interface ClientRecord {
  id: string
  first_name?: string
  last_name?: string
  dob?: string
  email?: string
  phone?: string
  ssn_last4?: string
  status?: string
  [key: string]: unknown
}

interface OrphanAccount {
  docId: string
  parentClientId: string
  fullPath: string
  first_name?: string
  last_name?: string
  dob?: string
  email?: string
  phone?: string
  ssn_last4?: string
  policy_number?: string
  carrier_name?: string
  [key: string]: unknown
}

interface ResolveAction {
  orphanDocId: string
  orphanPath: string
  orphanInfo: string
  matchedClientId: string | null
  matchedClientName: string | null
  score: number
  method: string
  resolution: 'auto_link' | 'manual_review' | 'unresolvable'
}

interface OrphanResult {
  success: boolean
  data?: {
    totalClients: number
    totalAccounts: number
    orphansFound: number
    autoLinked: number
    manualReview: number
    unresolvable: number
    actions: ResolveAction[]
  }
  error?: string
}

// ── Helpers ──

/** Extract the client ID from an account's parent path */
function extractClientId(docPath: string): string {
  // Path format: clients/{clientId}/accounts/{accountId}
  const parts = docPath.split('/')
  const clientIdx = parts.indexOf('clients')
  if (clientIdx >= 0 && clientIdx + 1 < parts.length) {
    return parts[clientIdx + 1]
  }
  return ''
}

// ── Main ──

async function main(): Promise<OrphanResult> {
  console.log(
    commitMode
      ? 'COMMIT MODE: auto-linkable orphans will be moved in Firestore'
      : 'DRY RUN: no changes will be made (pass --commit to execute)'
  )
  console.log('---')

  // 1. Read all client IDs into a Set
  console.log('Reading all clients from Firestore...')
  const clientsSnap = await db.collection('clients').get()
  const activeClientIds = new Set<string>()
  const allClients: ClientRecord[] = []

  for (const doc of clientsSnap.docs) {
    const data = doc.data()
    // Track active clients (not deleted, not merged)
    if (!data._merged_into && data.status !== 'deleted') {
      activeClientIds.add(doc.id)
      allClients.push({ id: doc.id, ...data } as ClientRecord)
    }
  }
  console.log(`Found ${activeClientIds.size} active clients`)

  // 2. Read ALL accounts via collectionGroup
  console.log('Reading all accounts via collectionGroup...')
  const accountsSnap = await db.collectionGroup('accounts').get()
  console.log(`Found ${accountsSnap.size} total account documents`)

  // 3. Identify orphans
  const orphans: OrphanAccount[] = []

  for (const doc of accountsSnap.docs) {
    const data = doc.data()
    if (data.status === 'deleted') continue

    const parentClientId = extractClientId(doc.ref.path)
    if (!parentClientId) continue

    if (!activeClientIds.has(parentClientId)) {
      orphans.push({
        docId: doc.id,
        parentClientId,
        fullPath: doc.ref.path,
        first_name: data.first_name || data.client_first_name,
        last_name: data.last_name || data.client_last_name,
        dob: data.dob || data.client_dob,
        email: data.email || data.client_email,
        phone: data.phone || data.client_phone,
        ssn_last4: data.ssn_last4,
        policy_number: data.policy_number || data.account_number || data.contract_number,
        carrier_name: data.carrier_name || data.custodian,
        ...data,
      } as OrphanAccount)
    }
  }

  console.log(`Found ${orphans.length} orphan account(s)\n`)

  if (orphans.length === 0) {
    console.log('No orphan accounts found. All accounts have active parent clients.')
    return {
      success: true,
      data: {
        totalClients: activeClientIds.size,
        totalAccounts: accountsSnap.size,
        orphansFound: 0,
        autoLinked: 0,
        manualReview: 0,
        unresolvable: 0,
        actions: [],
      },
    }
  }

  // 4. Match each orphan against all clients
  console.log('Matching orphans against client database...')
  const actions: ResolveAction[] = []
  let autoLinked = 0
  let manualReview = 0
  let unresolvable = 0

  for (const orphan of orphans) {
    const criteria = {
      firstName: orphan.first_name || '',
      lastName: orphan.last_name || '',
      dob: orphan.dob || '',
      email: orphan.email || '',
      phone: orphan.phone || '',
      ssn_last4: orphan.ssn_last4 || '',
    }

    const result = matchClient(criteria, allClients)

    let resolution: ResolveAction['resolution']
    if (result.score >= 85) {
      resolution = 'auto_link'
      autoLinked++
    } else if (result.score >= 50) {
      resolution = 'manual_review'
      manualReview++
    } else {
      resolution = 'unresolvable'
      unresolvable++
    }

    const matchedClient = result.match as ClientRecord | null

    const action: ResolveAction = {
      orphanDocId: orphan.docId,
      orphanPath: orphan.fullPath,
      orphanInfo: [
        orphan.first_name,
        orphan.last_name,
        orphan.policy_number ? `policy:${orphan.policy_number}` : '',
        orphan.carrier_name ? `carrier:${orphan.carrier_name}` : '',
      ]
        .filter(Boolean)
        .join(' '),
      matchedClientId: matchedClient?.id || null,
      matchedClientName: matchedClient
        ? `${matchedClient.first_name || ''} ${matchedClient.last_name || ''}`.trim()
        : null,
      score: result.score,
      method: result.method,
      resolution,
    }

    actions.push(action)

    const icon =
      resolution === 'auto_link' ? 'AUTO' :
      resolution === 'manual_review' ? 'REVIEW' : 'UNRESOLVABLE'

    console.log(
      `  [${icon}] ${action.orphanInfo || orphan.docId} → ` +
      `${action.matchedClientName || '(no match)'} ` +
      `(score: ${result.score}, method: ${result.method})`
    )
  }

  // 5. Execute auto-links in commit mode
  let executed = 0

  if (commitMode && autoLinked > 0) {
    console.log(`\nExecuting ${autoLinked} auto-link(s)...`)

    const autoActions = actions.filter((a) => a.resolution === 'auto_link')
    let batch = db.batch()
    let opsInBatch = 0

    for (const action of autoActions) {
      if (!action.matchedClientId) continue

      try {
        // Read the orphan account data
        const orphanRef = db.doc(action.orphanPath)
        const orphanDoc = await orphanRef.get()
        if (!orphanDoc.exists) {
          console.log(`  Skipping ${action.orphanDocId}: document no longer exists`)
          continue
        }

        const accountData = orphanDoc.data() || {}

        // Create in new client's subcollection
        const newRef = db
          .collection('clients')
          .doc(action.matchedClientId)
          .collection('accounts')
          .doc(action.orphanDocId)

        batch.set(newRef, {
          ...accountData,
          client_id: action.matchedClientId,
          _moved_from_client: extractClientId(action.orphanPath),
          _moved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        opsInBatch++

        // Delete from old location
        batch.delete(orphanRef)
        opsInBatch++

        // Audit log
        const auditRef = db.collection('atlas_audit').doc()
        batch.set(auditRef, {
          action: 'orphan_account_resolved',
          account_doc_id: action.orphanDocId,
          original_client_id: extractClientId(action.orphanPath),
          new_client_id: action.matchedClientId,
          match_score: action.score,
          match_method: action.method,
          timestamp: new Date().toISOString(),
        })
        opsInBatch++

        // Flush batch if near limit
        if (opsInBatch >= BATCH_SIZE) {
          await batch.commit()
          batch = db.batch()
          opsInBatch = 0
        }

        executed++
        console.log(`  Linked: ${action.orphanDocId} → client ${action.matchedClientId} (${action.matchedClientName})`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`  FAILED ${action.orphanDocId}: ${message}`)
      }
    }

    // Commit remaining ops
    if (opsInBatch > 0) {
      await batch.commit()
    }
  }

  // 6. Summary
  console.log('\n--- Summary ---')
  console.log(`  Total clients:    ${activeClientIds.size}`)
  console.log(`  Total accounts:   ${accountsSnap.size}`)
  console.log(`  Orphans found:    ${orphans.length}`)
  console.log(`  Auto-link:        ${autoLinked}${commitMode ? ` (${executed} executed)` : ''}`)
  console.log(`  Manual review:    ${manualReview}`)
  console.log(`  Unresolvable:     ${unresolvable}`)
  console.log(`  Mode: ${commitMode ? 'COMMIT' : 'DRY RUN'}`)

  if (!commitMode && actions.length > 0) {
    console.log('\nDry run report (JSON):')
    console.log(JSON.stringify({
      autoLink: actions.filter((a) => a.resolution === 'auto_link'),
      manualReview: actions.filter((a) => a.resolution === 'manual_review'),
      unresolvable: actions.filter((a) => a.resolution === 'unresolvable'),
    }, null, 2))
    console.log('\nRun with --commit to execute auto-links.')
  }

  return {
    success: true,
    data: {
      totalClients: activeClientIds.size,
      totalAccounts: accountsSnap.size,
      orphansFound: orphans.length,
      autoLinked: commitMode ? executed : autoLinked,
      manualReview,
      unresolvable,
      actions,
    },
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
