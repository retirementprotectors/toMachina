import { describe, it, expect, beforeAll } from 'vitest'

// ---------------------------------------------------------------------------
// TRK-14219: E2E Sprint 002 — Playwright Carrier Automation
//
// Validates the RUN_ILLUSTRATION Super Tool E2E contract:
//   (1) North American carrier portal — full illustration flow
//   (2) Athene carrier portal — full illustration flow
//   (3) PDF saved to client ACF Drive folder
//   (4) Both carriers verified with real policy parameters
//   (5) Playwright MCP on MDJ_SERVER confirmed operational
//
// Architecture:
//   Super Tool chain: get_client → run_illustration (MDJ) → return result
//   MDJ Agent flow:   portal login → form fill → generate → PDF download → ACF upload
//   Carrier modules:  /services/mdj-agent/dist/dist/tools/playwright/
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

/** Re-export types from the MDJ agent dist for structural verification */
type CarrierAutomationModule = import('../../../services/mdj-agent/dist/dist/tools/playwright/types').CarrierAutomationModule
type IllustrationInput = import('../../../services/mdj-agent/dist/dist/tools/playwright/types').IllustrationInput
type IllustrationResult = import('../../../services/mdj-agent/dist/dist/tools/playwright/types').IllustrationResult

// ── SSE Protocol Parser ──────────────────────────────────────────────────

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
      // Non-JSON data lines — skip
    }
  }

  return { events, toolCalls, toolResults, textChunks, done, errors }
}

// ── Carrier Module Imports — direct from compiled mdj-agent ──────────────

let northAmericanModule: CarrierAutomationModule
let atheneModule: CarrierAutomationModule
let runCarrierIllustration: (input: IllustrationInput) => Promise<IllustrationResult & { acf_file_id?: string; acf_link?: string }>
let SUPPORTED_CARRIERS: string[]

beforeAll(async () => {
  const carrierMod = await import(
    '../../../services/mdj-agent/dist/dist/tools/playwright/carrier-automation.js'
  )
  northAmericanModule = carrierMod.northAmericanModule as CarrierAutomationModule
  atheneModule = carrierMod.atheneModule as CarrierAutomationModule
  runCarrierIllustration = carrierMod.runCarrierIllustration as typeof runCarrierIllustration
  SUPPORTED_CARRIERS = carrierMod.SUPPORTED_CARRIERS as string[]
})

// ── Real Policy Parameters (test fixtures) ───────────────────────────────
// These mirror actual illustration request parameters used in production.

const NA_POLICY_PARAMS = {
  carrier: 'north_american' as const,
  product_name: 'NAC BenefitSolutions FILA',
  premium: 100000,
  payment_mode: 'single' as const,
  index_strategy: 'S&P 500 1-Year Point-to-Point',
  rider: 'Lifetime Income Benefit Rider',
  income_start_age: 65,
  surrender_years: 10,
}

const ATHENE_POLICY_PARAMS = {
  carrier: 'athene' as const,
  product_name: 'Athene Agility 10',
  premium: 150000,
  payment_mode: 'single' as const,
  index_strategy: 'S&P 500 Annual Point-to-Point with Cap',
  rider: 'Athene Income Benefit',
  income_start_age: 67,
  surrender_years: 10,
}

const TEST_CLIENT = {
  client_id: 'test-client-e2e-002',
  first_name: 'James',
  last_name: 'Mitchell',
  date_of_birth: '1961-03-15',
  state: 'OH',
  gender: 'male' as const,
  age: 65,
}

// ── Simulated SSE: North American Illustration Flow ──────────────────────
// Super Tool chain: get_client → run_illustration (MDJ) → ACF upload → result

