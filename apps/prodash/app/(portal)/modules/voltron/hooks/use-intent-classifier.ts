'use client'

import { useCallback } from 'react'

// ── Intent Result Type ──────────────────────────────────────────────────────
export interface IntentResult {
  mode: 'deploy' | 'chat'
  confidence: number // 0.0 – 1.0
  reasoning: string
  model_used: 'keyword' | 'haiku'
}

// ── Keyword Lists ───────────────────────────────────────────────────────────
const DEPLOY_KEYWORDS: string[] = [
  'deploy',
  'build',
  'create',
  'run',
  'execute',
  'prep',
  'prepare',
  'generate',
  'set up',
  'onboard',
  'process',
  'compile',
  'analyze all',
  'send to',
  'schedule',
  'automate',
  'do the',
  'handle',
  'take care of',
]

const CHAT_KEYWORDS: string[] = [
  'what',
  'who',
  'when',
  'where',
  'how',
  'tell me',
  'show me',
  'list',
  'find',
  'lookup',
  'check',
  'is there',
  'do we have',
  'what is',
  'are there',
]

// ── Classifier Logic ────────────────────────────────────────────────────────

function scoreKeywords(input: string, keywords: string[]): number {
  let score = 0
  for (const kw of keywords) {
    if (input.includes(kw)) {
      score += 1
    }
  }
  return score
}

/**
 * Client-side intent classifier.
 * Uses keyword scoring to determine if user input is a deploy-intent
 * (Mode 1 task flow) or chat-intent (Mode 2 chat bubble).
 *
 * Matches the backend classifyIntent logic from TRK-13850.
 * Keyword path fires without any API call.
 * Default fallback: chat (safety default).
 */
export function classifyIntent(message: string): IntentResult {
  const trimmed = message.trim()

  // Empty or very short gibberish → chat (safety default)
  if (!trimmed || trimmed.length < 2) {
    return {
      mode: 'chat',
      confidence: 1.0,
      reasoning: 'Empty or minimal input — defaulting to chat',
      model_used: 'keyword',
    }
  }

  const lower = trimmed.toLowerCase()
  const deployScore = scoreKeywords(lower, DEPLOY_KEYWORDS)
  const chatScore = scoreKeywords(lower, CHAT_KEYWORDS)

  // Clear deploy signal
  if (deployScore >= 1 && deployScore > chatScore) {
    return {
      mode: 'deploy',
      confidence: Math.min(0.6 + deployScore * 0.15, 1.0),
      reasoning: `Deploy keywords matched (${deployScore} deploy vs ${chatScore} chat)`,
      model_used: 'keyword',
    }
  }

  // Clear chat signal
  if (chatScore >= 1 && chatScore > deployScore) {
    return {
      mode: 'chat',
      confidence: Math.min(0.6 + chatScore * 0.15, 1.0),
      reasoning: `Chat keywords matched (${chatScore} chat vs ${deployScore} deploy)`,
      model_used: 'keyword',
    }
  }

  // Tied or no signal → default to chat (safety)
  return {
    mode: 'chat',
    confidence: 0.4,
    reasoning:
      deployScore === 0 && chatScore === 0
        ? 'No keyword signals detected — defaulting to chat'
        : `Tied keyword scores (${deployScore} deploy vs ${chatScore} chat) — defaulting to chat`,
    model_used: 'keyword',
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * React hook exposing classifyIntent for use in VOLTRON components.
 * Returns a stable callback reference.
 */
export function useIntentClassifier() {
  const classify = useCallback((message: string): IntentResult => {
    return classifyIntent(message)
  }, [])

  return { classifyIntent: classify }
}
