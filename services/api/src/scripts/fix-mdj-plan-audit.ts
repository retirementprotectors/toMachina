import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SPRINT_DOC_ID = 'C0h0Ylibz7724v9c4A5d'
const NOW = new Date().toISOString()

// Description updates keyed by item_id (TRK-NNN)
// mode 'append'  → append text to existing description
// mode 'replace' → replace description entirely
// mode 'remove'  → remove a specific sentence from existing description
const DESCRIPTION_UPDATES: Record<
  string,
  { mode: 'append' | 'replace' | 'remove'; text: string }
> = {
  // TRK-005: remove the sentence that references GET /api/mdj/specialists
  // (that endpoint belongs to TRK-003 only)
  'TRK-005': {
    mode: 'remove',
    text: 'Add GET /api/mdj/specialists to the mdj.ts route file.',
  },

  // TRK-012: append routing keyword source-of-truth note
  'TRK-012': {
    mode: 'append',
    text: 'IMPORTANT: Use routing keywords EXACTLY as defined in the discovery document specialist cards. Do NOT modify or rewrite keywords. Discovery keywords are the source of truth: General (default), Medicare (medicare, mapd, pdp, aep, enrollment, formulary), Securities (ria, bd, schwab, rbc, gradient, advisory, securities), Service (rmd, beni, access, service center, policy change), DAVID (m&a, acquisition, partnership, book of business), Ops (import, atlas, intake, wire, data, migration).',
  },

  // TRK-017: replace with dual summarization trigger description
  'TRK-017': {
    mode: 'replace',
    text: 'Two summarization triggers: (1) MEDIUM-TERM: when conversation exceeds 20 messages, generate AI summary and store on mdj_conversations doc as summary field — this creates persistent cross-conversation context. (2) LONG-CONTEXT: when conversation exceeds ~80K token budget, summarize older messages and replace in context to prevent overflow. When starting new conversation, include last 3 conversation summaries as context for continuity. Both triggers are required — they serve different purposes.',
  },

  // TRK-018: replace with updated storage location + dual UI surfaces description
  'TRK-018': {
    mode: 'replace',
    text: 'MDJ user preferences stored as users/{email}.mdj_preferences object in Firestore (NOT a separate collection). Fields: auto_approve_tools (string[]), show_tool_details (boolean), default_specialist (string), conversation_retention_days (number). TWO UI surfaces: (1) Self-service: user can edit their own mdj_preferences from their profile. (2) Team Config: Admin/Config tabs in ProDashX — Team Config + Permissions Audit section where EXECUTIVE+ can view and manage MDJ preferences for all team members, alongside existing module_permissions.',
  },

  // TRK-003: append specialists endpoint ownership + connection method notes
  'TRK-003': {
    mode: 'append',
    text: 'GET /api/mdj/specialists route lives here (not in TRK-005). Phase 1: MDJ1_URL env var = Tailscale Funnel URL (temporary, direct connection). Phase 4 (TRK-016): replace with Cloudflare Tunnel URL.',
  },

  // TRK-002: append standalone project clarification
  'TRK-002': {
    mode: 'append',
    text: 'IMPORTANT: ~/mdj-agent/ is a standalone project on MDJ1 ONLY. It is NOT part of the toMachina monorepo. It is NOT deployed to Cloud Run. It runs exclusively on the Dell PowerEdge T440 server.',
  },

  // TRK-007: append MCP connection method details
  'TRK-007': {
    mode: 'append',
    text: 'Connection method: use @modelcontextprotocol/sdk Client class to spawn and connect to each MCP server via stdio transport (same pattern as the MCP servers\' own index.js files use StdioServerTransport). Each server is spawned as a child process by the mdj-agent.',
  },

  // TRK-009: append approval state persistence details
  'TRK-009': {
    mode: 'append',
    text: 'Approval state persistence: use the tool_calls array on the message document in mdj_conversations/{id}/messages. When approval is needed, set tool_calls[].status = \'pending\'. On approve: set status = \'completed\', approved = true, approved_by = email. On reject: set status = \'failed\', approved = false. Reference the messages subcollection schema from the discovery Data Model tab.',
  },
}

async function run() {
  console.log('Starting MDJ plan_audited update...\n')

  // --- Step 1: Verify sprint doc exists ---
  const sprintRef = db.collection('sprints').doc(SPRINT_DOC_ID)
  const sprintSnap = await sprintRef.get()
  if (!sprintSnap.exists) {
    throw new Error(`Sprint doc ${SPRINT_DOC_ID} not found in 'sprints' collection`)
  }
  console.log(`Sprint found: ${sprintSnap.data()?.name ?? SPRINT_DOC_ID}`)

  // --- Step 2: Fetch all tracker items for this sprint ---
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
    const trkId: string = (data.item_id as string) ?? doc.id

    const updatePayload: Record<string, unknown> = {
      status: 'plan_audited',
      updated_at: NOW,
    }

    const descUpdate = DESCRIPTION_UPDATES[trkId]
    if (descUpdate) {
      const existing: string = typeof data.description === 'string' ? data.description : ''

      if (descUpdate.mode === 'replace') {
        updatePayload['description'] = descUpdate.text
        console.log(`  ${trkId} — REPLACE description`)
      } else if (descUpdate.mode === 'remove') {
        // Remove the specific sentence from existing description
        const cleaned = existing.replace(descUpdate.text, '').replace(/\s{2,}/g, ' ').trim()
        updatePayload['description'] = cleaned
        console.log(`  ${trkId} — REMOVE sentence from description`)
      } else {
        // append
        updatePayload['description'] = existing.trimEnd() + ' ' + descUpdate.text
        console.log(`  ${trkId} — APPEND to description`)
      }
    } else {
      console.log(`  ${trkId} — status → plan_audited`)
    }

    batch.update(doc.ref, updatePayload)
    updatedCount++
  }

  // --- Step 4: Update the sprint doc ---
  batch.update(sprintRef, {
    phase: 'plan_audited',
    updated_at: NOW,
  })
  console.log(`\n  Sprint ${SPRINT_DOC_ID} — phase → plan_audited`)

  // --- Step 5: Commit ---
  await batch.commit()

  console.log(`\nDone. ${updatedCount} tracker items updated + sprint doc updated.`)
  console.log(`Timestamp: ${NOW}`)
}

run().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
