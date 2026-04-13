/**
 * Unit tests for verifySendGridSignature middleware (TKO-COMMS-005a)
 *
 * Tests run without a test framework (pure Node.js / tsx). Exit 0 = all pass.
 * Run: npx tsx src/__tests__/sendgrid-webhook-verify.test.ts
 *
 * Six cases:
 *   1. Valid signature + fresh timestamp → next() called (passes through)
 *   2. Invalid signature (garbage bytes) → 401 "Invalid SendGrid signature"
 *   3. Expired timestamp (> 10 min old) → 401 "Signature expired"
 *   4. Missing signature header → 401 "Missing SendGrid signature headers"
 *   5. Missing timestamp header → 401 "Missing SendGrid signature headers"
 *   6. SENDGRID_WEBHOOK_PUBLIC_KEY not set → 500 "Webhook verification not configured" (fail-closed)
 */

import { generateKeyPairSync, createSign } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { verifySendGridSignature } from '../lib/sendgrid-webhook-verify.js'

// ─── Test harness ────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

type MockCapture = { statusCode: number; body: unknown }

/** Build a minimal mock Request */
function mockReq(overrides: {
  headers?: Record<string, string>
  body?: unknown
  rawBody?: Buffer
}): Request {
  return {
    headers: overrides.headers ?? {},
    body: overrides.body ?? {},
    rawBody: overrides.rawBody,
  } as unknown as Request
}

/** Build a mock Response that captures status + json calls via a shared object */
function mockRes(): { res: Response; c: MockCapture } {
  const c: MockCapture = { statusCode: 200, body: null }
  const res = {
    status(code: number) { c.statusCode = code; return res },
    json(body: unknown) { c.body = body; return res },
  } as unknown as Response
  return { res, c }
}

// ─── Key material ─────────────────────────────────────────────────────────────

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

/** Produces a valid SendGrid-style signature: sign(timestamp + rawBody) */
function sign(ts: string, body: string): string {
  const s = createSign('SHA256')
  s.update(Buffer.from(ts, 'utf8'))
  s.update(Buffer.from(body, 'utf8'))
  return s.sign(privateKey, 'base64')
}

function nowSec(): string {
  return String(Math.floor(Date.now() / 1000))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

/** Run middleware and return whether next() was called */
function runMiddleware(req: Request, res: Response): boolean {
  // Using an array element sidesteps TS narrowing that treats `let x = false` as never-true
  const flags = [false]
  verifySendGridSignature(req, res, (() => { flags[0] = true }) as NextFunction)
  return flags[0]
}

console.log('\n[sendgrid-webhook-verify] Running tests...\n')

// ── Test 1: Valid signature → next() called ──────────────────────────────────
{
  console.log('Test 1: Valid signature → passes through')
  process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = publicKey as string

  const bodyStr = JSON.stringify([{ event: 'delivered', email: 'test@example.com' }])
  const ts = nowSec()
  const sig = sign(ts, bodyStr)

  const req = mockReq({
    headers: {
      'x-twilio-email-event-webhook-signature': sig,
      'x-twilio-email-event-webhook-timestamp': ts,
    },
    body: JSON.parse(bodyStr) as unknown,
    rawBody: Buffer.from(bodyStr),
  })

  const { res, c } = mockRes()
  const nextCalled = runMiddleware(req, res)

  assert(nextCalled, 'next() was called on valid signature')
  assert(c.statusCode === 200, 'no error status sent')
}

// ── Test 2: Invalid signature → 401 ─────────────────────────────────────────
{
  console.log('\nTest 2: Invalid signature → 401')
  process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = publicKey as string

  const bodyStr = JSON.stringify([{ event: 'delivered' }])
  const ts = nowSec()

  const req = mockReq({
    headers: {
      'x-twilio-email-event-webhook-signature': 'bm90YXZhbGlkc2lnbmF0dXJl', // garbage base64
      'x-twilio-email-event-webhook-timestamp': ts,
    },
    body: JSON.parse(bodyStr) as unknown,
    rawBody: Buffer.from(bodyStr),
  })

  const { res, c } = mockRes()
  const nextCalled = runMiddleware(req, res)

  assert(!nextCalled, 'next() NOT called on invalid signature')
  assert(c.statusCode === 401, '401 returned for invalid signature')
  assert((c.body as { error: string })?.error === 'Invalid SendGrid signature', 'correct error message')
}

// ── Test 3: Expired timestamp → 401 ─────────────────────────────────────────
{
  console.log('\nTest 3: Expired timestamp → 401')
  process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = publicKey as string

  const bodyStr = JSON.stringify([{ event: 'delivered' }])
  const expiredTs = String(Math.floor(Date.now() / 1000) - 1200) // 20 min in the past
  const sig = sign(expiredTs, bodyStr)

  const req = mockReq({
    headers: {
      'x-twilio-email-event-webhook-signature': sig,
      'x-twilio-email-event-webhook-timestamp': expiredTs,
    },
    body: JSON.parse(bodyStr) as unknown,
    rawBody: Buffer.from(bodyStr),
  })

  const { res, c } = mockRes()
  const nextCalled = runMiddleware(req, res)

  assert(!nextCalled, 'next() NOT called on expired timestamp')
  assert(c.statusCode === 401, '401 returned for expired timestamp')
  assert((c.body as { error: string })?.error === 'Signature expired', 'correct error message')
}

// ── Test 4: Missing signature header → 401 ──────────────────────────────────
{
  console.log('\nTest 4: Missing signature header → 401')
  process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = publicKey as string

  const req = mockReq({
    headers: {
      'x-twilio-email-event-webhook-timestamp': nowSec(),
      // no signature
    },
  })

  const { res, c } = mockRes()
  const nextCalled = runMiddleware(req, res)

  assert(!nextCalled, 'next() NOT called when signature header missing')
  assert(c.statusCode === 401, '401 returned for missing signature header')
}

// ── Test 5: Missing timestamp header → 401 ──────────────────────────────────
{
  console.log('\nTest 5: Missing timestamp header → 401')
  process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = publicKey as string

  const req = mockReq({
    headers: {
      'x-twilio-email-event-webhook-signature': 'fakesig',
      // no timestamp
    },
  })

  const { res, c } = mockRes()
  const nextCalled = runMiddleware(req, res)

  assert(!nextCalled, 'next() NOT called when timestamp header missing')
  assert(c.statusCode === 401, '401 returned for missing timestamp header')
}

// ── Test 6: Missing env var → 500 (fail-closed) ──────────────────────────────
{
  console.log('\nTest 6: Missing SENDGRID_WEBHOOK_PUBLIC_KEY → 500')
  delete process.env.SENDGRID_WEBHOOK_PUBLIC_KEY

  const req = mockReq({
    headers: {
      'x-twilio-email-event-webhook-signature': 'fakesig',
      'x-twilio-email-event-webhook-timestamp': nowSec(),
    },
  })

  const { res, c } = mockRes()
  const nextCalled = runMiddleware(req, res)

  assert(!nextCalled, 'next() NOT called when env var unset')
  assert(c.statusCode === 500, '500 returned (fail-closed) when env var missing')
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`)
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
console.log(`─────────────────────────────────────\n`)

if (failed > 0) {
  process.exit(1)
}
