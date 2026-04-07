/**
 * wire-warrior-briefing.ts — ZRD-SYN-015
 * WIRE_WARRIOR_BRIEFING — Session start composition
 *
 * Composes warrior-readiness + cross-warrior knowledge-query.
 * Outputs briefing to stdout for hookify injection.
 * Always exits 0 (non-blocking).
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const HOME = process.env.HOME || '/home/jdm'
const WARRIORS_DIR = path.join(HOME, 'Projects', 'dojo-warriors', 'warriors')
const KNOWLEDGE_COLLECTION = 'knowledge_entries'

// Firebase Init
try {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/jdm/mdj-agent/sa-key.json'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sa = require(saPath)
  initializeApp({ credential: cert(sa) })
} catch {
  // Firebase unavailable — fall back to soul.md only
}

function detectWarrior(): string {
  // 1. Env var
  if (process.env.WARRIOR_NAME) return process.env.WARRIOR_NAME.toLowerCase()

  // 2. CLI arg
  if (process.argv[2]) return process.argv[2].toLowerCase()

  // 3. tmux session name
  try {
    const tmuxName = execSync('tmux display-message -p "#S"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().toLowerCase()
    const map: Record<string, string> = {
      ronin: 'ronin', raiden: 'raiden', megazord: 'megazord',
      musashi: 'musashi', voltron: 'voltron', shinob1: 'shinob1',
    }
    for (const [key, val] of Object.entries(map)) {
      if (tmuxName.includes(key)) return val
    }
  } catch { /* not in tmux */ }

  return ''
}

function readSoulHighlights(warrior: string): string[] {
  const soulPath = path.join(WARRIORS_DIR, warrior, 'soul.md')
  try {
    const content = fs.readFileSync(soulPath, 'utf-8')
    const highlights: string[] = []
    let inRelevantSection = false

    for (const line of content.split('\n')) {
      if (line.match(/^#{1,3}\s.*(Key Decisions|Role in the Dojo|Architecture|Operational Rules|Communication Style)/i)) {
        inRelevantSection = true
        continue
      }
      if (line.match(/^#{1,3}\s/) && inRelevantSection) {
        inRelevantSection = false
      }
      if (inRelevantSection && line.startsWith('**') && line.includes('**')) {
        highlights.push(line.trim())
      }
      if (inRelevantSection && line.startsWith('- ') && line.length > 10) {
        highlights.push(line.trim())
      }
    }

    return highlights.slice(0, 5)
  } catch { return [] }
}

async function queryRecentKnowledge(currentWarrior: string): Promise<Array<{ warrior: string; type: string; content: string; confidence: number }>> {
  try {
    const db = getFirestore()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const snap = await db.collection(KNOWLEDGE_COLLECTION)
      .where('confidence', '>=', 0.7)
      .orderBy('confidence', 'desc')
      .limit(50)
      .get()

    return snap.docs
      .map(doc => {
        const d = doc.data()
        return {
          warrior: String(d.warrior || ''),
          type: String(d.type || 'insight'),
          content: String(d.content || '').slice(0, 200),
          confidence: Number(d.confidence || 0),
          created_at: d.created_at instanceof Timestamp ? d.created_at.toDate() : new Date(),
        }
      })
      .filter(e => e.warrior.toLowerCase() !== currentWarrior && e.created_at >= sevenDaysAgo)
      .slice(0, 15)
  } catch {
    return []
  }
}

async function run(): Promise<void> {
  const warrior = detectWarrior()
  if (!warrior) {
    console.log('No warrior detected. Skipping briefing.')
    process.exit(0)
  }

  const briefingParts: string[] = [
    `--- Cross-Warrior Briefing for ${warrior.toUpperCase()} ---`,
    '',
  ]

  // Warrior readiness: check all warriors' soul.md for highlights
  const allWarriors = ['shinob1', 'megazord', 'musashi', 'raiden', 'ronin', 'voltron'].filter(w => w !== warrior)

  for (const otherWarrior of allWarriors) {
    const highlights = readSoulHighlights(otherWarrior)
    if (highlights.length === 0) continue

    briefingParts.push(`## ${otherWarrior.toUpperCase()} highlights:`)
    for (const h of highlights) briefingParts.push(`  ${h}`)
    briefingParts.push('')
  }

  // Cross-warrior knowledge from Firestore
  const knowledge = await queryRecentKnowledge(warrior)
  if (knowledge.length > 0) {
    briefingParts.push('## Recent knowledge from other warriors:')
    for (const k of knowledge) {
      briefingParts.push(`  [${k.warrior}/${k.type}] (${(k.confidence * 100).toFixed(0)}%) ${k.content}`)
    }
    briefingParts.push('')
  }

  if (briefingParts.length <= 2) {
    briefingParts.push('No cross-warrior intelligence available.')
  }

  briefingParts.push('--- End Briefing ---')

  // Output to stdout for hookify injection
  console.log(briefingParts.join('\n'))
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(0)) // Always exit 0 — non-blocking
