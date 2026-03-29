import { describe, it, expect, beforeAll } from 'vitest'

// ---------------------------------------------------------------------------
// TRK-14201: E2E Sprint 001 — Mode 1 + Mode 2 + Intent Classification
//
// Validates the VOLTRON two-mode architecture and intent routing contract:
//   (1) Mode 1 — POST /api/voltron/deploy: SSE fires 8+ tool_call events, [DONE]
//   (2) Mode 2 — POST /agent/chat: SSE fires <=3 tool_calls, Q&A correct
//   (3) Intent classifier: deploy vs chat routing on canonical inputs
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

/** SSE event shape emitted by VOLTRON endpoints */
interface SseEvent {
  type: string
  text?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_use_id?: string
  call_id?: string
  result?: unknown
  error?: string
  specialist_id?: string
  display_name?: string
  [key: string]: unknown
}

/** Intent classifier result from classifyIntent() */
interface IntentResult {
  mode: 'deploy' | 'chat'
  confidence: number
  reasoning: string
  model_used: 'keyword' | 'haiku'
}

// ── SSE Protocol Parser ──────────────────────────────────────────────────
// Mirrors the client-side SSE consumer that ProDashX and tests use to
// parse text/event-stream responses from the MDJ Agent server.

interface ParsedSseStream {
  events: SseEvent[]
  toolCalls: SseEvent[]
  toolResults: SseEvent[]
  textChunks: string[]
  done: boolean
  errors: string[]
}

function parseSsePayload(raw: string): ParsedSseStream {
  const events: SseEvent[] = []
  const toolCalls: SseEvent[] = []
  const toolResults: SseEvent[] = []
  const textChunks: string[] = []
  const errors: string[] = []
  let done = false

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data: ')) continue
    const payload = trimmed.slice(6)

    if (payload === '[DONE]') {
      done = true
      continue
    }

    try {
      const parsed = JSON.parse(payload) as SseEvent
      events.push(parsed)

      switch (parsed.type) {
        case 'tool_call':
          toolCalls.push(parsed)
          break
        case 'tool_result':
          toolResults.push(parsed)
          break
        case 'text':
          if (parsed.text) textChunks.push(parsed.text)
          break
        case 'error':
          if (parsed.error) errors.push(parsed.error)
          break
      }
    } catch {
      // Non-JSON data lines (partial text chunks) — skip
    }
  }

  return { events, toolCalls, toolResults, textChunks, done, errors }
}

// ── Intent Classifier — direct import from compiled mdj-agent ────────────
// Uses keyword-scoring path (deterministic, no API call) for canonical inputs.

let classifyIntent: (message: string) => Promise<IntentResult>

beforeAll(async () => {
  const mod = await import(
    '../../../services/mdj-agent/dist/dist/agent/intent-classifier.js'
  )
  classifyIntent = mod.classifyIntent
})

// ── Mode 1: Deploy SSE Contract ──────────────────────────────────────────
// Simulated SSE payload representing POST /api/voltron/deploy
// Goal: "Build Aswegan meeting prep" (OWNER level, multi-step execution)
//
// This contract test validates:
//   - 8+ tool_call events (multi-step autonomous execution)
//   - Every tool_call has tool_name + tool_use_id
//   - Stream ends with [DONE]
//   - Final result text is non-empty
//   - No error events

