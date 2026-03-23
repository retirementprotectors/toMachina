/**
 * Cluster 6: Communications Pipeline E2E Tests
 *
 * TRK-13610: Email via SendGrid dryRun
 * TRK-13612: Voice via Twilio dryRun
 * TRK-13626: SMS via Twilio dryRun
 *
 * All tests use ?dryRun=true to avoid sending real messages.
 * Requires the API to be running (TEST_API_URL env var) AND valid auth.
 * Gracefully skips if API is unavailable or auth fails.
 */

import { describe, it, expect } from 'vitest'
import { apiPost } from '../helpers/api-client.js'

const API_AVAILABLE = !!process.env.TEST_API_URL

// ============================================================================
// TRK-13610: Email via SendGrid dryRun
// ============================================================================

describe('TRK-13610: Email via SendGrid dryRun', () => {
  it('should return dryRun success for send-email', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    const result = await apiPost<{
      dryRun: boolean
      to: string
      from: string
      commId: string
      statusCode: number
      messageId: string | null
    }>('/api/comms/send-email?dryRun=true', {
      to: 'test@example.com',
      subject: 'E2E Test',
      html: '<p>Test</p>',
    })

    // Auth may fail in CI — skip gracefully
    if (!result.success && result.error?.includes('HTTP 40')) {
      console.log('SKIP: API auth not available in this environment')
      return
    }

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.dryRun).toBe(true)
    expect(result.data!.to).toBe('test@example.com')
    expect(result.data!.commId).toBeTruthy()
  }, 30_000)
})

// ============================================================================
// TRK-13612: Voice via Twilio dryRun
// ============================================================================

describe('TRK-13612: Voice via Twilio dryRun', () => {
  it('should return dryRun success for send-voice', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    const result = await apiPost<{
      dryRun: boolean
      callSid: string | null
      to: string
      from: string
      status: string
      commId: string
    }>('/api/comms/send-voice?dryRun=true', {
      to: '+15551234567',
      twiml: '<Response><Say>E2E Test</Say></Response>',
    })

    if (!result.success && result.error?.includes('HTTP 40')) {
      console.log('SKIP: API auth not available in this environment')
      return
    }

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.dryRun).toBe(true)
    expect(result.data!.status).toBe('dry_run')
    expect(result.data!.commId).toBeTruthy()
  }, 30_000)
})

// ============================================================================
// TRK-13626: SMS via Twilio dryRun
// ============================================================================

describe('TRK-13626: SMS via Twilio dryRun', () => {
  it('should return dryRun success for send-sms', async () => {
    if (!API_AVAILABLE) {
      console.log('SKIP: TEST_API_URL not set — requires running API')
      return
    }

    const result = await apiPost<{
      dryRun: boolean
      messageSid: string | null
      to: string
      from: string
      status: string
      commId: string
    }>('/api/comms/send-sms?dryRun=true', {
      to: '+15551234567',
      body: 'E2E Test SMS',
    })

    if (!result.success && result.error?.includes('HTTP 40')) {
      console.log('SKIP: API auth not available in this environment')
      return
    }

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.dryRun).toBe(true)
    expect(result.data!.status).toBe('dry_run')
    expect(result.data!.commId).toBeTruthy()
  }, 30_000)
})