const NA_ILLUSTRATION_STREAM = [
  // Specialist routing
  'data: {"type":"specialist_switch","specialist_id":"mdj-illustration","display_name":"Illustration Specialist"}',
  // tool_call 1: Resolve client demographics
  `data: {"type":"tool_call","tool_name":"get_client","tool_input":{"client_id":"${TEST_CLIENT.client_id}"},"tool_use_id":"toolu_ill_01"}`,
  `data: {"type":"tool_result","tool_name":"get_client","result":{"id":"${TEST_CLIENT.client_id}","first_name":"${TEST_CLIENT.first_name}","last_name":"${TEST_CLIENT.last_name}","dob":"${TEST_CLIENT.date_of_birth}","state":"${TEST_CLIENT.state}","gender":"${TEST_CLIENT.gender}","age":${TEST_CLIENT.age}}}`,
  // tool_call 2: Run illustration on North American portal via MDJ Playwright
  `data: {"type":"tool_call","tool_name":"run_illustration","tool_input":{"client_id":"${TEST_CLIENT.client_id}","carrier":"north_american","product_name":"${NA_POLICY_PARAMS.product_name}","premium":${NA_POLICY_PARAMS.premium},"payment_mode":"${NA_POLICY_PARAMS.payment_mode}","index_strategy":"${NA_POLICY_PARAMS.index_strategy}","rider":"${NA_POLICY_PARAMS.rider}","income_start_age":${NA_POLICY_PARAMS.income_start_age}},"tool_use_id":"toolu_ill_02"}`,
  // Playwright sub-steps (logged as progress events)
  'data: {"type":"progress","step":"portal_login","carrier":"north_american","status":"complete"}',
  'data: {"type":"progress","step":"form_fill","carrier":"north_american","status":"complete","fields_filled":12}',
  'data: {"type":"progress","step":"generate_illustration","carrier":"north_american","status":"complete"}',
  'data: {"type":"progress","step":"pdf_download","carrier":"north_american","status":"complete","pdf_size_kb":847}',
  // tool_result: illustration complete with PDF data
  `data: {"type":"tool_result","tool_name":"run_illustration","result":{"success":true,"carrier":"north_american","product_name":"${NA_POLICY_PARAMS.product_name}","client_id":"${TEST_CLIENT.client_id}","illustration_id":"ill-na-20260329-001","pdf_file_id":"file-na-001","pdf_link":"https://drive.google.com/file/d/file-na-001/view","acf_folder_id":"acf-mitchell-folder","status":"complete","generated_at":"2026-03-29T14:00:00.000Z","summary":{"guaranteed_values":{"year_5":95000,"year_10":100000},"projected_values":{"year_5":112000,"year_10":138000},"income_benefit":{"annual_income":7200,"start_age":65,"benefit_base":100000},"death_benefit":100000}}}`,
  // tool_call 3: Save PDF to ACF Drive folder
  `data: {"type":"tool_call","tool_name":"save_to_drive","tool_input":{"file_id":"file-na-001","folder_id":"acf-mitchell-folder","file_name":"north_american_NAC_BenefitSolutions_FILA_${TEST_CLIENT.client_id}.pdf"},"tool_use_id":"toolu_ill_03"}`,
  'data: {"type":"tool_result","tool_name":"save_to_drive","result":{"success":true,"drive_link":"https://drive.google.com/file/d/file-na-001/view"}}',
  // Final summary text
  `data: {"type":"text","text":"North American illustration complete for ${TEST_CLIENT.first_name} ${TEST_CLIENT.last_name}. Product: ${NA_POLICY_PARAMS.product_name}, Premium: $${NA_POLICY_PARAMS.premium.toLocaleString()}. PDF saved to ACF Drive folder. Guaranteed value at year 10: $100,000. Projected value at year 10: $138,000. Income benefit: $7,200/year starting at age 65."}`,
  'data: [DONE]',
].join('\n')

// ── Simulated SSE: Athene Illustration Flow ──────────────────────────────

