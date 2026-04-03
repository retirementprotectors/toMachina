/**
 * RONIN Sprint Phase Memory Writes — TRK-14176
 *
 * Called at the end of each FORGE sprint phase to persist
 * discoveries as knowledge_entries in Firestore.
 *
 * Integration point: /home/jdm/mdj-agent/src/forge/runner.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { KnowledgeEntry } from './types/knowledge-entry.js'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}

export interface Discovery {
  type: KnowledgeEntry['type']
  content: string
  tags: string[]
  confidence: number
  relatedTickets: string[]
}

/**
 * Write phase discoveries to Firestore knowledge_entries.
 */
export async function writePhaseMemory(
  sprintId: string,
  phase: string,
  discoveries: Discovery[]
): Promise<number> {
  if (discoveries.length === 0) return 0

  const db = getFirestore()
  const writeBatch = db.batch()

  for (const d of discoveries) {
    const ref = db.collection('knowledge_entries').doc()
    const entry: Record<string, unknown> = {
      id: ref.id,
      type: d.type,
      content: d.content,
      tags: [...d.tags, 'ronin', `sprint-${sprintId}`, `phase-${phase}`],
      confidence: d.confidence,
      machine: 'mdj1' as const,
      source_session_id: sprintId,
      created_at: Timestamp.now(),
      promoted_to_claude_md: false,
      sprint_context: {
        sprint_id: sprintId,
        phase,
        tickets: d.relatedTickets,
      },
    }
    writeBatch.set(ref, entry)
  }

  await writeBatch.commit()
  console.log(`[phase-memory] Wrote ${discoveries.length} entries for sprint ${sprintId} phase ${phase}`)
  return discoveries.length
}

/**
 * Extract discoveries from FORGE phase output text.
 */
export function extractDiscoveries(phaseOutput: string, sprintId: string, tickets: string[]): Discovery[] {
  const discoveries: Discovery[] = []
  const lines = phaseOutput.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 20) continue

    if (/\b(decided|chose|switched to|went with|using)\b/i.test(trimmed)) {
      discoveries.push({
        type: 'decision',
        content: trimmed.slice(0, 500),
        tags: ['forge-phase'],
        confidence: 0.75,
        relatedTickets: tickets,
      })
    }

    if (/\b(gotcha|watch out|careful|workaround)\b/i.test(trimmed)) {
      discoveries.push({
        type: 'pattern',
        content: trimmed.slice(0, 500),
        tags: ['forge-phase', 'gotcha'],
        confidence: 0.85,
        relatedTickets: tickets,
      })
    }
  }

  return discoveries
}
