/**
 * seed-sprint.ts — Seed a sprint + tickets from a Discovery Doc definition
 *
 * Creates tracker_items for each ticket, then creates the sprint and assigns them.
 * Uses the Cloud Run API (not raw Firestore) so dedup, notifications, and proper
 * TRK-XXX IDs all work automatically.
 *
 * Usage: npx tsx services/api/src/scripts/seed-sprint.ts <sprint-definition.json>
 *        npx tsx services/api/src/scripts/seed-sprint.ts --inline
 *
 * Sprint definition JSON format:
 * {
 *   "name": "Sprint 011 — ProZone COMMS",
 *   "description": "Auto-Dial, Call Disposition, MMS Attachments",
 *   "owner": "RONIN",
 *   "tickets": [
 *     { "title": "Wire TwilioDeviceProvider", "type": "feature", "priority": "P1", "phase": 1 },
 *     ...
 *   ]
 * }
 */

import { readFileSync } from 'fs'
import { JWT } from 'google-auth-library'

const TM_API_URL = process.env.TM_API_URL || 'https://tm-api-365181509090.us-central1.run.app'
const SA_KEY_PATH = '/home/jdm/mdj-agent/sa-key.json'
const MDJ_AUTH = 'mdj-alpha-shared-secret-2026'

interface TicketDef {
  title: string
  description?: string
  type?: string
  priority?: string
  phase?: number
  assigned_warrior?: string
  component?: string
}

interface SprintDef {
  name: string
  description?: string
  owner?: string
  portal?: string
  tickets: TicketDef[]
}

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
  // Read sprint definition
  let sprintDef: SprintDef

  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: npx tsx seed-sprint.ts <sprint-definition.json>')
    console.error('       npx tsx seed-sprint.ts --inline (reads from stdin)')
    process.exit(1)
  }

  if (arg === '--inline') {
    // Read from stdin
    const input = readFileSync('/dev/stdin', 'utf8')
    sprintDef = JSON.parse(input)
  } else {
    sprintDef = JSON.parse(readFileSync(arg, 'utf8'))
  }

  console.log(`\nSeeding: ${sprintDef.name}`)
  console.log(`Tickets: ${sprintDef.tickets.length}`)
  console.log(`Owner: ${sprintDef.owner || 'unassigned'}\n`)

  // Step 1: Create tracker items
  const createdIds: string[] = []
  let created = 0
  let dupes = 0
  let failed = 0

  for (const ticket of sprintDef.tickets) {
    const payload = {
      title: ticket.title,
      description: ticket.description || ticket.title,
      type: ticket.type || 'feature',
      priority: ticket.priority || 'P2',
      portal: sprintDef.portal || 'SHARED',
      scope: 'App',
      component: ticket.component || sprintDef.owner || 'PLATFORM',
      assigned_warrior: ticket.assigned_warrior || sprintDef.owner || '',
      phase: ticket.phase || 1,
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
      name: sprintDef.name,
      description: sprintDef.description || '',
      item_ids: createdIds.filter(Boolean),
    }

    const sprintResult = await apiCall('POST', '/api/sprints', sprintPayload) as Record<string, unknown>

    if (sprintResult.success) {
      const data = sprintResult.data as Record<string, unknown>
      console.log(`\n✓ Sprint created: ${data.id}`)
      console.log(`  Name: ${sprintDef.name}`)
      console.log(`  Items assigned: ${createdIds.length}`)
    } else {
      console.log(`\n✗ Sprint creation failed: ${sprintResult.error}`)
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
