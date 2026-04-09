/**
 * entity-extractor.ts — TRK-S03-009 + TRK-S03-017
 * Daily job (2am) that extracts knowledge entries from warrior files
 * and session transcripts using Claude Sonnet.
 *
 * Processes 3 file types with tiered confidence:
 * - soul.md (0.9+ confidence, tag: soul-curated)
 * - spirit.md (0.85+ confidence, tag: spirit-curated)
 * - brain.txt (standard scoring, tag: warrior-context)
 *
 * Processing order: soul first, then spirit, then brain.
 * Soul-curated entries take precedence on dedup.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'
import { KNOWLEDGE_ENTRIES_COLLECTION } from './types/knowledge-entry.js'
import type { KnowledgeEntryType } from './types/knowledge-entry.js'

// Firebase Init
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json'
const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

// Config
const DOJO_WARRIORS_DIR = '/home/jdm/Projects/dojo-warriors/warriors'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

interface ExtractedEntry {
  type: KnowledgeEntryType
  content: string
  confidence: number
  tags: string[]
}

// Extraction prompt for Claude
function buildExtractionPrompt(content: string, fileType: 'soul' | 'spirit' | 'brain'): string {
  const confidenceGuide = {
    soul: 'These are hand-curated identity statements. Assign confidence 0.9-1.0.',
    spirit: 'These are curated relationship moments. Assign confidence 0.85-0.95.',
    brain: 'This is raw session context. Assign confidence 0.5-0.8 based on specificity.',
  }

  return `Extract knowledge entries from this warrior file. Each entry should be a reusable fact, decision, pattern, or insight.

File type: ${fileType}.md
${confidenceGuide[fileType]}

Output ONLY a JSON array — no prose, no markdown fences:
[
  {"type": "decision|pattern|insight|architecture", "content": "single reusable sentence", "confidence": 0.9, "tags": ["${fileType}-curated"]}
]

Content to extract from:
${content.slice(0, 10000)}`
}

// Call Claude Sonnet for extraction
async function extractWithClaude(content: string, fileType: 'soul' | 'spirit' | 'brain'): Promise<ExtractedEntry[]> {
  if (!ANTHROPIC_API_KEY) {
    console.log(`[extractor] No API key — skipping ${fileType} extraction`)
    return []
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildExtractionPrompt(content, fileType) }],
    }),
  })

  const json = await res.json() as { content?: Array<{ text?: string }> }
  const text = json.content?.[0]?.text || '[]'

  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    console.error(`[extractor] Parse error for ${fileType}`)
    return []
  }
}

// Process a single warrior's files
async function processWarrior(warriorName: string): Promise<number> {
  const warriorDir = path.join(DOJO_WARRIORS_DIR, warriorName)
  if (!fs.existsSync(warriorDir)) {
    console.log(`[extractor] No directory for ${warriorName}`)
    return 0
  }

  let totalEntries = 0
  const fileTypes: Array<{ file: string; type: 'soul' | 'spirit' | 'brain' }> = [
    { file: 'soul.md', type: 'soul' },
    { file: 'spirit.md', type: 'spirit' },
    { file: 'brain.txt', type: 'brain' },
  ]

  for (const { file, type } of fileTypes) {
    const filePath = path.join(warriorDir, file)
    if (!fs.existsSync(filePath)) {
      console.log(`[extractor] ${warriorName}/${file} not found — skipping`)
      continue
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    if (content.length < 100) {
      console.log(`[extractor] ${warriorName}/${file} too short — skipping`)
      continue
    }

    console.log(`[extractor] Processing ${warriorName}/${file} (${content.length} chars)`)
    const entries = await extractWithClaude(content, type)

    // Write to Firestore
    const batch = db.batch()
    for (const entry of entries) {
      const docRef = db.collection(KNOWLEDGE_ENTRIES_COLLECTION).doc()
      batch.set(docRef, {
        type: entry.type,
        content: entry.content,
        confidence: entry.confidence,
        tags: [...(entry.tags || []), `warrior:${warriorName}`],
        source_session_id: `${warriorName}/${file}`,
        machine: 'mdj1',
        created_at: new Date(),
        promoted_to_claude_md: false,
      })
    }
    await batch.commit()
    totalEntries += entries.length
    console.log(`[extractor] ${warriorName}/${file}: ${entries.length} entries extracted`)
  }

  return totalEntries
}

// Main
async function extract(): Promise<void> {
  console.log(`[extractor] Starting at ${new Date().toISOString()}`)

  // Discover warriors
  if (!fs.existsSync(DOJO_WARRIORS_DIR)) {
    console.error(`[extractor] Dojo warriors dir not found: ${DOJO_WARRIORS_DIR}`)
    process.exit(1)
  }

  const warriors = fs.readdirSync(DOJO_WARRIORS_DIR)
    .filter(d => fs.statSync(path.join(DOJO_WARRIORS_DIR, d)).isDirectory())

  console.log(`[extractor] Found ${warriors.length} warriors: ${warriors.join(', ')}`)

  let total = 0
  for (const warrior of warriors) {
    total += await processWarrior(warrior)
  }

  console.log(`[extractor] Complete. ${total} entries extracted across ${warriors.length} warriors.`)
}

extract()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[extractor] Fatal:', err); process.exit(1) })
