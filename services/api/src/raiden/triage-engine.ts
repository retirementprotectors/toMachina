import { getFirestore } from 'firebase-admin/firestore'
import type { SlackItem, ForgeItem, TriageResult, TriageOutcome, DuplicateMatch } from './types.js'

function getDb() { return getFirestore() }
const MDJ_URL = process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'

const P0_SIGNALS = [/auth.*fail/i, /can'?t.*log\s*in/i, /phone.*down/i,
  /888.*620.*8587/i, /data.*loss/i, /data.*corrupt/i, /production.*down/i]

const TRAIN_SIGNALS = [/how do i/i, /where is/i, /does prodash have/i,
  /show me how/i, /how to/i, /can i find/i]

function extractKeywords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/).filter(w => w.length > 3).slice(0, 10)
}

const DUPLICATE_THRESHOLD = 0.4

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/).filter(w => w.length > 2)
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) { if (b.has(token)) intersection++ }
  return intersection / (a.size + b.size - intersection)
}

export async function detectDuplicate(text: string): Promise<DuplicateMatch | null> {
  try {
    const snap = await getDb().collection('forge_tracker')
      .where('status', 'in', ['open', 'in_progress', 'fixing', 'triaging', 'verifying'])
      .orderBy('created_at', 'desc')
      .limit(50)
      .get()

    if (snap.empty) return null

    const incomingTokens = tokenize(text)
    let bestMatch: DuplicateMatch | null = null
    let bestScore = 0

    for (const doc of snap.docs) {
      const data = doc.data()
      const existingTitle = data.title ?? ''
      const existingDesc = data.description ?? ''
      const existingTokens = tokenize(`${existingTitle} ${existingDesc}`)
      const score = jaccardSimilarity(incomingTokens, existingTokens)

      if (score > bestScore && score >= DUPLICATE_THRESHOLD) {
        bestScore = score
        bestMatch = { trk_id: data.item_id ?? doc.id, title: existingTitle,
          status: data.status ?? 'open', score }
      }
    }
    return bestMatch
  } catch (err) {
    console.error('[RAIDEN] Duplicate detection error:', err)
    return null
  }
}

function parseOutcome(raw: string): TriageOutcome {
  const upper = raw.trim().toUpperCase()
  if (upper.includes('FIX')) return 'FIX'
  if (upper.includes('ROUTE')) return 'ROUTE'
  if (upper.includes('QUEUE')) return 'QUEUE'
  return 'ROUTE'
}

async function classifyViaMDJ(text: string): Promise<string> {
  try {
    const res = await fetch(`${MDJ_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
      body: JSON.stringify({ text, model: 'haiku' })
    })
    if (!res.ok) return 'ROUTE'
    const json = await res.json() as { data?: { classification?: string } }
    return json.data?.classification || 'ROUTE'
  } catch { return 'ROUTE' }
}

export async function triageItem(item: SlackItem | ForgeItem): Promise<TriageResult> {
  const text = 'text' in item ? item.text : `${item.title} ${item.description}`
  const p0 = P0_SIGNALS.some(rx => rx.test(text))

  const keywords = extractKeywords(text)
  let kbEmpty = true
  if (keywords.length > 0) {
    try {
      const snap = await getDb().collection('knowledge_entries')
        .where('tags', 'array-contains-any', keywords.slice(0, 10)).limit(3).get()
      kbEmpty = snap.empty
      if (!snap.empty && TRAIN_SIGNALS.some(rx => rx.test(text)))
        return { outcome: 'TRAIN', reasoning: `Found ${snap.size} matching knowledge entries`, p0 }
    } catch { /* knowledge_entries may not exist */ }
  }

  if (kbEmpty && TRAIN_SIGNALS.some(rx => rx.test(text)))
    return { outcome: 'TRAIN', reasoning: 'Matched training signal, CLAUDE.md fallback', p0 }

  const classification = await classifyViaMDJ(text)
  return { outcome: parseOutcome(classification), reasoning: classification.trim(), p0 }
}
