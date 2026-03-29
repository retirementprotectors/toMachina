/**
 * Cross-Warrior Pre-Session Briefing
 * TRK-14182 | Sprint: Learning Loop 2.0 v2
 *
 * Extends pre-session briefing (TRK-S03-011 / TRK-14175) with cross-warrior
 * intelligence. Two sources:
 *   1. soul.md highlights from other warriors (read directly from dojo-warriors)
 *   2. Extracted knowledge_entries from other warriors (Firestore, 7 days, ≥ 0.7)
 *
 * Soul-curated entries appear first. Current warrior is excluded.
 * Graceful fallback if no cross-warrior entries exist.
 *
 * Usage:
 *   npx tsx services/learning-loop/cross-warrior-briefing.ts [warrior-name]
 *   — If no arg, detects from tmux session name.
 *
 * Also exports buildCrossWarriorBriefing() for programmatic use.
 */

import { readFile } from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { KnowledgeEntry } from './types/knowledge-entry.js'
import { KNOWLEDGE_ENTRIES_COLLECTION } from './types/knowledge-entry.js'
import { DOJO_WARRIORS_COLLECTION } from './types/warrior-registry.js'
import type { WarriorRegistry } from './types/warrior-registry.js'

const execAsync = promisify(exec)

// ── Config ───────────────────────────────────────────────────────────────────

const DOJO_WARRIORS_PATH = process.env.DOJO_WARRIORS_PATH ?? '/home/jdm/Projects/dojo-warriors'
const LOOKBACK_DAYS = 7
const MAX_SOUL_HIGHLIGHTS = 5
const MAX_KNOWLEDGE_ENTRIES = 10

// ── Confidence thresholds per tier ───────────────────────────────────────────

const SOUL_CONFIDENCE = 0.9
const SPIRIT_CONFIDENCE = 0.85
const CONTEXT_CONFIDENCE = 0.7

// ── Firebase Init ────────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp()
}

const db = getFirestore()

// ── Warrior Detection ────────────────────────────────────────────────────────

/**
 * Detect current warrior from tmux session name, or fall back to CLI arg.
 * Returns lowercase warrior name (e.g. 'musashi').
 */
async function detectCurrentWarrior(cliArg?: string): Promise<string | null> {
  // CLI argument takes precedence
  if (cliArg) {
    return cliArg.toLowerCase()
  }

  // Detect from tmux session
  try {
    const { stdout } = await execAsync('tmux display-message -p "#S"', { timeout: 5000 })
    const sessionName = stdout.trim().toLowerCase()
    if (sessionName) {
      return sessionName
    }
  } catch {
    // Not in a tmux session — that's fine
  }

  return null
}

// ── Soul.md Highlight Extraction ─────────────────────────────────────────────

/** Sections of soul.md that contain high-signal knowledge */
const HIGHLIGHT_SECTION_PATTERNS = [
  /^##\s+.*(?:architecture|decision|lasting|principle)/i,
  /^##\s+.*(?:operational|rule|protocol)/i,
  /^##\s+.*(?:creative|philosophy|approach)/i,
  /^##\s+.*(?:unique\s+capabilit|what\s+i\s+built|accomplishment)/i,
]

interface SoulHighlight {
  warrior: string
  displayName: string
  role: string
  highlights: string[]
}

/**
 * Read a warrior's soul.md and extract key highlights.
 * Returns structured highlights or null if file doesn't exist.
 */
async function extractSoulHighlights(warrior: WarriorRegistry): Promise<SoulHighlight | null> {
  if (!warrior.soul_path) return null

  const soulPath = resolve(DOJO_WARRIORS_PATH, warrior.soul_path)

  let content: string
  try {
    content = await readFile(soulPath, 'utf-8')
  } catch {
    // soul.md doesn't exist yet — graceful skip
    return null
  }

  const lines = content.split('\n')
  const highlights: string[] = []
  let inHighlightSection = false

  for (const line of lines) {
    // Check if this line is a highlight section header
    if (line.startsWith('## ')) {
      inHighlightSection = HIGHLIGHT_SECTION_PATTERNS.some((pattern) => pattern.test(line))
      continue
    }

    // Collect bullet points from highlight sections
    if (inHighlightSection && line.match(/^[-*]\s+/) && highlights.length < MAX_SOUL_HIGHLIGHTS) {
      // Clean the bullet: strip markdown bold, links, trailing whitespace
      const cleaned = line
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()

      if (cleaned.length > 10) {
        highlights.push(cleaned)
      }
    }
  }

  if (highlights.length === 0) return null

  return {
    warrior: warrior.name,
    displayName: warrior.display_name,
    role: formatRole(warrior.executive_role),
    highlights,
  }
}

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    CTO: 'CTO',
    COO: 'COO',
    VP_CMO: 'VP, CMO',
    Builder: 'Builder',
    Guardian: 'Guardian',
    Bot: 'Bot',
  }
  return roleMap[role] ?? role
}

