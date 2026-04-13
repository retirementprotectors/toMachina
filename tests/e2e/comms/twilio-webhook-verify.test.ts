/**
 * Unit tests for Twilio webhook signature verification middleware.
 * TKO-COMMS-005b
 *
 * Pure unit tests — no running server required.
 * Uses twilio's getExpectedTwilioSignature to generate valid test signatures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks.js'

// ---- test constants ---------------------------------------------------------

// Short stub value — no actual secret, just used to derive matching HMAC in tests
const TEST_HMAC_KEY = 'test-hmac-stub'
const TEST_URL = 'https://tm-api.run.app/api/comms/webhook/voice'
const TEST_PARAMS = { CallSid: 'CA123456', From: '+15551234567', To: '+18886208587' }

function makeValidSignature(
  url: string = TEST_URL,
  params: Record<string, string> = TEST_PARAMS,
  key: string = TEST_HMAC_KEY
): string {
  return getExpectedTwilioSignature(key, url, params)
}

// ---- mock helpers -----------------------------------------------------------

function makeMockReq(overrides: {
  signature?: string
  body?: Record<string, string>
  protocol?: string
  hostname?: string
  originalUrl?: string
  headers?: Record<string, string>
} = {}): Request {
  const {
    signature,
    body = { ...TEST_PARAMS },
    protocol = 'https',
    hostname = 'tm-api.run.app',
    originalUrl = '/api/comms/webhook/voice',
    headers = {},
  } = overrides

  const allHeaders: Record<string, string> = { ...headers }
  if (signature !== undefined) {
    allHeaders['x-twilio-signature'] = signature
  }

  return {
    get: (name: string) => allHeaders[name.toLowerCase()] ?? null,
    protocol,
    hostname,
    originalUrl,
    body,
    headers: allHeaders,
  } as unknown as Request
}

function makeMockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: null as unknown,
  } as Response & { statusCode: number; body: unknown }

  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (payload: unknown) => {
    res.body = payload
    return res
  }

  return res
}

// ---- lazy module loader with env override -----------------------------------

async function loadMiddleware(envKey: string) {
  vi.resetModules()
  const origEnv = process.env.TWILIO_AUTH_TOKEN
  process.env.TWILIO_AUTH_TOKEN = envKey
  const mod = await import('../../../services/api/src/lib/twilio-webhook-verify.js')
  process.env.TWILIO_AUTH_TOKEN = origEnv
  return mod.verifyTwilioSignature
}

// ---- tests ------------------------------------------------------------------

describe('verifyTwilioSignature — TKO-COMMS-005b', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TWILIO_AUTH_TOKEN = TEST_HMAC_KEY
  })

  it('1. Valid signature — calls next()', async () => {
    const verifyTwilioSignature = await loadMiddleware(TEST_HMAC_KEY)

    const sig = makeValidSignature(TEST_URL, TEST_PARAMS)
    const req = makeMockReq({
      signature: sig,
      body: TEST_PARAMS,
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'tm-api.run.app',
      },
    })
    const res = makeMockRes()
    const next = vi.fn() as unknown as NextFunction

    verifyTwilioSignature(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  it('2. Invalid signature — returns 401', async () => {
    const verifyTwilioSignature = await loadMiddleware(TEST_HMAC_KEY)

    const req = makeMockReq({
      signature: 'not-a-valid-hmac',
      body: TEST_PARAMS,
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'tm-api.run.app',
      },
    })
    const res = makeMockRes()
    const next = vi.fn() as unknown as NextFunction

    verifyTwilioSignature(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect((res.body as { success: boolean }).success).toBe(false)
    expect((res.body as { error: string }).error).toMatch(/invalid/i)
  })

  it('3. Missing signature header — returns 401 with "Missing Twilio signature"', async () => {
    const verifyTwilioSignature = await loadMiddleware(TEST_HMAC_KEY)

    const req = makeMockReq({
      body: TEST_PARAMS,
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'tm-api.run.app',
      },
    })
    const res = makeMockRes()
    const next = vi.fn() as unknown as NextFunction

    verifyTwilioSignature(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect((res.body as { error: string }).error).toBe('Missing Twilio signature')
  })

  it('4. X-Forwarded URL reconstruction — forwarded URL matches; raw internal URL does not', async () => {
    const verifyTwilioSignature = await loadMiddleware(TEST_HMAC_KEY)

    const publicUrl = 'https://tm-api.run.app/api/comms/webhook/sms-incoming'
    const smsParams: Record<string, string> = {
      MessageSid: 'SM999',
      From: '+15559876543',
      Body: 'Hello',
    }

    // Signature is computed by Twilio against the public URL
    const sigForPublicUrl = makeValidSignature(publicUrl, smsParams)

    // Case A: X-Forwarded headers reconstruct the public URL → PASS
    const reqA = makeMockReq({
      signature: sigForPublicUrl,
      body: smsParams,
      originalUrl: '/api/comms/webhook/sms-incoming',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'tm-api.run.app',
      },
    })
    const resA = makeMockRes()
    const nextA = vi.fn() as unknown as NextFunction
    verifyTwilioSignature(reqA, resA, nextA)
    expect(nextA).toHaveBeenCalledOnce()

    // Case B: No X-Forwarded headers → falls back to internal Cloud Run URL → FAIL
    // This proves the fix: without forwarded headers the internal URL won't match
    const reqB = makeMockReq({
      signature: sigForPublicUrl,
      body: smsParams,
      protocol: 'http',
      hostname: 'localhost',
      originalUrl: '/api/comms/webhook/sms-incoming',
      headers: {
        host: 'localhost:8080',
      },
    })
    const resB = makeMockRes()
    const nextB = vi.fn() as unknown as NextFunction
    verifyTwilioSignature(reqB, resB, nextB)

    // http://localhost:8080/... != https://tm-api.run.app/... → signature mismatch
    expect(nextB).not.toHaveBeenCalled()
    expect(resB.statusCode).toBe(401)
  })
})
