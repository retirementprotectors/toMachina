/**
 * pre-session-briefing.ts — TRK-S03-011 + TRK-S03-018
 * Pre-session briefing generator for the intent-session-start hookify rule.
 *
 * When a warrior session starts, this script:
 * 1. Queries Firestore for recent knowledge entries (last 7 days, confidence >= 0.7)
 * 2. Queries soul.md highlights from OTHER warriors (cross-warrior context)
 * 3. Formats a concise briefing block
 * 4. Outputs to stdout for hookify injection
 *
 * Usage: node pre-session-briefing.js <warrior-name>
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'
import { KNOWLEDGE_ENTRIES_COLLECTION } from './types/knowledge-entry.js'
import type { KnowledgeEntry } from './types/knowledge-entry.js'

// Firebase Init
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/jdm/mdj-agent/sa-key.json'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sa = require(saPath)
initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Config
const DOJO_DIR = '/home/jdm/Projects/dojo-warriors'
const LOOKBACK_DAYS = 7
const MIN_CONFIDENCE = 0.7
const MAX_ENTRIES = 15
const MAX_SOUL_HIGHLIGHTS = 5

function getWarriorName(): string {
  return (process.env.WARRIOR_NAME || process.argv[2] || 'unknown').toLowerCase()
}

// Get recent knowledge entries NOT from this warrior
async function getRecentKnowledge(excludeWarrior: string): Promise<KnowledgeEntry[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)

  const snap = await db.collection(KNOWLEDGE_ENTRIES_COLLECTION)
    .where('confidence', '>=', MIN_CONFIDENCE)
    .orderBy('confidence', 'desc')
    .limit(MAX_ENTRIES * 2) // over-fetch, filter locally
    .get()

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as KnowledgeEntry & { id: string })
    .filter(e => {
      // Exclude entries from this warrior
      const tags = e.tags || []
      return !tags.includes(`warrior:${excludeWarrior}`)
    })
    .slice(0, MAX_ENTRIES)
}

// Get soul.md highlights from OTHER warriors
function getSoulHighlights(excludeWarrior: string): Array<{ warrior: string; highlights: string[] }> {
  if (!fs.existsSync(DOJO_DIR)) return []

  const warriors = fs.readdirSync(DOJO_DIR)
    .filter(d => d !== excludeWarrior && fs.statSync(path.join(DOJO_DIR, d)).isDirectory())

  const results: Array<{ warrior: string; highlights: string[] }> = []

  for (const warrior of warriors) {
    const soulPath = path.join(DOJO_DIR, warrior, 'soul.md')
    if (!fs.existsSync(soulPath)) continue

    const content = fs.readFileSync(soulPath, 'utf-8')

    // Extract key decisions and role info (lines starting with ** or containing "Key Decisions")
    const highlights: string[] = []
    const lines = content.split('\n')
    let inKeySection = false

    for (const line of lines) {
      if (line.includes('Key Decisions') || line.includes('Role in the Dojo')) {
        inKeySection = true
        continue
      }
      if (inKeySection && line.startsWith('---')) {
        inKeySection = false
        continue
      }
      if (inKeySection && line.startsWith('**') && highlights.length < MAX_SOUL_HIGHLIGHTS) {
        highlights.push(line.replace(/\*\*/g, '').trim())
      }
    }

    if (highlights.length > 0) {
      results.push({ warrior, highlights })
    }
  }

  return results
}

// Format the briefing
function formatBriefing(
  warrior: string,
  knowledge: KnowledgeEntry[],
  soulHighlights: Array<{ warrior: string; highlights: string[] }>
): string {
  const lines: string[] = [
    `# Pre-Session Briefing for ${warrior.toUpperCase()}`,
    `Generated: ${new Date().toISOString()}\n`,
  ]

  // Cross-warrior soul highlights
  if (soulHighlights.length > 0) {
    lines.push('## Cross-Warrior Context')
    for (const { warrior: w, highlights } of soulHighlights) {
      lines.push(`**${w.toUpperCase()}:**`)
      for (const h of highlights) {
        lines.push(`  - ${h}`)
      }
    }
    lines.push('')
  }

  // Recent knowledge entries
  if (knowledge.length > 0) {
    lines.push('## Recent Knowledge (last 7 days)')
    for (const entry of knowledge) {
      const conf = (entry.confidence * 100).toFixed(0)
      const type = entry.type || 'insight'
      lines.push(`- [${type}, ${conf}%] ${entry.content}`)
    }
    lines.push('')
  }

  if (knowledge.length === 0 && soulHighlights.length === 0) {
    lines.push('_No cross-warrior context or recent knowledge entries available._')
  }

  return lines.join('\n')
}

// Main
async function brief(): Promise<void> {
  const warrior = getWarriorName()
  const knowledge = await getRecentKnowledge(warrior)
  const soulHighlights = getSoulHighlights(warrior)
  const briefing = formatBriefing(warrior, knowledge, soulHighlights)

  // Output to stdout — hookify rule captures this
  console.log(briefing)
}

brief()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[briefing] Fatal:', err); process.exit(1) })