// ── Firestore Knowledge Query ────────────────────────────────────────────────

interface CrossWarriorKnowledge {
  warrior: string
  type: string
  content: string
  confidence: number
  tier: 'soul-curated' | 'spirit-curated' | 'warrior-context'
  createdAt: Date
}

/**
 * Query Firestore knowledge_entries for cross-warrior knowledge.
 * Returns entries from OTHER warriors, ordered by confidence tier.
 */
async function queryCrossWarriorKnowledge(
  currentWarrior: string,
  otherWarriors: string[],
): Promise<CrossWarriorKnowledge[]> {
  const results: CrossWarriorKnowledge[] = []
  const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000))

  for (const warrior of otherWarriors) {
    // Tier 1: Soul-curated entries (highest priority)
    try {
      const soulSnap = await db
        .collection(KNOWLEDGE_ENTRIES_COLLECTION)
        .where('tags', 'array-contains', 'soul-curated')
        .where('confidence', '>=', SOUL_CONFIDENCE)
        .limit(5)
        .get()

      for (const doc of soulSnap.docs) {
        const data = doc.data() as KnowledgeEntry
        if (data.tags.includes(warrior)) {
          results.push({
            warrior,
            type: data.type.toUpperCase(),
            content: data.content,
            confidence: data.confidence,
            tier: 'soul-curated',
            createdAt: data.created_at.toDate(),
          })
        }
      }
    } catch {
      // Index may not exist yet — skip silently
    }

    // Tier 2: Spirit-curated entries
    try {
      const spiritSnap = await db
        .collection(KNOWLEDGE_ENTRIES_COLLECTION)
        .where('tags', 'array-contains', 'spirit-curated')
        .where('confidence', '>=', SPIRIT_CONFIDENCE)
        .limit(5)
        .get()

      for (const doc of spiritSnap.docs) {
        const data = doc.data() as KnowledgeEntry
        if (data.tags.includes(warrior)) {
          results.push({
            warrior,
            type: data.type.toUpperCase(),
            content: data.content,
            confidence: data.confidence,
            tier: 'spirit-curated',
            createdAt: data.created_at.toDate(),
          })
        }
      }
    } catch {
      // Index may not exist yet — skip silently
    }

    // Tier 3: Recent warrior-context entries (7 days)
    try {
      const contextSnap = await db
        .collection(KNOWLEDGE_ENTRIES_COLLECTION)
        .where('tags', 'array-contains', 'warrior-context')
        .where('confidence', '>=', CONTEXT_CONFIDENCE)
        .where('created_at', '>=', sevenDaysAgo)
        .limit(5)
        .get()

      for (const doc of contextSnap.docs) {
        const data = doc.data() as KnowledgeEntry
        if (data.tags.includes(warrior)) {
          results.push({
            warrior,
            type: data.type.toUpperCase(),
            content: data.content,
            confidence: data.confidence,
            tier: 'warrior-context',
            createdAt: data.created_at.toDate(),
          })
        }
      }
    } catch {
      // Index may not exist yet — skip silently
    }
  }

  // Sort: soul-curated first, then spirit-curated, then warrior-context
  const tierOrder: Record<string, number> = {
    'soul-curated': 0,
    'spirit-curated': 1,
    'warrior-context': 2,
  }

  results.sort((a, b) => {
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier]
    if (tierDiff !== 0) return tierDiff
    return b.confidence - a.confidence
  })

  return results.slice(0, MAX_KNOWLEDGE_ENTRIES)
}

// ── Briefing Formatter ───────────────────────────────────────────────────────

/**
 * Build the complete cross-warrior briefing block.
 * Returns formatted markdown or empty string if no entries exist.
 */
