// extract-ronin-brain.ts — Pull all RONIN sprint data from Firestore into brain.txt
// Usage: GOOGLE_APPLICATION_CREDENTIALS=path/to/sa-key.json npx tsx services/api/src/scripts/extract-ronin-brain.ts

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const OUTPUT_PATH = '/home/jdm/Projects/dojo-warriors/ronin/brain.txt'

interface ForgeRun {
  id: string
  sprint_name?: string
  name?: string
  phase?: string
  status?: string
  started_at?: string
  updated_at?: string
  completed_at?: string
  gatesPending?: string[]
  gate_reason?: string
  ticket_count?: number
  tickets_built?: number
  tickets_failed?: number
  pr_url?: string
  branch?: string
  error?: string
  [key: string]: unknown
}

interface TrackerItem {
  id: string
  item_id?: string
  title?: string
  description?: string
  status?: string
  type?: string
  priority?: string
  sprint_id?: string
  portal?: string
  scope?: string
  component?: string
  section?: string
  created_at?: string
  updated_at?: string
  notes?: string
  [key: string]: unknown
}

interface SprintDoc {
  id: string
  name?: string
  description?: string
  status?: string
  item_ids?: string[]
  created_at?: string
  updated_at?: string
  discovery_url?: string
  plan_link?: string
  [key: string]: unknown
}

