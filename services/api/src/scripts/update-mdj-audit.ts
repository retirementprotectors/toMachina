import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SPRINT_DOC_ID = 'C0h0Ylibz7724v9c4A5d'
const NOW = new Date().toISOString()

// Description appends / replacements for specific tracker items (keyed by item_id / doc ID)
const DESCRIPTION_UPDATES: Record<
  string,
  { mode: 'append' | 'replace'; text: string }
> = {
  'TRK-005': {
    mode: 'append',
    text: 'Add MDJ module key to packages/core/src/users/modules.ts and packages/auth/src/entitlements.ts for entitlement gating. Add GET /api/mdj/specialists to the mdj.ts route file.',
  },
  'TRK-009': {
    mode: 'append',
    text: 'Approve endpoint: POST /api/mdj/conversations/:id/approve. Reject endpoint: POST /api/mdj/conversations/:id/reject.',
  },
  'TRK-011': {
    mode: 'append',
    text: 'SpecialistBadge is clickable — opens a specialist picker dropdown so the user can manually switch specialists.',
  },
  'TRK-013': {
    mode: 'append',
    text: 'Messages subcollection schema from discovery Data Model tab: { id, role (user|assistant|tool_result), content, specialist?, tool_calls: [{ tool_name, tool_input, tool_result, status, requires_approval?, approved?, approved_by? }], tokens_used?, created_at }.',
  },
  'TRK-016': {
    mode: 'replace',
    text: 'Cloudflare Tunnel setup (expose port 4200 securely to Cloud Run). Auth header: X-MDJ-Auth with shared secret stored as env var on both Cloud Run and MDJ1. Health monitoring endpoint with uptime, memory usage, active conversations, MCP server status. Auto-restart via systemd. Rate limiting per user. Request logging. Error notifications via ProDashX Notifications system (NOT Slack).',
  },
  'TRK-018': {
    mode: 'replace',
    text: 'MDJ user preferences managed via existing Admin/Config tabs in ProDashX (NOT a new settings panel inside MDJ). Fields: auto_approve_tools (string[] — tools user pre-approves, skip review gate), show_tool_details (boolean — toggle tool execution cards), default_specialist (string — prefer a specialist by default), conversation_retention_days (number). Store in mdj_user_preferences/{email} Firestore collection. Admin UI leverages existing Config tab patterns.',
  },
}

async function run() {
  console.log('Starting MDJ disc_audited update...\n')

  // --- Step 1: Verify sprint doc exists (collection: sprints) ---
  const sprintRef = db.collection('sprints').doc(SPRINT_DOC_ID)
  const sprintSnap = await sprintRef.get()
  if (!sprintSnap.exists) {
    throw new Error(`Sprint doc ${SPRINT_DOC_ID} not found in 'sprints' collection`)
  }
  console.log(`Sprint found: ${sprintSnap.data()?.name ?? SPRINT_DOC_ID}`)

  // --- Step 2: Fetch all tracker items for this sprint ---
  // Items use doc IDs = item_id (e.g. TRK-001) and have sprint_id field
  const itemsSnap = await db
    .collection('tracker_items')
    .where('sprint_id', '==', SPRINT_DOC_ID)
    .get()

  console.log(`Found ${itemsSnap.docs.length} tracker items\n`)

  // --- Step 3: Batch update all items ---
  const batch = db.batch()
  let updatedCount = 0

  for (const doc of itemsSnap.docs) {
    const data = doc.data()
    // item_id field holds TRK-NNN; doc.id is also TRK-NNN
    const trkId: string = (data.item_id as string) ?? doc.id

    const updatePayload: Record<string, unknown> = {
      status: 'disc_audited',
      updated_at: NOW,
    }

    // Apply description update if this item has one
    const descUpdate = DESCRIPTION_UPDATES[trkId]
    if (descUpdate) {
      if (descUpdate.mode === 'replace') {
        updatePayload['description'] = descUpdate.text
        console.log(`  ${trkId} — REPLACE description`)
      } else {
        // append: add new text to existing description
        const existing: string = typeof data.description === 'string' ? data.description : ''
        updatePayload['description'] = existing.trimEnd() + ' ' + descUpdate.text
        console.log(`  ${trkId} — APPEND to description`)
      }
    } else {
      console.log(`  ${trkId} — status → disc_audited`)
    }

    batch.update(doc.ref, updatePayload)
    updatedCount++
  }

  // --- Step 4: Update the sprint doc ---
  batch.update(sprintRef, {
    phase: 'disc_audited',
    updated_at: NOW,
  })
  console.log(`\n  Sprint ${SPRINT_DOC_ID} — phase → disc_audited`)

  // --- Step 5: Commit ---
  await batch.commit()

  console.log(`\nDone. ${updatedCount} tracker items updated + sprint doc updated.`)
  console.log(`Timestamp: ${NOW}`)
}

run().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