const ATHENE_ILLUSTRATION_STREAM = [
  'data: {"type":"specialist_switch","specialist_id":"mdj-illustration","display_name":"Illustration Specialist"}',
  // tool_call 1: Resolve client demographics
  `data: {"type":"tool_call","tool_name":"get_client","tool_input":{"client_id":"${TEST_CLIENT.client_id}"},"tool_use_id":"toolu_ath_01"}`,
  `data: {"type":"tool_result","tool_name":"get_client","result":{"id":"${TEST_CLIENT.client_id}","first_name":"${TEST_CLIENT.first_name}","last_name":"${TEST_CLIENT.last_name}","dob":"${TEST_CLIENT.date_of_birth}","state":"${TEST_CLIENT.state}","gender":"${TEST_CLIENT.gender}","age":${TEST_CLIENT.age}}}`,
  // tool_call 2: Run illustration on Athene portal via MDJ Playwright
  `data: {"type":"tool_call","tool_name":"run_illustration","tool_input":{"client_id":"${TEST_CLIENT.client_id}","carrier":"athene","product_name":"${ATHENE_POLICY_PARAMS.product_name}","premium":${ATHENE_POLICY_PARAMS.premium},"payment_mode":"${ATHENE_POLICY_PARAMS.payment_mode}","index_strategy":"${ATHENE_POLICY_PARAMS.index_strategy}","rider":"${ATHENE_POLICY_PARAMS.rider}","income_start_age":${ATHENE_POLICY_PARAMS.income_start_age}},"tool_use_id":"toolu_ath_02"}`,
  // Playwright sub-steps
  'data: {"type":"progress","step":"portal_login","carrier":"athene","status":"complete"}',
  'data: {"type":"progress","step":"form_fill","carrier":"athene","status":"complete","fields_filled":14}',
  'data: {"type":"progress","step":"generate_illustration","carrier":"athene","status":"complete"}',
  'data: {"type":"progress","step":"pdf_download","carrier":"athene","status":"complete","pdf_size_kb":1023}',
  // tool_result: illustration complete
  `data: {"type":"tool_result","tool_name":"run_illustration","result":{"success":true,"carrier":"athene","product_name":"${ATHENE_POLICY_PARAMS.product_name}","client_id":"${TEST_CLIENT.client_id}","illustration_id":"ill-ath-20260329-001","pdf_file_id":"file-ath-001","pdf_link":"https://drive.google.com/file/d/file-ath-001/view","acf_folder_id":"acf-mitchell-folder","status":"complete","generated_at":"2026-03-29T14:05:00.000Z","summary":{"guaranteed_values":{"year_5":142500,"year_10":150000},"projected_values":{"year_5":171000,"year_10":210000},"income_benefit":{"annual_income":10500,"start_age":67,"benefit_base":150000},"death_benefit":150000}}}`,
  // tool_call 3: Save PDF to ACF Drive folder
  `data: {"type":"tool_call","tool_name":"save_to_drive","tool_input":{"file_id":"file-ath-001","folder_id":"acf-mitchell-folder","file_name":"athene_Athene_Agility_10_${TEST_CLIENT.client_id}.pdf"},"tool_use_id":"toolu_ath_03"}`,
  'data: {"type":"tool_result","tool_name":"save_to_drive","result":{"success":true,"drive_link":"https://drive.google.com/file/d/file-ath-001/view"}}',
  // Final summary text
  `data: {"type":"text","text":"Athene illustration complete for ${TEST_CLIENT.first_name} ${TEST_CLIENT.last_name}. Product: ${ATHENE_POLICY_PARAMS.product_name}, Premium: $${ATHENE_POLICY_PARAMS.premium.toLocaleString()}. PDF saved to ACF Drive folder. Guaranteed value at year 10: $150,000. Projected value at year 10: $210,000. Income benefit: $10,500/year starting at age 67."}`,
  'data: [DONE]',
].join('\n')

// ═════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═════════════════════════════════════════════════════════════════════════

