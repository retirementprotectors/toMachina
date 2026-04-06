/**
 * seed-hub-dispatcher-tickets.ts — Seed Hub Dispatcher sprint tickets into the Dojo tracker
 *
 * 6 tickets (RON-HD01 through RON-HD06) from the Hub Dispatcher Track Discovery Doc.
 * Uses the Cloud Run API (not raw Firestore) so dedup, notifications, and proper
 * TRK-XXX IDs all work automatically.
 *
 * Usage: npx tsx services/api/src/scripts/seed-hub-dispatcher-tickets.ts
 *
 * authored: MUSASHI, ARTxBLADE — 2026-04-06
 */

import { readFileSync } from 'fs'
import { JWT } from 'google-auth-library'

const TM_API_URL = process.env.TM_API_URL || 'https://tm-api-365181509090.us-central1.run.app'
const SA_KEY_PATH = '/home/jdm/mdj-agent/sa-key.json'
const MDJ_AUTH = 'mdj-alpha-shared-secret-2026'

const DISCOVERY_URL = 'docs/tracks/hub-dispatcher-track.html'

interface TicketDef {
  title: string
  description: string
  type: string
  priority: string
  phase: number
  assigned_warrior: string
  component: string
  portal: string
  size: string
}

const SPRINT_DEF = {
  name: 'Hub Dispatcher — CXO-Aware Intake Router',
  description: 'One triage point, five CXO destinations. Keyword scoring + Haiku fallback. Email intake, triage engine upgrade, FAB ticket types, spam filter.',
  owner: 'RONIN',
  portal: 'INFRA',
}

const TICKETS: TicketDef[] = [
  {
    title: 'RON-HD01: Hub Dispatcher core routing logic',
    description: 'Create hub-dispatcher.ts — the central routing engine. Keyword scoring against 5 CXO keyword sets (MEGAZORD, VOLTRON, MUSASHI, RAIDEN, RONIN). If no keyword match exceeds confidence threshold (0.6), fall back to Claude Haiku for classification. Returns CXO target, confidence score, ticket prefix, and routing channel. New files: services/api/src/raiden/hub-dispatcher.ts, packages/core/src/raiden/hub-dispatcher-types.ts, services/api/src/routes/dispatch.ts. Edit: services/api/src/server.ts (mount route).',
    type: 'feature',
    priority: 'P1',
    phase: 1,
    assigned_warrior: 'RONIN',
    component: 'HUB_DISPATCHER',
    portal: 'INFRA',
    size: 'M',
  },
  {
    title: 'RON-HD02: Update intent-classifier.ts — CXO target',
    description: 'Extend MDJ Panel intent classifier return type from { mode } to { mode, cxo_target, cxo_confidence }. After deploy/chat classification, if mode is chat, call dispatchItem(text, "mdj-panel") to get CXO target. Backwards compatible — existing callers that only read mode are unaffected. Edit: apps/prodash/app/(portal)/modules/voltron/hooks/use-intent-classifier.ts.',
    type: 'feature',
    priority: 'P2',
    phase: 2,
    assigned_warrior: 'RONIN',
    component: 'HUB_DISPATCHER',
    portal: 'INFRA',
    size: 'S',
  },
  {
    title: 'RON-HD03: Update triage-engine.ts — CXO-aware routing',
    description: 'Insert CXO dispatch step BEFORE FIX/ROUTE/TRAIN in triage-engine.ts. Data items get ZRD- prefix and route to MEGAZORD. Creative items get MUS-. Client cases get VOL-. Only bugs stay RDN-. STEP 0: blast radius audit — grep all callers of triageItem() and document in PR. Edit: services/api/src/raiden/triage-engine.ts. Verify: services/api/src/raiden/scheduler.ts.',
    type: 'feature',
    priority: 'P2',
    phase: 2,
    assigned_warrior: 'RONIN',
    component: 'HUB_DISPATCHER',
    portal: 'INFRA',
    size: 'S',
  },
  {
    title: 'RON-HD04: Email intake dispatcher',
    description: 'Build email intake channel. Poll intake@retireprotected.com inbox on MDJ_SERVER using Gmail API (service account). For each unread email: extract subject + body, run through Hub Dispatcher, create ticket in correct CXO queue, mark email as read. 5-minute poll interval via scheduler. Status endpoint GET /api/dispatch/email-status. New: services/api/src/raiden/email-intake.ts. Edit: scheduler.ts, dispatch.ts.',
    type: 'feature',
    priority: 'P2',
    phase: 2,
    assigned_warrior: 'RONIN',
    component: 'HUB_DISPATCHER',
    portal: 'INFRA',
    size: 'L',
  },
  {
    title: 'RON-HD05: Dojo Reporter FAB — CXO ticket types',
    description: 'Add ZRD- (Data/MEGAZORD), VOL- (Client Case/VOLTRON), MUS- (Creative/MUSASHI) to FAB ticket type dropdown alongside existing RDN- and RON-. Each type displays prefix, label, and CXO warrior color accent. Selected prefix included in POST /api/tracker payload. Default remains RDN-. Edit: packages/ui/src/components/IntakeFAB.tsx. Verify: ReportButton.tsx.',
    type: 'feature',
    priority: 'P2',
    phase: 2,
    assigned_warrior: 'RONIN',
    component: 'HUB_DISPATCHER',
    portal: 'SHARED',
    size: 'S',
  },
  {
    title: 'RON-HD06: Junk/spam filter + auto-archive',
    description: 'Pattern-based spam detection, repeat-submission throttling, and auto-archive pipeline. isSpam() runs BEFORE keyword scoring. Known spam phrases, excessive URLs (>3), all-caps, empty/whitespace blocked. Throttle: >5 items from same sender in 10 min. Archived items written to dispatch_archive Firestore collection. Audit endpoint GET /api/dispatch/archive. New: services/api/src/raiden/spam-filter.ts. Edit: hub-dispatcher.ts, dispatch.ts.',
    type: 'feature',
    priority: 'P3',
    phase: 3,
    assigned_warrior: 'RONIN',
    component: 'HUB_DISPATCHER',
    portal: 'INFRA',
    size: 'S',
  },
]

