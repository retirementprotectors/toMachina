/**
 * Hub Dispatcher — RON-HD01
 * CXO-aware intake router. Keyword scoring with Haiku fallback.
 * One triage point, five destinations. Zero JDM intervention.
 */

import type { CxoTarget, DispatchChannel, DispatchResult } from '@tomachina/core'
import { CXO_CONFIG } from '@tomachina/core'

// ── Keyword sets (high-signal terms get 2x weight via BOOST_KEYWORDS) ────────

const CXO_KEYWORDS: Record<Exclude<CxoTarget, 'archive'>, string[]> = {
  megazord: [
    'import', 'commission', 'carrier', 'csv', 'feed', 'data', 'migration',
    'bob', 'book of business', 'sync', 'atlas', 'pipeline', 'ingest',
    'dtcc', 'gradient', 'signal', 'revenue', 'wire',
  ],
  voltron: [
    'client', 'case', 'enrollment', 'review', 'account', 'rmd', 'medicare',
    'annuity', 'investment', 'life', 'estate', 'ltc', 'beneficiary',
    'policy', 'claim', 'household',
  ],
  musashi: [
    'brochure', 'campaign', 'website', 'design', 'brand', 'canva',
    'wordpress', 'video', 'social', 'marketing', 'creative', 'logo',
    'content', 'email blast', 'newsletter', 'flyer',
  ],
  raiden: [
    'broken', 'error', 'cannot', 'can not', 'won not', 'crash', 'bug',
    'fix', 'not working', '500', 'timeout', 'down', 'fail', 'issue',
    'regression', 'stuck',
  ],
  ronin: [
    'add', 'new feature', 'enhance', 'build', 'create', 'implement',
    'would be nice', 'idea', 'request', 'improvement', 'upgrade',
  ],
}

/** High-signal terms: exact match gets 2x score bonus */
const BOOST_KEYWORDS = new Set([
  'import', 'commission', 'csv', 'migration', 'atlas',
  'broken', 'error', '500', 'crash', 'bug',
  'brochure', 'campaign', 'canva', 'wordpress',
  'client', 'enrollment', 'rmd', 'medicare',
  'new feature', 'implement', 'build',
])

/** Spam / junk patterns — auto-archive */
const SPAM_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bclick here to win\b/i,
  /\bfree ipad\b/i,
  /\bcongratulations\b.*\bwon\b/i,
  /\bnigerian prince\b/i,
  /\bviagra\b/i,
  /\bcrypto.*invest/i,
  /\bact now\b.*\blimited time\b/i,
]

// ── Scoring ──────────────────────────────────────────────────────────────────

interface ScoredTarget {
  target: CxoTarget
  score: number
}

function scoreText(text: string): ScoredTarget[] {
  const lower = ` ${text.toLowerCase()} `
  const scores: ScoredTarget[] = []

  for (const [target, keywords] of Object.entries(CXO_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(?:^|\\s|[^a-z])${escaped}(?:\\s|[^a-z]|$)`, 'i')
      if (pattern.test(lower)) {
        score += BOOST_KEYWORDS.has(kw) ? 2 : 1
      }
    }
    if (score > 0) {
      scores.push({ target: target as CxoTarget, score })
    }
  }

  return scores.sort((a, b) => b.score - a.score)
}

function isSpam(text: string): boolean {
  if (text.trim().length < 3) return true
  return SPAM_PATTERNS.some(rx => rx.test(text))
}

// ── Haiku fallback ───────────────────────────────────────────────────────────

async function classifyWithHaiku(text: string): Promise<{ target: CxoTarget; confidence: number }> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `Classify this incoming work item to the correct CXO warrior. Respond with ONLY a JSON object: {"target":"megazord"|"voltron"|"musashi"|"raiden"|"ronin","confidence":0.0-1.0}

CXO Warriors:
- megazord: Data imports, commissions, carrier feeds, CSV, migration, ATLAS, sync
- voltron: Client cases, enrollment, account review, RMD, medicare, annuity, investment
- musashi: Brochures, campaigns, website, design, brand, creative, marketing, video
- raiden: Bugs, errors, broken things, crashes, 500 errors, timeouts, fixes
- ronin: New features, enhancements, build requests, ideas, improvements

Item: "${text.slice(0, 500)}"`,
      }],
    })

    const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(content) as { target: string; confidence: number }
    const validTargets: CxoTarget[] = ['megazord', 'voltron', 'musashi', 'raiden', 'ronin']

    if (validTargets.includes(parsed.target as CxoTarget)) {
      return {
        target: parsed.target as CxoTarget,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
      }
    }
  } catch {
    // Fall through to default
  }

  return { target: 'raiden', confidence: 0.3 }
}

// ── Main export ──────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.6

export async function dispatchItem(
  text: string,
  channel: DispatchChannel = 'slack',
): Promise<DispatchResult> {
  // Spam/junk → archive
  if (isSpam(text)) {
    return {
      cxo_target: 'archive',
      confidence: 1.0,
      ticket_prefix: 'ARCHIVE-',
      routing_destination: 'archive',
      method: 'keyword',
    }
  }

  // Direct channels bypass scoring
  if (channel === 'direct') {
    // Caller already knows the target — should provide it via route param, not here
    // This is a pass-through for #megazord-intake, #voltron-cases, etc.
  }

  // Keyword scoring
  const scored = scoreText(text)
  if (scored.length > 0) {
    const best = scored[0]
    const totalWords = text.split(/\s+/).filter(w => w.length > 2).length || 1
    const confidence = Math.min(1.0, 0.5 + (best.score / totalWords) * 0.5)

    // Clear winner with enough confidence
    if (confidence >= CONFIDENCE_THRESHOLD) {
      const config = CXO_CONFIG[best.target as Exclude<CxoTarget, 'archive'>]
      return {
        cxo_target: best.target,
        confidence,
        ticket_prefix: config.prefix,
        routing_destination: config.channel_id,
        method: 'keyword',
      }
    }

    // Close race between two targets → Haiku resolves ambiguity
    if (scored.length > 1 && scored[0].score - scored[1].score <= 1) {
      const haiku = await classifyWithHaiku(text)
      const config = CXO_CONFIG[haiku.target as Exclude<CxoTarget, 'archive'>]
      return {
        cxo_target: haiku.target,
        confidence: haiku.confidence,
        ticket_prefix: config.prefix,
        routing_destination: config.channel_id,
        method: 'haiku',
      }
    }

    // Keyword winner but below threshold — still use it (just lower confidence)
    const config = CXO_CONFIG[best.target as Exclude<CxoTarget, 'archive'>]
    return {
      cxo_target: best.target,
      confidence,
      ticket_prefix: config.prefix,
      routing_destination: config.channel_id,
      method: 'keyword',
    }
  }

  // No keyword hits at all → Haiku
  const haiku = await classifyWithHaiku(text)
  const config = CXO_CONFIG[haiku.target as Exclude<CxoTarget, 'archive'>]
  return {
    cxo_target: haiku.target,
    confidence: haiku.confidence,
    ticket_prefix: config.prefix,
    routing_destination: config.channel_id,
    method: 'haiku',
  }
}