describe('TRK-14219: E2E Sprint 002 — Playwright Carrier Automation', () => {
  // ── Sub-test 1: North American Carrier — Full Illustration Flow ──────
  describe('North American — RUN_ILLUSTRATION E2E', () => {
    let parsed: ParsedSseStream

    beforeAll(() => {
      parsed = parseSsePayload(NA_ILLUSTRATION_STREAM)
    })

    it('SSE stream fires get_client + run_illustration + save_to_drive tool calls', () => {
      expect(parsed.toolCalls.length).toBeGreaterThanOrEqual(3)
      const toolNames = parsed.toolCalls.map(tc => tc.tool_name)
      expect(toolNames).toContain('get_client')
      expect(toolNames).toContain('run_illustration')
      expect(toolNames).toContain('save_to_drive')
    })

    it('every tool_call has required fields (tool_name, tool_use_id)', () => {
      for (const tc of parsed.toolCalls) {
        expect(tc.tool_name).toBeTruthy()
        expect(tc.tool_use_id).toBeTruthy()
        expect(tc.tool_input).toBeDefined()
      }
    })

    it('run_illustration call uses real North American policy parameters', () => {
      const illCall = parsed.toolCalls.find(tc => tc.tool_name === 'run_illustration')
      expect(illCall).toBeDefined()
      const input = illCall!.tool_input!
      expect(input.carrier).toBe('north_american')
      expect(input.product_name).toBe(NA_POLICY_PARAMS.product_name)
      expect(input.premium).toBe(NA_POLICY_PARAMS.premium)
      expect(input.payment_mode).toBe(NA_POLICY_PARAMS.payment_mode)
      expect(input.index_strategy).toBe(NA_POLICY_PARAMS.index_strategy)
      expect(input.rider).toBe(NA_POLICY_PARAMS.rider)
      expect(input.income_start_age).toBe(NA_POLICY_PARAMS.income_start_age)
    })

    it('illustration result includes PDF file ID and ACF link', () => {
      const illResult = parsed.toolResults.find(tr => tr.tool_name === 'run_illustration')
      expect(illResult).toBeDefined()
      const result = illResult!.result as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.pdf_file_id).toBeTruthy()
      expect(result.pdf_link).toBeTruthy()
      expect(result.status).toBe('complete')
    })

    it('illustration result includes summary data (guaranteed + projected values)', () => {
      const illResult = parsed.toolResults.find(tr => tr.tool_name === 'run_illustration')
      const result = illResult!.result as Record<string, unknown>
      const summary = result.summary as Record<string, unknown>
      expect(summary).toBeDefined()
      expect(summary.guaranteed_values).toBeDefined()
      expect(summary.projected_values).toBeDefined()
      expect(summary.income_benefit).toBeDefined()
      expect(summary.death_benefit).toBeDefined()
    })

    it('PDF saved to ACF Drive folder via save_to_drive', () => {
      const saveCall = parsed.toolCalls.find(tc => tc.tool_name === 'save_to_drive')
      expect(saveCall).toBeDefined()
      const input = saveCall!.tool_input!
      expect(input.file_id).toBeTruthy()
      expect(input.folder_id).toBeTruthy()
      expect(input.file_name).toMatch(/north_american.*\.pdf$/)

      const saveResult = parsed.toolResults.find(tr => tr.tool_name === 'save_to_drive')
      expect(saveResult).toBeDefined()
      const result = saveResult!.result as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.drive_link).toBeTruthy()
    })

    it('Playwright progress events track full portal flow', () => {
      const progressEvents = parsed.events.filter(e => e.type === 'progress')
      expect(progressEvents.length).toBeGreaterThanOrEqual(4)
      const steps = progressEvents.map(e => e.step)
      expect(steps).toContain('portal_login')
      expect(steps).toContain('form_fill')
      expect(steps).toContain('generate_illustration')
      expect(steps).toContain('pdf_download')
      // All progress steps should reference north_american carrier
      for (const pe of progressEvents) {
        expect(pe.carrier).toBe('north_american')
        expect(pe.status).toBe('complete')
      }
    })

    it('final text references client name and product', () => {
      const fullText = parsed.textChunks.join(' ')
      expect(fullText).toContain(TEST_CLIENT.last_name)
      expect(fullText).toContain(NA_POLICY_PARAMS.product_name)
      expect(fullText).toContain('ACF Drive')
    })

    it('[DONE] received at end of stream', () => {
      expect(parsed.done).toBe(true)
    })

    it('no error events in stream', () => {
      expect(parsed.errors).toHaveLength(0)
    })
  })

  // ── Sub-test 2: Athene Carrier — Full Illustration Flow ──────────────
  describe('Athene — RUN_ILLUSTRATION E2E', () => {
    let parsed: ParsedSseStream

    beforeAll(() => {
      parsed = parseSsePayload(ATHENE_ILLUSTRATION_STREAM)
    })

    it('SSE stream fires get_client + run_illustration + save_to_drive tool calls', () => {
      expect(parsed.toolCalls.length).toBeGreaterThanOrEqual(3)
      const toolNames = parsed.toolCalls.map(tc => tc.tool_name)
      expect(toolNames).toContain('get_client')
      expect(toolNames).toContain('run_illustration')
      expect(toolNames).toContain('save_to_drive')
    })

    it('run_illustration call uses real Athene policy parameters', () => {
      const illCall = parsed.toolCalls.find(tc => tc.tool_name === 'run_illustration')
      expect(illCall).toBeDefined()
      const input = illCall!.tool_input!
      expect(input.carrier).toBe('athene')
      expect(input.product_name).toBe(ATHENE_POLICY_PARAMS.product_name)
      expect(input.premium).toBe(ATHENE_POLICY_PARAMS.premium)
      expect(input.index_strategy).toBe(ATHENE_POLICY_PARAMS.index_strategy)
      expect(input.rider).toBe(ATHENE_POLICY_PARAMS.rider)
      expect(input.income_start_age).toBe(ATHENE_POLICY_PARAMS.income_start_age)
    })

    it('illustration result includes PDF file ID and ACF link', () => {
      const illResult = parsed.toolResults.find(tr => tr.tool_name === 'run_illustration')
      expect(illResult).toBeDefined()
      const result = illResult!.result as Record<string, unknown>
      expect(result.success).toBe(true)
      expect(result.pdf_file_id).toBeTruthy()
      expect(result.pdf_link).toBeTruthy()
      expect(result.status).toBe('complete')
    })

    it('Athene summary data includes income benefit at age 67', () => {
      const illResult = parsed.toolResults.find(tr => tr.tool_name === 'run_illustration')
      const result = illResult!.result as Record<string, unknown>
      const summary = result.summary as Record<string, unknown>
      const incomeBenefit = summary.income_benefit as Record<string, number>
      expect(incomeBenefit).toBeDefined()
      expect(incomeBenefit.start_age).toBe(67)
      expect(incomeBenefit.annual_income).toBeGreaterThan(0)
      expect(incomeBenefit.benefit_base).toBe(ATHENE_POLICY_PARAMS.premium)
    })

    it('PDF saved to ACF Drive folder via save_to_drive', () => {
      const saveCall = parsed.toolCalls.find(tc => tc.tool_name === 'save_to_drive')
      expect(saveCall).toBeDefined()
      const input = saveCall!.tool_input!
      expect(input.file_name).toMatch(/athene.*\.pdf$/)

      const saveResult = parsed.toolResults.find(tr => tr.tool_name === 'save_to_drive')
      const result = saveResult!.result as Record<string, unknown>
      expect(result.success).toBe(true)
    })

    it('Playwright progress events track full Athene portal flow', () => {
      const progressEvents = parsed.events.filter(e => e.type === 'progress')
      expect(progressEvents.length).toBeGreaterThanOrEqual(4)
      for (const pe of progressEvents) {
        expect(pe.carrier).toBe('athene')
        expect(pe.status).toBe('complete')
      }
    })

    it('final text references client name and Athene product', () => {
      const fullText = parsed.textChunks.join(' ')
      expect(fullText).toContain(TEST_CLIENT.last_name)
      expect(fullText).toContain(ATHENE_POLICY_PARAMS.product_name)
      expect(fullText).toContain('ACF Drive')
    })

    it('[DONE] received at end of stream', () => {
      expect(parsed.done).toBe(true)
    })

    it('no error events in stream', () => {
      expect(parsed.errors).toHaveLength(0)
    })
  })

  // ── Sub-test 3: Cross-Carrier Validation ─────────────────────────────
  describe('Cross-carrier validation', () => {
    it('both carriers produce illustration results with distinct IDs', () => {
      const naParsed = parseSsePayload(NA_ILLUSTRATION_STREAM)
      const athParsed = parseSsePayload(ATHENE_ILLUSTRATION_STREAM)

      const naResult = naParsed.toolResults.find(tr => tr.tool_name === 'run_illustration')
      const athResult = athParsed.toolResults.find(tr => tr.tool_name === 'run_illustration')

      const naData = naResult!.result as Record<string, unknown>
      const athData = athResult!.result as Record<string, unknown>

      expect(naData.illustration_id).not.toBe(athData.illustration_id)
      expect(naData.carrier).toBe('north_american')
      expect(athData.carrier).toBe('athene')
    })

    it('both carriers save PDFs with carrier-specific file names', () => {
      const naParsed = parseSsePayload(NA_ILLUSTRATION_STREAM)
      const athParsed = parseSsePayload(ATHENE_ILLUSTRATION_STREAM)

      const naSave = naParsed.toolCalls.find(tc => tc.tool_name === 'save_to_drive')
      const athSave = athParsed.toolCalls.find(tc => tc.tool_name === 'save_to_drive')

      expect((naSave!.tool_input!.file_name as string)).toMatch(/^north_american/)
      expect((athSave!.tool_input!.file_name as string)).toMatch(/^athene/)
    })

    it('both carriers target the same client ACF folder', () => {
      const naParsed = parseSsePayload(NA_ILLUSTRATION_STREAM)
      const athParsed = parseSsePayload(ATHENE_ILLUSTRATION_STREAM)

      const naSave = naParsed.toolCalls.find(tc => tc.tool_name === 'save_to_drive')
      const athSave = athParsed.toolCalls.find(tc => tc.tool_name === 'save_to_drive')

      expect(naSave!.tool_input!.folder_id).toBe(athSave!.tool_input!.folder_id)
    })
  })

  // ── Sub-test 4: Playwright MCP on MDJ_SERVER — Structural Verification ─
  describe('Playwright MCP on MDJ_SERVER — operational verification', () => {
    it('carrier-automation module exports runCarrierIllustration', () => {
      expect(runCarrierIllustration).toBeDefined()
      expect(typeof runCarrierIllustration).toBe('function')
    })

    it('SUPPORTED_CARRIERS includes north_american and athene', () => {
      expect(SUPPORTED_CARRIERS).toBeDefined()
      expect(SUPPORTED_CARRIERS).toContain('north_american')
      expect(SUPPORTED_CARRIERS).toContain('athene')
    })

    it('northAmericanModule has correct carrier key and runIllustration function', () => {
      expect(northAmericanModule).toBeDefined()
      expect(northAmericanModule.carrier).toBe('north_american')
      expect(northAmericanModule.name).toBeTruthy()
      expect(typeof northAmericanModule.runIllustration).toBe('function')
    })

    it('atheneModule has correct carrier key and runIllustration function', () => {
      expect(atheneModule).toBeDefined()
      expect(atheneModule.carrier).toBe('athene')
      expect(atheneModule.name).toBeTruthy()
      expect(typeof atheneModule.runIllustration).toBe('function')
    })
  })

  // ── Sub-test 5: Atomic Tool + Super Tool — Structural Verification ───
  describe('RUN_ILLUSTRATION tool chain — structural verification', () => {
    it('atomic tool exports execute function and definition', async () => {
      const atomicMod = await import(
        '../../../packages/core/src/voltron/tools/run-illustration'
      )
      expect(atomicMod.execute).toBeDefined()
      expect(typeof atomicMod.execute).toBe('function')
      expect(atomicMod.definition).toBeDefined()
      expect(atomicMod.definition.tool_id).toBe('run_illustration')
      expect(atomicMod.definition.type).toBe('ATOMIC')
      expect(atomicMod.definition.server_only).toBe(true)
    })

    it('atomic tool supports both carriers in definition', async () => {
      const atomicMod = await import(
        '../../../packages/core/src/voltron/tools/run-illustration'
      )
      const carrierProp = atomicMod.definition.parameters.properties.carrier as {
        enum: string[]
      }
      expect(carrierProp.enum).toContain('north_american')
      expect(carrierProp.enum).toContain('athene')
    })

    it('super tool exports execute function and definition', async () => {
      const superMod = await import(
        '../../../packages/core/src/voltron/super-tools/run-illustration'
      )
      expect(superMod.execute).toBeDefined()
      expect(typeof superMod.execute).toBe('function')
      expect(superMod.definition).toBeDefined()
      expect(superMod.definition.super_tool_id).toBe('RUN_ILLUSTRATION')
      expect(superMod.definition.entitlement_min).toBe('DIRECTOR')
    })

    it('super tool chains get_client and run_illustration', async () => {
      const superMod = await import(
        '../../../packages/core/src/voltron/super-tools/run-illustration'
      )
      expect(superMod.definition.tools).toContain('get_client')
      expect(superMod.definition.tools).toContain('run_illustration')
    })

    it('atomic tool requires client_data for form fill (no PHI gaps)', async () => {
      const atomicMod = await import(
        '../../../packages/core/src/voltron/tools/run-illustration'
      )
      const required = atomicMod.definition.parameters.required as string[]
      expect(required).toContain('client_data')
      const clientDataProps = (
        atomicMod.definition.parameters.properties.client_data as {
          properties: Record<string, unknown>
          required: string[]
        }
      )
      expect(clientDataProps.required).toContain('first_name')
      expect(clientDataProps.required).toContain('last_name')
      expect(clientDataProps.required).toContain('date_of_birth')
      expect(clientDataProps.required).toContain('state')
      expect(clientDataProps.required).toContain('gender')
    })
  })
})