export async function buildCrossWarriorBriefing(currentWarrior: string): Promise<string> {
  // 1. Get warrior registry from Firestore
  let warriors: WarriorRegistry[]
  try {
    const snap = await db.collection(DOJO_WARRIORS_COLLECTION).where('type', '==', 'tmux').get()
    warriors = snap.docs.map((doc) => ({ ...doc.data(), name: doc.id }) as WarriorRegistry)
  } catch {
    // Firestore unavailable — try soul.md direct read with hardcoded warriors
    warriors = getHardcodedTmuxWarriors()
  }

  // 2. Filter to OTHER warriors only (self-exclusion)
  const otherWarriors = warriors.filter((w) => w.name !== currentWarrior)

  if (otherWarriors.length === 0) {
    return ''
  }

  const sections: string[] = []

  // 3. Source 1: Direct soul.md highlights (always available)
  const soulHighlights: SoulHighlight[] = []
  for (const warrior of otherWarriors) {
    const highlights = await extractSoulHighlights(warrior)
    if (highlights) {
      soulHighlights.push(highlights)
    }
  }

  if (soulHighlights.length > 0) {
    for (const soul of soulHighlights) {
      const lines = soul.highlights.map((h) => `  - ${h}`)
      sections.push(`### From ${soul.displayName} (${soul.role}) — Soul Highlights\n${lines.join('\n')}`)
    }
  }

  // 4. Source 2: Firestore extracted knowledge (supplementary)
  const otherNames = otherWarriors.map((w) => w.name)
  let knowledgeEntries: CrossWarriorKnowledge[] = []
  try {
    knowledgeEntries = await queryCrossWarriorKnowledge(currentWarrior, otherNames)
  } catch {
    // Firestore query failed — soul.md highlights are sufficient
  }

  if (knowledgeEntries.length > 0) {
    const lines = knowledgeEntries.map(
      (e) => `  - [${e.type}] ${e.content} _(${e.confidence.toFixed(2)}, ${e.tier})_`,
    )
    sections.push(`### Recent Warrior Knowledge (${LOOKBACK_DAYS} days)\n${lines.join('\n')}`)
  }

  // 5. Graceful fallback: return empty if nothing found
  if (sections.length === 0) {
    return ''
  }

  return `## Cross-Warrior Intelligence\n${sections.join('\n\n')}`
}

// ── Hardcoded Fallback ───────────────────────────────────────────────────────

/**
 * Fallback warrior list when Firestore is unavailable.
 * Matches seed-warriors.ts data for the 3 Executive.AI tmux warriors.
 */
function getHardcodedTmuxWarriors(): WarriorRegistry[] {
  return [
    {
      name: 'shinob1',
      display_name: 'SHINOB1',
      type: 'tmux',
      executive_role: 'CTO',
      personality: 'The Architect',
      status: 'active',
      soul_path: 'shinob1/soul.md',
      spirit_path: 'shinob1/spirit.md',
      brain_path: 'shinob1/brain.txt',
      last_brain_update: null,
      last_session_start: null,
      machine: 'mdj1',
      tmux_session: 'SHINOB1',
      ccsdk_route: null,
    },
    {
      name: '2hinobi',
      display_name: '2HINOBI',
      type: 'tmux',
      executive_role: 'COO',
      personality: 'The Operator',
      status: 'active',
      soul_path: '2hinobi/soul.md',
      spirit_path: '2hinobi/spirit.md',
      brain_path: '2hinobi/brain.txt',
      last_brain_update: null,
      last_session_start: null,
      machine: 'mdj1',
      tmux_session: '2HINOBI',
      ccsdk_route: null,
    },
    {
      name: 'musashi',
      display_name: 'MUSASHI',
      type: 'tmux',
      executive_role: 'VP_CMO',
      personality: 'The Creative',
      status: 'active',
      soul_path: 'musashi/soul.md',
      spirit_path: 'musashi/spirit.md',
      brain_path: 'musashi/brain.txt',
      last_brain_update: null,
      last_session_start: null,
      machine: 'mdj1',
      tmux_session: 'MUSASHI',
      ccsdk_route: null,
    },
  ]
}

// ── Main (CLI entry point) ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const cliArg = process.argv[2]
  const currentWarrior = await detectCurrentWarrior(cliArg)

  if (!currentWarrior) {
    console.error('[cross-warrior-briefing] Could not detect warrior. Pass name as argument.')
    console.error('  Usage: npx tsx cross-warrior-briefing.ts [warrior-name]')
    process.exit(1)
  }

  console.info(`[cross-warrior-briefing] Warrior: ${currentWarrior.toUpperCase()}`)
  console.info(`[cross-warrior-briefing] Building cross-warrior briefing...`)

  const briefing = await buildCrossWarriorBriefing(currentWarrior)

  if (!briefing) {
    console.info('[cross-warrior-briefing] No cross-warrior entries found. Skipping.')
    process.exit(0)
  }

  // Output the briefing block to stdout for hookify consumption
  console.info('')
  console.info(briefing)
}

// ── Entry Point ──────────────────────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    // Graceful degradation: log error but don't block session start
    console.error(`[cross-warrior-briefing] Error (non-blocking): ${message}`)
    process.exit(0) // Exit 0 so hookify doesn't treat this as a failure
  })
