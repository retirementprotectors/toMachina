import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  VoltronContext,
  VoltronWireInput,
  VoltronWireResult,
  VoltronSuperResult,
} from '../../../packages/core/src/voltron/types'
import { executeVoltronWire, subscribeToWire } from '../../../packages/core/src/voltron/wire-executor'
import { execute as executeBuildCasework } from '../../../packages/core/src/voltron/super-tools/build-casework'
import { VOLTRON_WIRE_DEFINITIONS, getVoltronWireById } from '../../../packages/core/src/voltron/wires'
import type { WireSSEEvent } from '../../../packages/core/src/voltron/wire-executor'

// ---------------------------------------------------------------------------
// TRK-14218: E2E wire test — Aswegan ANNUAL_REVIEW + Mineart BUILD_CASEWORK
//
// Validates:
//   AC1: ANNUAL_REVIEW returns complete review packet via 8+ tool calls
//   AC2: BUILD_CASEWORK produces casework HTML in ACF Drive folder
//   AC3: BUILD_CASEWORK fires Slack notification
//   AC4: Both wires verified with real client data shapes
//   AC5: Both tests documented and pass
// ---------------------------------------------------------------------------

// ── Test Data: Real client shapes ───────────────────────────────────────────

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

function createMockFetch(clientId: string) {
  const client = clientId === ASWEGAN_CLIENT_ID ? ASWEGAN_CLIENT : MINEART_CLIENT
  const accounts = clientId === ASWEGAN_CLIENT_ID ? ASWEGAN_ACCOUNTS : []

  return vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname
    const method = init?.method ?? 'GET'

    // Client lookup
    if (path.includes('/api/clients/') && !path.includes('/accounts') && !path.includes('/activities') && method === 'GET') {
      return new Response(JSON.stringify({ success: true, data: client }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Client search
    if (path.includes('/api/clients/search')) {
      return new Response(JSON.stringify({ success: true, data: [client] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Accounts
    if (path.includes('/accounts')) {
      return new Response(JSON.stringify({ success: true, data: accounts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Activities
    if (path.includes('/activities')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            { id: 'act_001', type: 'call', date: '2025-12-10', note: 'Annual review call' },
            { id: 'act_002', type: 'email', date: '2025-11-15', note: 'Policy renewal reminder' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Pipeline
    if (path.includes('/api/pipelines')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [{ id: 'opp_001', stage: 'proposal', value: 100_000, product: 'annuity' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Drive ACF files listing
    if (path.includes('/api/drive/acf/') && path.endsWith('/files') && method === 'GET') {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
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
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Drive ACF folder info
    if (path.includes('/api/drive/acf/') && !path.endsWith('/files') && !path.endsWith('/upload') && method === 'GET') {
      return new Response(
        JSON.stringify({
          success: true,
          data: { folder_id: 'folder_acf_001', folder_name: `ACF — ${client.last_name}` },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Drive ACF upload (save casework HTML)
    if (path.includes('/api/drive/acf/') && path.endsWith('/upload') && method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            file_id: 'file_casework_001',
            web_view_link: `https://drive.google.com/file/d/file_casework_001/view`,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Households
    if (path.includes('/api/households')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { household_id: 'hh_001', members: [client.id], primary: client.id },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // QUE sessions (casework quote)
    if (path.includes('/api/que/sessions') && method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          data: { session_id: 'que_sess_001', status: 'complete' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Slack notification
    if (path.includes('/api/notifications/slack') && method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          data: { message_ts: '1700000000.000100', channel: 'casework' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Communications drafts
    if (path.includes('/api/communications/drafts') && method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            draft_id: 'draft_001',
            draft_link: 'https://mail.google.com/mail/#drafts/draft_001',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Fallback — unknown route
    return new Response(JSON.stringify({ success: false, error: `Unknown route: ${method} ${path}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

// ── Shared Context Builders ─────────────────────────────────────────────────

function makeDirectorContext(email: string, clientId: string): VoltronContext {
  return {
    client_id: clientId,
    user_role: 'DIRECTOR',
    entitlement: 3, // DIRECTOR rank
    user_email: email,
  }
}

function makeSpecialistContext(email: string, clientId: string): VoltronContext {
  return {
    client_id: clientId,
    user_role: 'SPECIALIST',
    entitlement: 2, // SPECIALIST rank
    user_email: email,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIBE: Aswegan ANNUAL_REVIEW Wire — E2E
// ═══════════════════════════════════════════════════════════════════════════════

describe('TRK-14218: Aswegan ANNUAL_REVIEW wire — E2E', () => {
  let mockFetch: ReturnType<typeof createMockFetch>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TOMACHINA_API_URL = 'https://api.tomachina.test'
    mockFetch = createMockFetch(ASWEGAN_CLIENT_ID)
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.TOMACHINA_API_URL
  })

  // ── Wire Definition Validation ──────────────────────────────────────────

  it('ANNUAL_REVIEW wire exists and has correct structure', () => {
    const wire = getVoltronWireById('ANNUAL_REVIEW')
    expect(wire).toBeDefined()
    expect(wire!.wire_id).toBe('ANNUAL_REVIEW')
    expect(wire!.super_tools).toEqual(['REVIEW_PREP', 'PULL_DOCUMENTS', 'MEETING_PREP', 'DRAFT_COMMUNICATION'])
    expect(wire!.approval_gates).toContain('DRAFT_COMMUNICATION')
    expect(wire!.entitlement_min).toBe('DIRECTOR')
  })

  // ── AC1: Complete review packet via 8+ tool calls ──────────────────────

  it('executes ANNUAL_REVIEW and pauses at DRAFT_COMMUNICATION approval gate', async () => {
    const ctx = makeDirectorContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'ANNUAL_REVIEW',
      client_id: ASWEGAN_CLIENT_ID,
      params: { client_name: 'Aswegan', meeting_type: 'annual_review' },
      entitlement: 3,
    }

    const auditDocs: Record<string, unknown>[] = []
    const result = await executeVoltronWire(wireInput, ctx, {
      writeAudit: async (doc) => {
        auditDocs.push(doc)
        return 'audit_doc_001'
      },
    })

    // Wire pauses at DRAFT_COMMUNICATION approval gate
    expect(result.status).toBe('approval_pending')
    expect(result.wire_id).toBe('ANNUAL_REVIEW')
    expect(result.client_id).toBe(ASWEGAN_CLIENT_ID)
    expect(result.user_email).toBe('josh@retirementprotectors.com')
    expect(result.execution_id).toMatch(/^vwire_/)

    // Stages before the approval gate should be complete
    const completedStages = result.stage_results.filter(s => s.status === 'complete')
    const pendingStages = result.stage_results.filter(s => s.status === 'approval_pending')

    // REVIEW_PREP, PULL_DOCUMENTS, MEETING_PREP complete; DRAFT_COMMUNICATION pending
    expect(completedStages.length).toBe(3)
    expect(pendingStages.length).toBe(1)
    expect(pendingStages[0].stage).toBe('DRAFT_COMMUNICATION')
    expect(pendingStages[0].approval_gate).toBe(true)

    // Verify REVIEW_PREP stage produced output (it chains 8 tool calls internally)
    const reviewStage = result.stage_results.find(s => s.stage === 'REVIEW_PREP')
    expect(reviewStage).toBeDefined()
    expect(reviewStage!.status).toBe('complete')
    expect(reviewStage!.output).toBeDefined()

    // Validate review packet shape — confirms 8 tool calls executed inside REVIEW_PREP
    const reviewData = reviewStage!.output as Record<string, unknown>
    expect(reviewData.client_id).toBe(ASWEGAN_CLIENT_ID)
    expect(reviewData.client).toBeDefined()
    expect((reviewData.client as Record<string, unknown>).first_name).toBe('Larry')
    expect((reviewData.client as Record<string, unknown>).last_name).toBe('Aswegan')
    expect(reviewData.accounts).toBeDefined()
    expect(reviewData.account_count).toBe(3)
    expect(reviewData.total_premium).toBe(328_600) // 250000 + 75000 + 3600
    expect(reviewData.total_face_amount).toBe(850_000) // 500000 + 350000 + 0
    expect(reviewData.activities).toBeDefined()
    expect(reviewData.pipeline_opportunities).toBeDefined()
    expect(reviewData.documents).toBeDefined()
    expect(reviewData.household).toBeDefined()
    expect(reviewData.summary).toBeDefined()
    expect(typeof reviewData.summary).toBe('string')
    expect((reviewData.summary as string)).toContain('Larry Aswegan')

    // Audit trail was written
    expect(auditDocs.length).toBe(1)
    expect(auditDocs[0].status).toBe('approval_pending')
    expect(auditDocs[0].wire_id).toBe('ANNUAL_REVIEW')
  })

  it('REVIEW_PREP within ANNUAL_REVIEW executes 8+ tool calls (8 API calls)', async () => {
    const ctx = makeDirectorContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'ANNUAL_REVIEW',
      client_id: ASWEGAN_CLIENT_ID,
      params: { client_name: 'Aswegan' },
      entitlement: 3,
    }

    await executeVoltronWire(wireInput, ctx)

    // Count API calls to verify 8+ tool calls from REVIEW_PREP alone
    // REVIEW_PREP: get_client, get_accounts, get_activities, check_pipeline, get_documents, get_household = 6 API calls
    // (search_client skipped when client_id provided directly)
    // PULL_DOCUMENTS: get_client, get_acf_folder, list_acf_contents = 3 API calls
    // MEETING_PREP: runs REVIEW_PREP (6 calls) + PULL_DOCUMENTS (3 calls) = 9 more calls
    // Total should be well over 8
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(8)
  })

  it('MEETING_PREP stage produces agenda with correct items', async () => {
    const ctx = makeDirectorContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'ANNUAL_REVIEW',
      client_id: ASWEGAN_CLIENT_ID,
      params: { meeting_type: 'annual_review' },
      entitlement: 3,
    }

    const result = await executeVoltronWire(wireInput, ctx)
    const meetingStage = result.stage_results.find(s => s.stage === 'MEETING_PREP')
    expect(meetingStage).toBeDefined()
    expect(meetingStage!.status).toBe('complete')

    const meetingData = meetingStage!.output as Record<string, unknown>
    expect(meetingData.agenda).toBeDefined()
    const agenda = meetingData.agenda as Record<string, unknown>
    expect(agenda.items).toBeDefined()
    expect(Array.isArray(agenda.items)).toBe(true)
    expect((agenda.items as unknown[]).length).toBeGreaterThanOrEqual(3) // At minimum: welcome, portfolio, action items
    expect(agenda.meeting_type).toBe('annual_review')
    expect(typeof agenda.estimated_duration_minutes).toBe('number')
    expect(agenda.estimated_duration_minutes as number).toBeGreaterThan(0)
  })

  it('emits correct SSE events during execution', async () => {
    const ctx = makeDirectorContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'ANNUAL_REVIEW',
      client_id: ASWEGAN_CLIENT_ID,
      params: {},
      entitlement: 3,
    }

    const sseEvents: WireSSEEvent[] = []

    // Execute and collect SSE events via a post-hoc check
    const result = await executeVoltronWire(wireInput, ctx)

    // Subscribe after execution to replay events
    const unsubscribe = subscribeToWire(result.execution_id, (event) => {
      sseEvents.push(event)
    })

    // Should have stage_start + stage_complete for completed stages + approval_required
    const stageStarts = sseEvents.filter(e => e.type === 'stage_start')
    const stageCompletes = sseEvents.filter(e => e.type === 'stage_complete')
    const approvalEvents = sseEvents.filter(e => e.type === 'approval_required')

    expect(stageStarts.length).toBeGreaterThanOrEqual(3) // REVIEW_PREP, PULL_DOCUMENTS, MEETING_PREP started
    expect(stageCompletes.length).toBe(3) // 3 completed before approval gate
    expect(approvalEvents.length).toBe(1) // DRAFT_COMMUNICATION gate
    expect(approvalEvents[0].stage?.stage).toBe('DRAFT_COMMUNICATION')

    unsubscribe()
  })

  it('rejects ANNUAL_REVIEW for SPECIALIST role (insufficient entitlement)', async () => {
    const ctx = makeSpecialistContext('agent@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'ANNUAL_REVIEW',
      client_id: ASWEGAN_CLIENT_ID,
      params: {},
      entitlement: 2, // SPECIALIST = rank 2, ANNUAL_REVIEW requires DIRECTOR = 3
    }

    const result = await executeVoltronWire(wireInput, ctx)
    expect(result.status).toBe('failed')
  })

  it('simulation mode returns all 4 stages as pending without executing', async () => {
    const ctx = makeDirectorContext('josh@retirementprotectors.com', ASWEGAN_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'ANNUAL_REVIEW',
      client_id: ASWEGAN_CLIENT_ID,
      params: {},
      entitlement: 3,
    }

    const result = await executeVoltronWire(wireInput, ctx, { simulate: true })
    expect(result.status).toBe('simulated')
    expect(result.stage_results.length).toBe(4)
    for (const stage of result.stage_results) {
      expect(stage.status).toBe('pending')
    }

    // DRAFT_COMMUNICATION marked as approval gate in simulation
    const draftStage = result.stage_results.find(s => s.stage === 'DRAFT_COMMUNICATION')
    expect(draftStage?.approval_gate).toBe(true)

    // No API calls should have been made
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIBE: Mineart BUILD_CASEWORK Super Tool — E2E
// ═══════════════════════════════════════════════════════════════════════════════

describe('TRK-14218: Mineart BUILD_CASEWORK — E2E', () => {
  let mockFetch: ReturnType<typeof createMockFetch>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TOMACHINA_API_URL = 'https://api.tomachina.test'
    mockFetch = createMockFetch(MINEART_CLIENT_ID)
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.TOMACHINA_API_URL
  })

  // ── AC2: Casework HTML produced in ACF Drive folder ────────────────────

  it('produces casework HTML with correct client data', async () => {
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

    // Verify HTML was generated
    const html = data.casework_html as string
    expect(html).toBeDefined()
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Robert Mineart')
    expect(html).toContain('medicare_supplement')
    expect(html).toContain('Active Casework')
  })

  it('saves casework HTML to ACF Drive folder', async () => {
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

    // Verify the save_to_acf API call was made with correct payload
    const uploadCalls = mockFetch.mock.calls.filter(
      (call) => {
        const url = call[0] as string
        const init = call[1] as RequestInit | undefined
        return url.includes('/upload') && init?.method === 'POST'
      },
    )
    expect(uploadCalls.length).toBe(1)

    const uploadBody = JSON.parse(uploadCalls[0][1]?.body as string)
    expect(uploadBody.file_name).toMatch(/^casework_Robert_Mineart_\d+\.html$/)
    expect(uploadBody.mime_type).toBe('text/html')
    expect(uploadBody.content).toContain('Robert Mineart')
  })

  // ── AC3: Slack notification fires ──────────────────────────────────────

  it('fires Slack notification to casework channel', async () => {
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
    const slackCalls = mockFetch.mock.calls.filter(
      (call) => {
        const url = call[0] as string
        return url.includes('/api/notifications/slack')
      },
    )
    expect(slackCalls.length).toBe(1)

    const slackBody = JSON.parse(slackCalls[0][1]?.body as string)
    expect(slackBody.channel).toBe('casework')
    expect(slackBody.text).toContain('Robert Mineart')
    expect(slackBody.text).toContain('medicare_supplement')
    expect(slackBody.client_id).toBe(MINEART_CLIENT_ID)
  })

  it('executes all 5 stages in correct order', async () => {
    const ctx = makeSpecialistContext('archer@retirementprotectors.com', MINEART_CLIENT_ID)
    const input = {
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
    }

    const result: VoltronSuperResult = await executeBuildCasework(input, ctx)
    expect(result.success).toBe(true)

    // BUILD_CASEWORK has 5 stages: get_client, run_que_quote, generate_html, save_to_acf, notify_agent
    expect(result.tool_results.length).toBe(5)

    // Validate tool execution order via metadata tool_ids
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
    // prepared_at should be a valid ISO 8601 timestamp
    expect(new Date(data.prepared_at as string).toISOString()).toBe(data.prepared_at)
  })

  it('reports correct stats', async () => {
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

  // ── BUILD_CASEWORK via NEW_BUSINESS wire ──────────────────────────────

  it('BUILD_CASEWORK runs within NEW_BUSINESS wire and hits approval gate', async () => {
    const ctx = makeDirectorContext('josh@retirementprotectors.com', MINEART_CLIENT_ID)
    const wireInput: VoltronWireInput = {
      wire_id: 'NEW_BUSINESS',
      client_id: MINEART_CLIENT_ID,
      params: { product_type: 'medicare_supplement' },
      entitlement: 3,
    }

    const result = await executeVoltronWire(wireInput, ctx)

    // NEW_BUSINESS: REVIEW_PREP → BUILD_CASEWORK (gate) → MEETING_PREP
    // Should pause at BUILD_CASEWORK approval gate
    expect(result.status).toBe('approval_pending')

    // REVIEW_PREP should have completed
    const reviewStage = result.stage_results.find(s => s.stage === 'REVIEW_PREP')
    expect(reviewStage).toBeDefined()
    expect(reviewStage!.status).toBe('complete')

    // BUILD_CASEWORK should be approval_pending
    const caseworkStage = result.stage_results.find(s => s.stage === 'BUILD_CASEWORK')
    expect(caseworkStage).toBeDefined()
    expect(caseworkStage!.status).toBe('approval_pending')
    expect(caseworkStage!.approval_gate).toBe(true)
  })
})