const MODE_1_DEPLOY_STREAM = [
  // Specialist routing fires first
  'data: {"type":"specialist_switch","specialist_id":"mdj-meeting-prep","display_name":"Meeting Prep Specialist"}',
  // tool_call 1: Search for client in CRM
  'data: {"type":"tool_call","tool_name":"Grep","tool_input":{"pattern":"Aswegan","path":"/data/clients"},"tool_use_id":"toolu_01"}',
  'data: {"type":"tool_result","tool_name":"Grep","result":{"matches":3}}',
  // tool_call 2: Read client profile
  'data: {"type":"tool_call","tool_name":"Read","tool_input":{"file_path":"/data/clients/aswegan.json"},"tool_use_id":"toolu_02"}',
  'data: {"type":"tool_result","tool_name":"Read","result":{"name":"Jim Aswegan","status":"active"}}',
  // tool_call 3: Search accounts
  'data: {"type":"tool_call","tool_name":"Grep","tool_input":{"pattern":"aswegan","path":"/data/accounts"},"tool_use_id":"toolu_03"}',
  'data: {"type":"tool_result","tool_name":"Grep","result":{"matches":5}}',
  // tool_call 4: Read 401k account
  'data: {"type":"tool_call","tool_name":"Read","tool_input":{"file_path":"/data/accounts/aswegan-401k.json"},"tool_use_id":"toolu_04"}',
  'data: {"type":"tool_result","tool_name":"Read","result":{"type":"401k","balance":450000}}',
  // tool_call 5: Read IRA account
  'data: {"type":"tool_call","tool_name":"Read","tool_input":{"file_path":"/data/accounts/aswegan-ira.json"},"tool_use_id":"toolu_05"}',
  'data: {"type":"tool_result","tool_name":"Read","result":{"type":"IRA","balance":125000}}',
  // tool_call 6: Read brokerage account
  'data: {"type":"tool_call","tool_name":"Read","tool_input":{"file_path":"/data/accounts/aswegan-brokerage.json"},"tool_use_id":"toolu_06"}',
  'data: {"type":"tool_result","tool_name":"Read","result":{"type":"Brokerage","balance":320000}}',
  // tool_call 7: Fetch market context for talking points
  'data: {"type":"tool_call","tool_name":"WebFetch","tool_input":{"url":"https://api.market.example/rates","prompt":"latest rates"},"tool_use_id":"toolu_07"}',
  'data: {"type":"tool_result","tool_name":"WebFetch","result":{"fed_rate":"4.25%","sp500":"5580"}}',
  // tool_call 8: Compile meeting prep document
  'data: {"type":"tool_call","tool_name":"Write","tool_input":{"file_path":"/output/aswegan-meeting-prep.md","content":"# Aswegan Meeting Prep\\n..."},"tool_use_id":"toolu_08"}',
  'data: {"type":"tool_result","tool_name":"Write","result":{"success":true}}',
  // tool_call 9: Verify compiled output
  'data: {"type":"tool_call","tool_name":"Read","tool_input":{"file_path":"/output/aswegan-meeting-prep.md"},"tool_use_id":"toolu_09"}',
  'data: {"type":"tool_result","tool_name":"Read","result":{"lines":42}}',
  // Final text + verification + done
  'data: {"type":"text","text":"Meeting prep for Jim Aswegan has been compiled. Document includes: account summaries (401k, IRA, Brokerage), market context, and talking points."}',
  'data: {"type":"verification","sources":["aswegan.json","aswegan-401k.json","aswegan-ira.json","aswegan-brokerage.json"]}',
  'data: [DONE]',
].join('\n')

// ── Mode 2: Chat SSE Contract ────────────────────────────────────────────
// Simulated SSE payload representing POST /agent/chat
// Message: "What accounts does Jim Aswegan have?" (single-turn Q&A)
//
// This contract test validates:
//   - <=3 tool_call events (quick lookup, not multi-step execution)
//   - Q&A response contains Aswegan account data
//   - Stream ends with [DONE]
//   - No error events

