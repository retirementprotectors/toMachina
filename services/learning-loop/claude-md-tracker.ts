/**
 * CLAUDE.md Evolution Tracker
 * TRK-14184 | Sprint: Learning Loop 2.0 v2
 *
 * Tracks diffs in CLAUDE.md over time using dojo-warriors git history.
 * Surfaces "What changed in last 7 days" in pre-session briefing.
 * Weekly diff summary -> knowledge_entries with type 'insight'.
 *
 * Schedule: Weekly Sunday 3am via systemd timer on MDJ1.
 * Model: claude-haiku-4-5-20251001 for cost-efficient summarization.
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import Anthropic from '@anthropic-ai/sdk'
import type { KnowledgeEntry } from './types/knowledge-entry.js'
import { KNOWLEDGE_ENTRIES_COLLECTION } from './types/knowledge-entry.js'

const execAsync = promisify(exec)

// ── Config ───────────────────────────────────────────────────────────────────

const DOJO_WARRIORS_PATH = process.env.DOJO_WARRIORS_PATH ?? '/home/jdm/Projects/dojo-warriors'
const CLAUDE_MD_RELATIVE = 'mdj-server-config/CLAUDE.md'
const LOOKBACK_DAYS = 7
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const CONFIDENCE_SCORE = 0.88
const MAX_DIFF_CHARS = 3000

// ── Firebase Init ────────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp()
}

const db = getFirestore()
const anthropic = new Anthropic()

// ── Types ────────────────────────────────────────────────────────────────────

interface CommitDiff {
  hash: string
  date: string
  message: string
  diff: string
}

// ── Git History Analysis ─────────────────────────────────────────────────────

async function getRecentCommits(): Promise<CommitDiff[]> {
  const logCmd = [
    `cd "${DOJO_WARRIORS_PATH}"`,
    `git log --since="${LOOKBACK_DAYS} days ago"`,
    `--format="COMMIT_START %H|%aI|%s"`,
    `-p -- "${CLAUDE_MD_RELATIVE}"`,
  ].join(' && ').replace(/\n/g, ' ')

  // Reconstruct as a single command
  const fullCmd = `cd "${DOJO_WARRIORS_PATH}" && git log --since="${LOOKBACK_DAYS} days ago" --format="COMMIT_START %H|%aI|%s" -p -- "${CLAUDE_MD_RELATIVE}"`

  let stdout: string
  try {
    const result = await execAsync(fullCmd, { maxBuffer: 10 * 1024 * 1024 })
    stdout = result.stdout
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // git log returns empty if no commits match — not an error
    if (message.includes('does not have any commits')) {
      return []
    }
    throw err
  }

  if (!stdout.trim()) {
    return []
  }

  return parseGitLog(stdout)
}

function parseGitLog(gitOutput: string): CommitDiff[] {
  const commits: CommitDiff[] = []
  const blocks = gitOutput.split('COMMIT_START ').filter(Boolean)

  for (const block of blocks) {
    const firstNewline = block.indexOf('\n')
    if (firstNewline === -1) continue

    const header = block.substring(0, firstNewline).trim()
    const [hash, date, ...messageParts] = header.split('|')
    const message = messageParts.join('|') // message may contain pipes

    if (!hash || !date) continue

    // Extract the diff portion (everything after the header)
    const diffStart = block.indexOf('diff --git')
    const diff = diffStart > -1 ? block.substring(diffStart) : ''

    if (diff) {
      commits.push({
        hash: hash.substring(0, 7),
        date,
        message: message || '(no message)',
        diff,
      })
    }
  }

  return commits
}

// ── AI Summarization ─────────────────────────────────────────────────────────

async function summarizeChanges(commits: CommitDiff[]): Promise<string> {
  // Combine all diffs into a single context for a holistic summary
  const combinedDiffs = commits
    .map((c) => {
      return [
        `--- Commit ${c.hash} (${c.date}) ---`,
        `Message: ${c.message}`,
        '',
        c.diff.substring(0, Math.floor(MAX_DIFF_CHARS / commits.length)),
      ].join('\n')
    })
    .join('\n\n')

  const prompt = `You are analyzing changes to a CLAUDE.md file — the ruleset that governs AI agent behavior in the toMachina platform.

Below are git diffs from the past ${LOOKBACK_DAYS} days. Summarize:
1. WHAT rules changed (added, removed, or modified)
2. WHY they likely changed (the intent behind the change)
3. Any impact on agent behavior

Keep it concise and human-readable — 2-4 sentences max. Write as a changelog entry that a developer would find useful at the start of their session.

Do NOT include raw diff syntax. Do NOT say "Based on the diffs" or similar preamble.

DIFFS:
${combinedDiffs.substring(0, MAX_DIFF_CHARS)}`

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock ? textBlock.text.trim() : '(No summary generated)'
}

// ── Knowledge Entry Creation ─────────────────────────────────────────────────

async function writeKnowledgeEntry(summary: string, commitCount: number, dateRange: string): Promise<string> {
  const entry: Omit<KnowledgeEntry, 'id'> = {
    type: 'insight',
    content: `[Rules Evolution — ${dateRange}] ${summary}`,
    tags: ['claude-md-evolution', 'weekly', 'global'],
    confidence: CONFIDENCE_SCORE,
    source_session_id: `claude-md-evolution-${new Date().toISOString().split('T')[0]}`,
    machine: 'mdj1',
    created_at: Timestamp.now(),
    promoted_to_claude_md: false,
    sprint_context: {
      sprint_id: 'ongoing',
      phase: 'evolution-tracking',
      tickets: ['TRK-14184'],
    },
  }

  const ref = await db.collection(KNOWLEDGE_ENTRIES_COLLECTION).add(entry)
  return ref.id
}

// ── Pre-Session Briefing Section Builder ─────────────────────────────────────

/**
 * Queries recent CLAUDE.md evolution entries and formats them
 * as a "Rules Evolution" section for the pre-session briefing.
 *
 * Called by the intent-session-start hook (TRK-14175).
 */
