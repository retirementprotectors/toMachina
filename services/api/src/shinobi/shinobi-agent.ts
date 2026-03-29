// src/shinobi/shinobi-agent.ts — CCSDK Agent Core for Shinobi
// TRK-13782: shinobiQuery(prompt, context) using Claude Agent SDK.
// Model: Opus with 3-attempt retry + exponential backoff.
// Follows claudeInvoke() pattern from src/forge/claude-invoke.ts.

import { query } from '@anthropic-ai/claude-agent-sdk'
import { SHINOBI_OS_RULES } from './shinobi-rules.js'
import { transitionState } from './shinobi-state.js'

const MODEL = 'claude-opus-4-6'
const MAX_RETRIES = 3
const CWD = '/home/jdm/mdj-server'

export interface ShinobiQueryResult {
  response: string
  actions_taken: string[]
}

export async function shinobiQuery(
  prompt: string,
  context?: Record<string, unknown>,
): Promise<ShinobiQueryResult> {
  await transitionState('processing', 'shinobi-query')

  const fullPrompt = context
    ? `Context: ${JSON.stringify(context)}\n\n${prompt}`
    : prompt

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const outputChunks: string[] = []
      const conversation = query({
        prompt: `${SHINOBI_OS_RULES}\n\n${fullPrompt}`,
        options: {
          model: MODEL,
          cwd: CWD,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          pathToClaudeCodeExecutable:
            process.env.CLAUDE_CODE_PATH || '/home/jdm/.local/bin/claude',
          // No maxTurns, no maxBudgetUsd — per CCSDK_AGENT_PREFLIGHT.md
        },
      })

      for await (const message of conversation) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text' && block.text) {
              outputChunks.push(block.text)
            }
          }
        }
      }

      await transitionState('idle')
      return { response: outputChunks.join(''), actions_taken: ['query_completed'] }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
  }

  await transitionState('idle')
  throw lastError ?? new Error('shinobiQuery failed after retries')
}