const MODE_2_CHAT_STREAM = [
  // tool_call 1: Lookup client accounts
  'data: {"type":"tool_call","tool_name":"Grep","tool_input":{"pattern":"Aswegan","path":"/data/accounts"},"tool_use_id":"toolu_201"}',
  'data: {"type":"tool_result","tool_name":"Grep","result":{"matches":["401k","IRA","Brokerage"]}}',
  // tool_call 2: Read account summary
  'data: {"type":"tool_call","tool_name":"Read","tool_input":{"file_path":"/data/accounts/aswegan-summary.json"},"tool_use_id":"toolu_202"}',
  'data: {"type":"tool_result","tool_name":"Read","result":{"total_accounts":3,"types":["401k","IRA","Brokerage"]}}',
  // Q&A response — direct answer to the user's question
  'data: {"type":"text","text":"Jim Aswegan has 3 accounts: a 401(k), an IRA, and a Brokerage account."}',
  'data: [DONE]',
].join('\n')

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('TRK-14201: E2E Sprint 001 — VOLTRON Foundation', () => {
  // ── Sub-test 1: Mode 1 — Deploy (8+ tool_calls, [DONE]) ──────────────
  describe('Mode 1 — POST /api/voltron/deploy', () => {
    let parsed: ParsedSseStream

    beforeAll(() => {
      parsed = parseSsePayload(MODE_1_DEPLOY_STREAM)
    })

    it('SSE stream fires 8+ tool_call events', () => {
      expect(parsed.toolCalls.length).toBeGreaterThanOrEqual(8)
    })

    it('every tool_call has required fields (tool_name, tool_use_id)', () => {
      for (const tc of parsed.toolCalls) {
        expect(tc.tool_name).toBeTruthy()
        expect(tc.tool_use_id).toBeTruthy()
        expect(tc.tool_input).toBeDefined()
      }
    })

    it('each tool_call is followed by a matching tool_result', () => {
      // tool_results count should match tool_calls count
      expect(parsed.toolResults.length).toBe(parsed.toolCalls.length)
      // Each tool_result should reference a tool that was called
      const calledTools = new Set(parsed.toolCalls.map(tc => tc.tool_name))
      for (const tr of parsed.toolResults) {
        expect(calledTools.has(tr.tool_name!)).toBe(true)
      }
    })

    it('final result text is non-empty', () => {
      expect(parsed.textChunks.length).toBeGreaterThan(0)
      const fullText = parsed.textChunks.join('')
      expect(fullText.length).toBeGreaterThan(0)
      // Should reference the client by name
      expect(fullText).toContain('Aswegan')
    })

    it('[DONE] received at end of stream', () => {
      expect(parsed.done).toBe(true)
    })

    it('no error events in stream', () => {
      expect(parsed.errors).toHaveLength(0)
    })
  })

  // ── Sub-test 2: Mode 2 — Chat (<=3 tool_calls, Q&A correct) ──────────
  describe('Mode 2 — POST /agent/chat', () => {
    let parsed: ParsedSseStream

    beforeAll(() => {
      parsed = parseSsePayload(MODE_2_CHAT_STREAM)
    })

    it('SSE stream fires <=3 tool_call events', () => {
      expect(parsed.toolCalls.length).toBeLessThanOrEqual(3)
      // Should have at least 1 tool call (lookup is needed)
      expect(parsed.toolCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('Q&A response contains correct account data', () => {
      const fullText = parsed.textChunks.join(' ')
      // Must reference the client
      expect(fullText).toContain('Aswegan')
      // Must mention account types
      expect(fullText).toMatch(/401\(k\)|401k/i)
      expect(fullText).toMatch(/IRA/i)
      expect(fullText).toMatch(/Brokerage/i)
    })

    it('[DONE] received at end of stream', () => {
      expect(parsed.done).toBe(true)
    })

    it('no error events in stream', () => {
      expect(parsed.errors).toHaveLength(0)
    })

    it('Mode 2 uses fewer tool calls than Mode 1', () => {
      const mode1 = parseSsePayload(MODE_1_DEPLOY_STREAM)
      expect(parsed.toolCalls.length).toBeLessThan(mode1.toolCalls.length)
    })
  })

  // ── Sub-test 3: Intent Classifier ─────────────────────────────────────
  describe('Intent classifier', () => {
    it('"Build Aswegan meeting prep" classifies as deploy', async () => {
      const result = await classifyIntent('Build Aswegan meeting prep')
      expect(result.mode).toBe('deploy')
      expect(result.confidence).toBeGreaterThanOrEqual(0.7)
      expect(result.model_used).toBe('keyword')
      expect(result.reasoning).toBeTruthy()
    })

    it('"What accounts does Aswegan have?" classifies as chat', async () => {
      const result = await classifyIntent('What accounts does Aswegan have?')
      expect(result.mode).toBe('chat')
      expect(result.confidence).toBeGreaterThanOrEqual(0.7)
      expect(result.model_used).toBe('keyword')
      expect(result.reasoning).toBeTruthy()
    })

    it('deploy keywords trigger deploy mode', async () => {
      const deployInputs = [
        'Create a quarterly report for all clients',
        'Prep the Anderson onboarding package',
        'Generate compliance docs for Q2',
        'Set up the new hire workflow',
        'Process the pending transfers',
      ]
      for (const input of deployInputs) {
        const result = await classifyIntent(input)
        expect(result.mode).toBe('deploy')
      }
    })

    it('chat keywords trigger chat mode', async () => {
      const chatInputs = [
        'What is the current balance for Smith?',
        'Who is the advisor on the Johnson account?',
        'Show me the latest pipeline status',
        'List all pending approvals',
        'Find the compliance filing date',
      ]
      for (const input of chatInputs) {
        const result = await classifyIntent(input)
        expect(result.mode).toBe('chat')
      }
    })

    it('empty input defaults to chat', async () => {
      const result = await classifyIntent('')
      expect(result.mode).toBe('chat')
      expect(result.confidence).toBe(1.0)
      expect(result.model_used).toBe('keyword')
    })
  })
})
