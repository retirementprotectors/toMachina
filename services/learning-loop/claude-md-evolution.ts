/**
 * CLAUDE.md Evolution Tracking — TRK-S03-020
 *
 * Tracks diffs in CLAUDE.md over time using git history.
 * Surfaces "what changed in last 7 days" in pre-session briefing.
 * Weekly diff summary -> knowledge_entries (type 'evolution').
 *
 * Usage: npx tsx claude-md-evolution.ts
 */

import { execSync } from 'child_process'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const COLLECTION = 'knowledge_entries'

interface EvolutionEntry {
  entry_id: string
  type: 'evolution'
  content: string
  confidence: number
  tags: string[]
  project: string
  source_machine: string
  created_at: string
  updated_at: string
}

/**
 * Get CLAUDE.md git diff for the last N days.
 */
export function getClaudeMdDiff(repoPath: string, days: number = 7): string {
  try {
    const since = `${days} days ago`
    const diff = execSync(
      `cd "${repoPath}" && git log --since="${since}" --oneline -p -- CLAUDE.md`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    )
    return diff || 'No changes to CLAUDE.md in the last ' + days + ' days.'
  } catch {
    return 'Could not read CLAUDE.md git history.'
  }
}

/**
 * Summarize the diff into human-readable evolution entries.
 */
export function summarizeDiff(diff: string): string[] {
  if (diff.includes('No changes') || diff.includes('Could not read')) {
    return []
  }

  const summaries: string[] = []
  const lines = diff.split('\n')

  let currentCommit = ''
  const additions: string[] = []
  const deletions: string[] = []

  for (const line of lines) {
    if (line.match(/^[a-f0-9]{7,}/)) {
      // New commit line
      if (currentCommit && (additions.length > 0 || deletions.length > 0)) {
        summaries.push(
          `${currentCommit}: +${additions.length} lines, -${deletions.length} lines`
        )
      }
      currentCommit = line
      additions.length = 0
      deletions.length = 0
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions.push(line.slice(1))
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions.push(line.slice(1))
    }
  }

  // Last commit
  if (currentCommit && (additions.length > 0 || deletions.length > 0)) {
    summaries.push(
      `${currentCommit}: +${additions.length} lines, -${deletions.length} lines`
    )
  }

  return summaries
}

/**
 * Write evolution entries to Firestore.
 */
export async function trackEvolution(repoPath: string, machine: string): Promise<number> {
  if (getApps().length === 0) {
    initializeApp({ credential: cert('/home/jdm/mdj-agent/sa-key.json') })
  }

  const diff = getClaudeMdDiff(repoPath, 7)
  const summaries = summarizeDiff(diff)

  if (summaries.length === 0) {
    console.log('No CLAUDE.md evolution in last 7 days.')
    return 0
  }

  const db = getFirestore()
  const now = new Date().toISOString()
  let written = 0

  for (const summary of summaries) {
    const entry: EvolutionEntry = {
      entry_id: `evolution-${Date.now()}-${written}`,
      type: 'evolution',
      content: `CLAUDE.md change: ${summary}`,
      confidence: 0.8,
      tags: ['claude-md', 'evolution', machine],
      project: repoPath,
      source_machine: machine,
      created_at: now,
      updated_at: now,
    }

    await db.collection(COLLECTION).doc(entry.entry_id).set(entry)
    written++
  }

  console.log(`Tracked ${written} CLAUDE.md evolution entries.`)
  return written
}