export async function buildRulesEvolutionBriefing(): Promise<string> {
  const snapshot = await db
    .collection(KNOWLEDGE_ENTRIES_COLLECTION)
    .where('tags', 'array-contains', 'claude-md-evolution')
    .orderBy('created_at', 'desc')
    .limit(3)
    .get()

  if (snapshot.empty) {
    return ''
  }

  const lines = snapshot.docs.map((doc) => {
    const data = doc.data() as KnowledgeEntry
    const date = data.created_at.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `- ${data.content} _(${date})_`
  })

  return `## Rules Evolution (Last 7 Days)\n${lines.join('\n')}`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.info('[claude-md-tracker] Starting CLAUDE.md evolution tracking...')
  console.info(`[claude-md-tracker] Repo: ${DOJO_WARRIORS_PATH}`)
  console.info(`[claude-md-tracker] File: ${CLAUDE_MD_RELATIVE}`)
  console.info(`[claude-md-tracker] Lookback: ${LOOKBACK_DAYS} days`)

  // 1. Get recent commits
  const commits = await getRecentCommits()

  if (commits.length === 0) {
    console.info('[claude-md-tracker] No CLAUDE.md changes in the past 7 days. Exiting.')
    return
  }

  console.info(`[claude-md-tracker] Found ${commits.length} commit(s) with CLAUDE.md changes.`)

  // 2. Summarize with Haiku
  const summary = await summarizeChanges(commits)
  console.info(`[claude-md-tracker] Summary: ${summary.substring(0, 100)}...`)

  // 3. Build date range label
  const dates = commits.map((c) => new Date(c.date))
  const oldest = new Date(Math.min(...dates.map((d) => d.getTime())))
  const newest = new Date(Math.max(...dates.map((d) => d.getTime())))
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRange = oldest.toDateString() === newest.toDateString()
    ? fmt(newest)
    : `${fmt(oldest)} – ${fmt(newest)}`

  // 4. Write knowledge entry
  const docId = await writeKnowledgeEntry(summary, commits.length, dateRange)
  console.info(`[claude-md-tracker] Wrote knowledge_entry: ${docId}`)
  console.info('[claude-md-tracker] Done.')
}

// ── Entry Point ──────────────────────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[claude-md-tracker] Fatal error: ${message}`)
    process.exit(1)
  })
