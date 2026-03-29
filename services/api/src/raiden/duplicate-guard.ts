// src/raiden/duplicate-guard.ts — Pre-submission duplicate detection for RAIDEN
// TRK-14240: Duplicate detection fires BEFORE creating a second ticket.
// If a match is found, posts ⚠️ to #dojo-fixes and blocks ticket creation.

import { getFirestore } from 'firebase-admin/firestore'
import { postDuplicateDetected } from './channel-notifier.js'

const COLLECTION = 'tracker_items'
const JACCARD_THRESHOLD = 0.8

// ---------------------------------------------------------------------------
// Normalization (mirrors tracker.ts dedup logic)
// ---------------------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function wordSet(s: string): Set<string> {
  return new Set(s.split(' ').filter(Boolean))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const w of a) {
    if (b.has(w)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuplicateMatch {
  /** Firestore doc ID of the existing item */
  id: string
  /** TRK-XXX item_id */
  item_id: string
  /** Title of the existing item */
  title: string
  /** Current status */
  status: string
  /** How the match was detected */
  reason: 'exact_match' | 'substring_match' | 'jaccard_similarity'
  /** Similarity score (1.0 for exact, computed for Jaccard) */
  score: number
}

export interface DuplicateGuardResult {
  /** true = duplicate found, do NOT create a new ticket */
  isDuplicate: boolean
  /** The matching existing item (null if no duplicate) */
  match: DuplicateMatch | null
  /** Whether the channel post succeeded */
  channelPosted: boolean
}

// ---------------------------------------------------------------------------
// Guard function — call BEFORE creating a tracker item
// ---------------------------------------------------------------------------

/**
 * Check if a title matches an existing tracker item.
 * If duplicate found: posts ⚠️ to #dojo-fixes and returns isDuplicate=true.
 * If no duplicate: returns isDuplicate=false, safe to create ticket.
 */
export async function checkForDuplicate(
  incomingTitle: string,
): Promise<DuplicateGuardResult> {
  const noMatch: DuplicateGuardResult = { isDuplicate: false, match: null, channelPosted: false }

  if (!incomingTitle || incomingTitle.trim().length === 0) {
    return noMatch
  }

  try {
    const db = getFirestore()
    const snapshot = await db.collection(COLLECTION).get()

    const incomingNorm = normalizeTitle(incomingTitle)
    const incomingWords = wordSet(incomingNorm)

    // Skip comparison if the normalized title is too short
    if (incomingNorm.length < 3) return noMatch

    let bestMatch: DuplicateMatch | null = null
    let bestScore = 0

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const existingTitle = (data.title as string) || ''
      const existingNorm = normalizeTitle(existingTitle)

      if (existingNorm.length < 3) continue

      let reason: DuplicateMatch['reason'] | null = null
      let score = 0

      // 1. Exact match after normalization
      if (incomingNorm === existingNorm) {
        reason = 'exact_match'
        score = 1.0
      }
      // 2. Substring match (one contains the other)
      else if (incomingNorm.includes(existingNorm) || existingNorm.includes(incomingNorm)) {
        reason = 'substring_match'
        score = 0.9
      }
      // 3. Jaccard similarity
      else {
        const existingWords = wordSet(existingNorm)
        const sim = jaccardSimilarity(incomingWords, existingWords)
        if (sim >= JACCARD_THRESHOLD) {
          reason = 'jaccard_similarity'
          score = sim
        }
      }

      if (reason && score > bestScore) {
        bestScore = score
        bestMatch = {
          id: doc.id,
          item_id: (data.item_id as string) || doc.id,
          title: existingTitle,
          status: (data.status as string) || 'unknown',
          reason,
          score,
        }
      }
    }

    if (bestMatch) {
      // Post ⚠️ to #dojo-fixes — duplicate detected BEFORE creating a second ticket
      const postResult = await postDuplicateDetected(
        bestMatch.item_id,
        bestMatch.title,
        bestMatch.status,
      )

      console.log(`[raiden-guard] Duplicate detected: "${incomingTitle}" matches ${bestMatch.item_id} (${bestMatch.reason}, score=${bestMatch.score.toFixed(2)})`)

      return {
        isDuplicate: true,
        match: bestMatch,
        channelPosted: postResult.success,
      }
    }

    return noMatch
  } catch (err) {
    // On error, allow ticket creation (fail open) — don't block the pipeline
    console.error('[raiden-guard] Duplicate check failed:', err)
    return noMatch
  }
}
