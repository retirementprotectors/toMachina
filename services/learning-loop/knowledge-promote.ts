/**
 * knowledge-promote.ts — TRK-S03-010
 * Nightly job (4am via systemd timer) that promotes high-confidence
 * knowledge entries into a Slack DM digest for JDM.
 *
 * Flow:
 * 1. Query Firestore for unpromoted entries with confidence >= 0.8
 * 2. Group by type (decision, pattern, insight, violation, architecture)
 * 3. Format as Slack digest
 * 4. Post to JDM's DM (U09BBHTN8F2)
 * 5. Mark entries as promoted in Firestore
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { KNOWLEDGE_ENTRIES_COLLECTION } from './types/knowledge-entry.js'
import type { KnowledgeEntry, KnowledgeEntryType } from './types/knowledge-entry.js'
import { trackRun } from './wire-run-tracker.js'

// Firebase Init
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json'
const sa = JSON.parse(readFileSync(saPath, 'utf-8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Config
const CONFIDENCE_THRESHOLD = 0.8
const MAX_ENTRIES = 30
const JDM_USER_ID = 'U09BBHTN8F2'
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''

// Type display
const TYPE_LABELS: Record<string, string> = {
  decision: 'Decisions', pattern: 'Patterns', insight: 'Insights',
  violation: 'Violations', architecture: 'Architecture',
}
const TYPE_EMOJI: Record<string, string> = {
  decision: ':dart:', pattern: ':repeat:', insight: ':bulb:',
  violation: ':rotating_light:', architecture: ':building_construction:',
}

async function postSlackDM(userId: string, text: string): Promise<void> {
  if (!SLACK_TOKEN) { console.log('[promote] No token. Stdout:\n', text); return }
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: userId, text }),
  })
  const json = await res.json() as { ok: boolean; error?: string }
  if (!json.ok) console.error('[promote] Slack error:', json.error)
}

async function promote(): Promise<void> {
  console.log(`[promote] ${new Date().toISOString()}`)

  const snap = await db.collection(KNOWLEDGE_ENTRIES_COLLECTION)
    .where('promoted_to_claude_md', '==', false)
    .where('confidence', '>=', CONFIDENCE_THRESHOLD)
    .orderBy('confidence', 'desc')
    .limit(MAX_ENTRIES)
    .get()

  if (snap.empty) { console.log('[promote] No entries above threshold.'); return }
  console.log(`[promote] ${snap.size} entries`)

  // Group by type
  const grouped = new Map<string, Array<KnowledgeEntry & { id: string }>>()
  for (const doc of snap.docs) {
    const entry = { id: doc.id, ...doc.data() } as KnowledgeEntry & { id: string }
    const t = entry.type || 'insight'
    if (!grouped.has(t)) grouped.set(t, [])
    grouped.get(t)!.push(entry)
  }

  // Build digest
  const lines: string[] = [
    `*:brain: Knowledge Promote — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}*`,
    `${snap.size} entries >= ${CONFIDENCE_THRESHOLD} confidence.\n`,
  ]
  for (const [type, entries] of grouped) {
    lines.push(`${TYPE_EMOJI[type] || ':memo:'} *${TYPE_LABELS[type] || type}* (${entries.length})`)
    for (const e of entries) {
      const conf = (e.confidence * 100).toFixed(0)
      const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : ''
      lines.push(`  - (${conf}%, ${e.machine || '?'}) ${e.content}${tags}`)
    }
    lines.push('')
  }
  lines.push('_Review above. Tell MUSASHI or SHINOB1 to add to CLAUDE.md._')

  await postSlackDM(JDM_USER_ID, lines.join('\n'))
  console.log(`[promote] Digest sent (${snap.size} entries)`)

  // Mark promoted
  const batch = db.batch()
  const now = FieldValue.serverTimestamp()
  for (const doc of snap.docs) {
    batch.update(doc.ref, { promoted_to_claude_md: true, promoted_at: now })
  }
  await batch.commit()
  console.log(`[promote] ${snap.size} marked promoted`)
}

// LL-07: wire-run-tracker wraps main() for dashboard visibility.
trackRun('knowledge-promote', promote)
  .then(() => process.exit(0))
  .catch((err) => { console.error('[promote] Fatal:', err); process.exit(1) })