async function run() {
  console.log('[RONIN] Querying Firestore collections...')

  const [forgeSnap, sprintSnap, trackerSnap] = await Promise.all([
    db.collection('mdj_forge_runs').orderBy('started_at', 'asc').get().catch(() => null),
    db.collection('sprints').orderBy('created_at', 'asc').get(),
    db.collection('tracker_items').get(),
  ])

  const trackerBySprintId = new Map<string, TrackerItem[]>()
  const allTrackerItems: TrackerItem[] = []
  for (const doc of trackerSnap.docs) {
    const item = { id: doc.id, ...doc.data() } as TrackerItem
    allTrackerItems.push(item)
    const sid = item.sprint_id
    if (sid) {
      if (!trackerBySprintId.has(sid)) trackerBySprintId.set(sid, [])
      trackerBySprintId.get(sid)!.push(item)
    }
  }

  const lines: string[] = [
    '# RONIN Brain — Sprint Execution Log',
    `# Extracted: ${new Date().toISOString()}`,
    `# FORGE runs: ${forgeSnap?.size ?? 0}`,
    `# Sprints: ${sprintSnap.size}`,
    `# Tracker items: ${trackerSnap.size}`,
    '',
  ]

  // Section 1: FORGE Runs
  lines.push('='.repeat(80))
  lines.push('  SECTION 1: FORGE RUN HISTORY (mdj_forge_runs)')
  lines.push('='.repeat(80))
  lines.push('')

  if (!forgeSnap || forgeSnap.empty) {
    lines.push('  (no FORGE runs found)')
    lines.push('')
  } else {
    for (const doc of forgeSnap.docs) {
      const run = { id: doc.id, ...doc.data() } as ForgeRun
      const name = run.sprint_name ?? run.name ?? 'unnamed'
      const phase = run.phase ?? 'unknown'
      const started = run.started_at ?? ''
      const updated = run.updated_at ?? ''
      const completed = run.completed_at ?? ''

      lines.push('-'.repeat(80))
      lines.push(`RUN: ${doc.id}`)
      lines.push(`  Sprint: ${name}`)
      lines.push(`  Phase: ${phase}`)
      if (run.status) lines.push(`  Status: ${run.status}`)
      lines.push(`  Started: ${started}`)
      if (updated) lines.push(`  Updated: ${updated}`)
      if (completed) lines.push(`  Completed: ${completed}`)
      if (run.ticket_count) lines.push(`  Tickets: ${run.ticket_count} total, ${run.tickets_built ?? 0} built, ${run.tickets_failed ?? 0} failed`)
      if (run.branch) lines.push(`  Branch: ${run.branch}`)
      if (run.pr_url) lines.push(`  PR: ${run.pr_url}`)
      if (run.gate_reason) lines.push(`  Gate Reason: ${run.gate_reason}`)
      if (run.gatesPending && run.gatesPending.length > 0) {
        lines.push(`  Gates Pending: ${run.gatesPending.join(', ')}`)
      }
      if (run.error) lines.push(`  Error: ${run.error}`)

      const printed = new Set(['id', 'sprint_name', 'name', 'phase', 'status', 'started_at', 'updated_at', 'completed_at', 'ticket_count', 'tickets_built', 'tickets_failed', 'branch', 'pr_url', 'gate_reason', 'gatesPending', 'error'])
      for (const [k, v] of Object.entries(run)) {
        if (printed.has(k) || v === undefined || v === null || v === '') continue
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
        if (val.length < 500) lines.push(`  ${k}: ${val}`)
      }

      lines.push('')
    }
  }

  // Section 2: Sprints + Tickets
  lines.push('')
  lines.push('='.repeat(80))
  lines.push('  SECTION 2: SPRINT HISTORY (sprints + tracker_items)')
  lines.push('='.repeat(80))
  lines.push('')

  for (const sprintDoc of sprintSnap.docs) {
    const sprint = { id: sprintDoc.id, ...sprintDoc.data() } as SprintDoc
    const name = sprint.name ?? 'unnamed'
    const status = sprint.status ?? 'unknown'

    lines.push('='.repeat(80))
    lines.push(`SPRINT: ${name} [${sprint.id}]`)
    lines.push(`  Status: ${status}`)
    lines.push(`  Created: ${sprint.created_at ?? ''}`)
    if (sprint.description) lines.push(`  Description: ${sprint.description}`)
    if (sprint.discovery_url) lines.push(`  Discovery: ${sprint.discovery_url}`)
    if (sprint.plan_link) lines.push(`  Plan: ${sprint.plan_link}`)

    const tickets = trackerBySprintId.get(sprint.id) ?? []
    if (tickets.length === 0) {
      lines.push('  Tickets: (none)')
    } else {
      tickets.sort((a, b) => (a.item_id ?? a.id).localeCompare(b.item_id ?? b.id))
      lines.push(`  Tickets: ${tickets.length}`)
      lines.push('')

      for (const t of tickets) {
        const tid = t.item_id ?? t.id
        const tStatus = t.status ?? 'unknown'
        const tTitle = t.title ?? '(untitled)'
        const tType = t.type ?? ''
        const tPriority = t.priority ?? ''

        lines.push(`    [${tid}] ${tStatus.toUpperCase()} -- ${tTitle}`)
        if (tType || tPriority) lines.push(`      Type: ${tType}  Priority: ${tPriority}`)
        if (t.portal) lines.push(`      Portal: ${t.portal}`)
        if (t.component) lines.push(`      Component: ${t.component} / ${t.section ?? ''}`)
        if (t.description && t.description.length < 300) lines.push(`      Desc: ${t.description}`)
        if (t.notes) lines.push(`      Notes: ${t.notes}`)
        lines.push('')
      }
    }
    lines.push('')
  }

  // Section 3: Unassigned tracker items
  const unassigned = allTrackerItems.filter(t => !t.sprint_id)
  if (unassigned.length > 0) {
    lines.push('')
    lines.push('='.repeat(80))
    lines.push('  SECTION 3: UNASSIGNED TRACKER ITEMS (no sprint_id)')
    lines.push('='.repeat(80))
    lines.push('')
    lines.push(`  Total unassigned: ${unassigned.length}`)
    lines.push('')

    const byStatus = new Map<string, TrackerItem[]>()
    for (const t of unassigned) {
      const s = t.status ?? 'unknown'
      if (!byStatus.has(s)) byStatus.set(s, [])
      byStatus.get(s)!.push(t)
    }

    for (const [status, items] of [...byStatus.entries()].sort()) {
      lines.push(`  -- ${status.toUpperCase()} (${items.length}) --`)
      for (const t of items.slice(0, 50)) {
        const tid = t.item_id ?? t.id
        lines.push(`    [${tid}] ${t.title ?? '(untitled)'}`)
      }
      if (items.length > 50) lines.push(`    ... and ${items.length - 50} more`)
      lines.push('')
    }
  }

  lines.push('='.repeat(80))
  lines.push(`# End of RONIN Brain -- ${forgeSnap?.size ?? 0} runs, ${sprintSnap.size} sprints, ${trackerSnap.size} items`)

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8')

  console.log(`[RONIN] Brain extracted:`)
  console.log(`  FORGE runs: ${forgeSnap?.size ?? 0}`)
  console.log(`  Sprints: ${sprintSnap.size}`)
  console.log(`  Tracker items: ${trackerSnap.size}`)
  console.log(`[RONIN] Written to: ${OUTPUT_PATH}`)
}

run().catch((err) => {
  console.error('[RONIN] Fatal error:', err)
  process.exit(1)
})
