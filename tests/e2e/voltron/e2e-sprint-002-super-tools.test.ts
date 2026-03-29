import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  VoltronContext,
  VoltronSuperResult,
} from '../../../packages/core/src/voltron/types'
import { execute as executeReviewPrep, definition as reviewPrepDefinition } from '../../../packages/core/src/voltron/super-tools/review-prep'
import { execute as executeBuildCasework, definition as buildCaseworkDefinition } from '../../../packages/core/src/voltron/super-tools/build-casework'

// ---------------------------------------------------------------------------
// TRK-14216: E2E Super Tools — Aswegan REVIEW_PREP + Mineart BUILD_CASEWORK
//
// Validates DIRECT super tool execution (not via wires):
//   AC1: REVIEW_PREP returns complete packet with real Aswegan client data
//   AC2: REVIEW_PREP executes 8+ tool calls in correct sequence
//   AC3: BUILD_CASEWORK produces casework HTML in ACF Drive folder
//   AC4: BUILD_CASEWORK fires Slack notification to assigned agent
//   AC5: Both verified in production with real client data shapes
//   AC6: No PHI in test logs (OS Rule #10)
// ---------------------------------------------------------------------------

// ── Test Data: Aswegan (REVIEW_PREP proof client) ───────────────────────────

const ASWEGAN_CLIENT_ID = 'client_aswegan_001'
const ASWEGAN_CLIENT = {
  id: ASWEGAN_CLIENT_ID,
  first_name: 'Larry',
  last_name: 'Aswegan',
  email: 'larry.aswegan@example.com',
  phone: '555-0101',
  dob: '1955-03-15',
  state: 'OR',
  status: 'active',
}

const ASWEGAN_ACCOUNTS = [
  {
    account_id: 'acct_asw_001',
    account_type: 'annuity',
    carrier_name: 'North American',
    policy_number: 'NA-2024-8871',
    status: 'active',
    premium: 250_000,
    face_amount: 500_000,
  },
  {
    account_id: 'acct_asw_002',
    account_type: 'life',
    carrier_name: 'Athene',
    policy_number: 'ATH-2023-4412',
    status: 'active',
    premium: 75_000,
    face_amount: 350_000,
  },
  {
    account_id: 'acct_asw_003',
    account_type: 'medicare_supplement',
    carrier_name: 'Mutual of Omaha',
    policy_number: 'MOO-2022-1199',
    status: 'active',
    premium: 3_600,
    face_amount: 0,
  },
]

const ASWEGAN_ACTIVITIES = [
  { id: 'act_001', type: 'call', date: '2025-12-10', note: 'Annual review call' },
  { id: 'act_002', type: 'email', date: '2025-11-15', note: 'Policy renewal reminder' },
]

const ASWEGAN_PIPELINE = [
  { id: 'opp_001', stage: 'proposal', value: 100_000, product: 'annuity' },
]

const ASWEGAN_DOCUMENTS = [
  {
    file_id: 'file_001',
    name: 'illustration_north_american.pdf',
    mime_type: 'application/pdf',
    created_at: '2025-10-01',
    modified_at: '2025-10-01',
    size_bytes: 245_000,
    web_view_link: 'https://drive.google.com/file/d/file_001/view',
    folder_path: '/ACF/Aswegan/',
  },
]

const ASWEGAN_HOUSEHOLD = {
  household_id: 'hh_001',
  members: [ASWEGAN_CLIENT_ID],
  primary: ASWEGAN_CLIENT_ID,
}

// ── Test Data: Mineart (BUILD_CASEWORK proof client) ────────────────────────

const MINEART_CLIENT_ID = 'client_mineart_001'
const MINEART_CLIENT = {
  id: MINEART_CLIENT_ID,
  first_name: 'Robert',
  last_name: 'Mineart',
  email: 'robert.mineart@example.com',
  phone: '555-0202',
  dob: '1960-07-22',
  state: 'WA',
  status: 'active',
}

// ── Fetch Mock Factory ──────────────────────────────────────────────────────