async function getAuthHeaders(): Promise<Record<string, string>> {
  const keyData = JSON.parse(readFileSync(SA_KEY_PATH, 'utf8'))
  const jwt = new JWT({
    email: keyData.client_email,
    key: keyData.private_key,
    additionalClaims: { target_audience: TM_API_URL },
  })
  const token = await jwt.authorize()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token.id_token}`,
    'X-MDJ-Auth': MDJ_AUTH,
  }
}

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${TM_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  console.log(`\nSeeding: ${SPRINT_DEF.name}`)
  console.log(`Tickets: ${TICKETS.length}`)
  console.log(`Owner: ${SPRINT_DEF.owner}`)
  console.log(`Discovery: ${DISCOVERY_URL}\n`)

  // Step 1: Create tracker items via API
  const createdIds: string[] = []
  let created = 0
  let dupes = 0
  let failed = 0

  for (const ticket of TICKETS) {
    const payload = {
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      priority: ticket.priority,
      portal: ticket.portal,
      scope: 'Platform',
      component: ticket.component,
      assigned_warrior: ticket.assigned_warrior,
      phase: ticket.phase,
    }

    const result = await apiCall('POST', '/api/tracker', payload) as Record<string, unknown>

    if (result.success) {
      const data = result.data as Record<string, unknown>
      const itemId = data.item_id as string
      createdIds.push(data.id as string || itemId)
      created++
      console.log(`  ✓ ${itemId} — ${ticket.title}`)
    } else if (String(result.error).includes('Duplicate')) {
      const existing = result.existing as Record<string, unknown>
      createdIds.push(existing?.item_id as string || '')
      dupes++
      console.log(`  ⚠ DUP: ${existing?.item_id} — ${ticket.title}`)
    } else {
      failed++
      console.log(`  ✗ FAIL: ${ticket.title} — ${result.error}`)
    }
  }

  console.log(`\nTickets: ${created} created, ${dupes} dupes, ${failed} failed`)

  // Step 2: Create sprint and assign items
  if (createdIds.length > 0) {
    const sprintPayload = {
      name: SPRINT_DEF.name,
      description: SPRINT_DEF.description,
      item_ids: createdIds.filter(Boolean),
    }

    const sprintResult = await apiCall('POST', '/api/sprints', sprintPayload) as Record<string, unknown>

    if (sprintResult.success) {
      const data = sprintResult.data as Record<string, unknown>
      console.log(`\n✓ Sprint created: ${data.id}`)
      console.log(`  Name: ${SPRINT_DEF.name}`)
      console.log(`  Items assigned: ${createdIds.length}`)
      console.log(`  Status: INT-new`)
    } else {
      console.log(`\n✗ Sprint creation failed: ${sprintResult.error}`)
    }
  }

  console.log('\nDone. — MUSASHI, ARTxBLADE')
}

main().catch(console.error)