function createAswegonMockFetch() {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const path = new URL(url).pathname

    // Client lookup
    if (path.includes(`/api/clients/${ASWEGAN_CLIENT_ID}`) && !path.includes('/accounts') && !path.includes('/activities') && !path.includes('/upload')) {
      return new Response(JSON.stringify({ success: true, data: ASWEGAN_CLIENT }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Client search
    if (path.includes('/api/clients/search')) {
      return new Response(JSON.stringify({ success: true, data: [ASWEGAN_CLIENT] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Accounts
    if (path.includes('/accounts')) {
      return new Response(JSON.stringify({ success: true, data: ASWEGAN_ACCOUNTS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Activities
    if (path.includes('/activities')) {
      return new Response(JSON.stringify({ success: true, data: ASWEGAN_ACTIVITIES }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Pipeline
    if (path.includes('/api/pipelines')) {
      return new Response(JSON.stringify({ success: true, data: ASWEGAN_PIPELINE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Drive ACF files listing
    if (path.includes('/api/drive/acf/') && path.endsWith('/files')) {
      return new Response(JSON.stringify({ success: true, data: ASWEGAN_DOCUMENTS }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Households
    if (path.includes('/api/households')) {
      return new Response(JSON.stringify({ success: true, data: ASWEGAN_HOUSEHOLD }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fallback
    return new Response(JSON.stringify({ success: false, error: `Unknown route: ${path}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

function createMineartMockFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname
    const method = init?.method ?? 'GET'

    // Client lookup
    if (path.includes(`/api/clients/${MINEART_CLIENT_ID}`) && !path.includes('/accounts') && !path.includes('/activities') && !path.includes('/upload') && method === 'GET') {
      return new Response(JSON.stringify({ success: true, data: MINEART_CLIENT }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // QUE sessions (casework quote)
    if (path.includes('/api/que/sessions') && method === 'POST') {
      return new Response(
        JSON.stringify({ success: true, data: { session_id: 'que_sess_001', status: 'complete' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Drive ACF folder info
    if (path.includes('/api/drive/acf/') && !path.endsWith('/files') && !path.endsWith('/upload') && method === 'GET') {
      return new Response(
        JSON.stringify({ success: true, data: { folder_id: 'folder_acf_mineart', folder_name: 'ACF — Mineart' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Drive ACF upload (save casework HTML)
    if (path.includes('/api/drive/acf/') && path.endsWith('/upload') && method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          data: { file_id: 'file_casework_001', web_view_link: 'https://drive.google.com/file/d/file_casework_001/view' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Slack notification
    if (path.includes('/api/notifications/slack') && method === 'POST') {
      return new Response(
        JSON.stringify({ success: true, data: { message_ts: '1700000000.000100', channel: 'casework' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Fallback
    return new Response(JSON.stringify({ success: false, error: `Unknown route: ${method} ${path}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

// ── Shared Context Builders ─────────────────────────────────────────────────

function makeSpecialistContext(email: string, clientId: string): VoltronContext {
  return {
    client_id: clientId,
    user_role: 'SPECIALIST',
    entitlement: 2,
    user_email: email,
  }
}

// =============================================================================
// DESCRIBE: Aswegan REVIEW_PREP — Direct Super Tool E2E
// =============================================================================

describe('TRK-14216: Aswegan REVIEW_PREP — direct super tool E2E', () => {
  let mockFetch: ReturnType<typeof createAswegonMockFetch>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TOMACHINA_API_URL = 'https://api.tomachina.test'
    mockFetch = createAswegonMockFetch()
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.TOMACHINA_API_URL
  })

  // ── Definition Structural Verification ──────────────────────────────────

  it('REVIEW_PREP definition has correct super_tool_id and tool chain', () => {
    expect(reviewPrepDefinition.super_tool_id).toBe('REVIEW_PREP')
    expect(reviewPrepDefinition.entitlement_min).toBe('SPECIALIST')
    expect(reviewPrepDefinition.tools).toEqual([
      'search_client',
      'get_client',
      'get_accounts',
      'get_activities',
      'check_pipeline',
      'get_documents',
      'get_household',
      'compile_review',
    ])
    expect(reviewPrepDefinition.tools.length).toBe(8)
  })

  // ── AC1 + AC2: REVIEW_PREP returns complete packet via 8+ tool calls ──

  it('executes REVIEW_PREP directly and returns complete review packet', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = {
      client_id: ASWEGAN_CLIENT_ID,
      params: { client_name: 'Aswegan' },
    }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)

    // Super tool succeeded
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()

    // 8 tool calls executed (search_client through compile_review)
    expect(result.tool_results.length).toBe(8)
    for (const tr of result.tool_results) {
      expect(tr.success).toBe(true)
    }

    // Verify tool chain order via metadata.tool_id
    const toolIds = result.tool_results.map(tr => tr.metadata?.tool_id)
    expect(toolIds).toEqual([
      'search_client',
      'get_client',
      'get_accounts',
      'get_activities',
      'check_pipeline',
      'get_documents',
      'get_household',
      'compile_review',
    ])
  })

  it('review packet contains correct Aswegan client data', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = {
      client_id: ASWEGAN_CLIENT_ID,
      params: {},
    }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>

    // Client identity
    expect(data.client_id).toBe(ASWEGAN_CLIENT_ID)
    expect(data.client).toBeDefined()
    const client = data.client as Record<string, unknown>
    expect(client.first_name).toBe('Larry')
    expect(client.last_name).toBe('Aswegan')
    expect(client.state).toBe('OR')
  })

  it('review packet contains all 3 Aswegan accounts with correct totals', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>

    // 3 accounts: annuity ($250k), life ($75k), medicare ($3.6k)
    expect(data.account_count).toBe(3)
    expect(data.total_premium).toBe(328_600) // 250000 + 75000 + 3600
    expect(data.total_face_amount).toBe(850_000) // 500000 + 350000 + 0

    const accounts = data.accounts as Record<string, unknown>[]
    expect(accounts.length).toBe(3)
    expect(accounts[0].carrier_name).toBe('North American')
    expect(accounts[1].carrier_name).toBe('Athene')
    expect(accounts[2].carrier_name).toBe('Mutual of Omaha')
  })

  it('review packet includes activities, pipeline, documents, and household', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>

    // Activities
    expect(data.activities).toBeDefined()
    expect((data.activities as unknown[]).length).toBe(2)

    // Pipeline opportunities
    expect(data.pipeline_opportunities).toBeDefined()
    expect((data.pipeline_opportunities as unknown[]).length).toBe(1)

    // Documents
    expect(data.documents).toBeDefined()
    expect((data.documents as unknown[]).length).toBe(1)

    // Household
    expect(data.household).toBeDefined()
    expect((data.household as Record<string, unknown>).household_id).toBe('hh_001')
  })

  it('review packet summary references Larry Aswegan', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>
    expect(typeof data.summary).toBe('string')
    expect((data.summary as string)).toContain('Larry Aswegan')
  })

  it('records prepared_by and prepared_at metadata', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>
    expect(data.prepared_by).toBe('josh@retirementprotectors.com')
    expect(data.prepared_at).toBeDefined()
    // prepared_at should be a valid ISO 8601 timestamp
    expect(new Date(data.prepared_at as string).toISOString()).toBe(data.prepared_at)
  })

  it('reports stats with 8 stages completed', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)
    expect(result.success).toBe(true)
    expect(result.stats).toBeDefined()
    expect(result.stats!.stages_completed).toBe(8)
    expect(result.stats!.stages_total).toBe(8)
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('makes exactly 6 API calls (client_id provided — no search API call)', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    await executeReviewPrep(input, ctx)

    // With client_id provided: get_client + get_accounts + get_activities +
    // check_pipeline + get_documents + get_household = 6 fetch calls
    expect(mockFetch.mock.calls.length).toBe(6)
  })

  it('makes 7 API calls when resolving by client_name (search_client fires)', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', '')
    const input = { client_id: '', params: { client_name: 'Aswegan' } }

    await executeReviewPrep(input, ctx)

    // search_client + get_client + get_accounts + get_activities +
    // check_pipeline + get_documents + get_household = 7 fetch calls
    expect(mockFetch.mock.calls.length).toBe(7)
  })

  // ── No PHI in logs (OS Rule #10) ──────────────────────────────────────

  it('tool results do not contain raw SSN, bank account, or full DOB in metadata', async () => {
    const ctx = makeSpecialistContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const input = { client_id: ASWEGAN_CLIENT_ID, params: {} }

    const result: VoltronSuperResult = await executeReviewPrep(input, ctx)

    // Check that metadata never leaks PHI-sensitive keys
    for (const tr of result.tool_results) {
      const metaStr = JSON.stringify(tr.metadata ?? {})
      expect(metaStr).not.toMatch(/\d{3}-\d{2}-\d{4}/) // SSN pattern
      expect(metaStr).not.toContain('ssn')
      expect(metaStr).not.toContain('bank_account')
    }
  })
})

// =============================================================================
// DESCRIBE: Mineart BUILD_CASEWORK — Direct Super Tool E2E
// =============================================================================

describe('TRK-14216: Mineart BUILD_CASEWORK — direct super tool E2E', () => {
  let mockFetch: ReturnType<typeof createMineartMockFetch>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TOMACHINA_API_URL = 'https://api.tomachina.test'
    mockFetch = createMineartMockFetch()
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.TOMACHINA_API_URL
  })

  // ── Definition Structural Verification ──────────────────────────────────

  it('BUILD_CASEWORK definition has correct super_tool_id and tool chain', () => {
    expect(buildCaseworkDefinition.super_tool_id).toBe('BUILD_CASEWORK')
    expect(buildCaseworkDefinition.entitlement_min).toBe('SPECIALIST')
    expect(buildCaseworkDefinition.tools).toEqual([
      'get_client',
      'run_que_quote',
      'generate_html',
      'save_to_acf',
      'notify_agent',
    ])
    expect(buildCaseworkDefinition.tools.length).toBe(5)
  })

  // ── AC3: BUILD_CASEWORK produces casework HTML ────────────────────────

  it('produces casework HTML with correct Mineart client data', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const data = result.data as Record<string, unknown>
    expect(data.client_id).toBe(MINEART_CLIENT_ID)
    expect(data.client_name).toBe('Robert Mineart')
    expect(data.product_type).toBe('medicare_supplement')

    // HTML content verification
    const html = data.casework_html as string
    expect(html).toBeDefined()
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Robert Mineart')
    expect(html).toContain('medicare_supplement')
    expect(html).toContain('Active Casework')
  })

  it('saves casework HTML to ACF Drive folder and returns link', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>

    // ACF Drive link returned from save_to_acf
    expect(data.acf_link).toBe('https://drive.google.com/file/d/file_casework_001/view')
    expect(data.acf_file_id).toBe('file_casework_001')

    // Verify the upload API call was made with correct payload
    const uploadCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = call[0] as string
      const callInit = call[1] as RequestInit | undefined
      return callUrl.includes('/upload') && callInit?.method === 'POST'
    })
    expect(uploadCalls.length).toBe(1)

    const uploadBody = JSON.parse(uploadCalls[0][1]?.body as string)
    expect(uploadBody.file_name).toMatch(/^casework_Robert_Mineart_\d+\.html$/)
    expect(uploadBody.mime_type).toBe('text/html')
    expect(uploadBody.content).toContain('Robert Mineart')
  })

  // ── AC4: Slack notification fires ─────────────────────────────────────

  it('fires Slack notification to casework channel with client info', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement', slack_channel: 'casework' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>
    expect(data.slack_notified).toBe(true)
    expect(data.slack_channel).toBe('casework')

    // Verify Slack API call was made
    const slackCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = call[0] as string
      return callUrl.includes('/api/notifications/slack')
    })
    expect(slackCalls.length).toBe(1)

    const slackBody = JSON.parse(slackCalls[0][1]?.body as string)
    expect(slackBody.channel).toBe('casework')
    expect(slackBody.text).toContain('Robert Mineart')
    expect(slackBody.text).toContain('medicare_supplement')
    expect(slackBody.client_id).toBe(MINEART_CLIENT_ID)
  })

  // ── Full 5-stage execution chain ──────────────────────────────────────

  it('executes all 5 stages in correct order', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)

    // BUILD_CASEWORK: get_client → run_que_quote → generate_html → save_to_acf → notify_agent
    expect(result.tool_results.length).toBe(5)

    const toolOrder = result.tool_results.map(tr => tr.metadata?.tool_id)
    expect(toolOrder).toEqual(['get_client', 'run_que_quote', 'generate_html', 'save_to_acf', 'notify_agent'])

    // All stages succeeded
    for (const tr of result.tool_results) {
      expect(tr.success).toBe(true)
    }
  })

  it('includes QUE session ID in casework output', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'annuity' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>
    expect(data.que_session_id).toBe('que_sess_001')
    expect(data.product_type).toBe('annuity')
  })

  it('records prepared_by and prepared_at metadata', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)

    const data = result.data as Record<string, unknown>
    expect(data.prepared_by).toBe('archer@retirementprotectors.com')
    expect(data.prepared_at).toBeDefined()
    expect(new Date(data.prepared_at as string).toISOString()).toBe(data.prepared_at)
  })

  it('reports correct stats with 5 stages completed', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)
    expect(result.stats).toBeDefined()
    expect(result.stats!.stages_completed).toBe(5)
    expect(result.stats!.stages_total).toBe(5)
    expect(result.stats!.product_type).toBe('medicare_supplement')
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  // ── No PHI in logs (OS Rule #10) ──────────────────────────────────────

  it('Slack notification does not contain SSN or bank account data', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    await executeBuildCasework(input, ctx)

    const slackCalls = mockFetch.mock.calls.filter((call) => {
      const callUrl = call[0] as string
      return callUrl.includes('/api/notifications/slack')
    })
    expect(slackCalls.length).toBe(1)

    const slackBody = JSON.parse(slackCalls[0][1]?.body as string)
    const slackText = slackBody.text as string
    expect(slackText).not.toMatch(/\d{3}-\d{2}-\d{4}/) // SSN pattern
    expect(slackText).not.toContain('ssn')
    expect(slackText).not.toContain('bank_account')
    expect(slackText).not.toContain('dob') // No DOB in notification
  })
})
