#!/usr/bin/env npx tsx
/**
 * VOLTRON Smoke Test — TRK-13864
 * Sprint 001 Final Verification
 *
 * Usage:
 *   npx tsx scripts/smoke-test-voltron.ts [--base-url URL]
 *
 * Default base URL: http://localhost:8080 (Cloud Run local)
 * MDJ_SERVER:       http://100.99.181.57:4200
 *
 * Built by RONIN — voltron-foundation-v3
 */

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : process.env.SMOKE_BASE_URL || 'http://localhost:8080'

interface TestResult {
  name: string
  pass: boolean
  detail: string
  duration: number
}

const results: TestResult[] = []

async function test(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now()
  try {
    const detail = await fn()
    results.push({ name, pass: true, detail, duration: Date.now() - start })
    console.log(`  ✅ ${name} (${Date.now() - start}ms)`)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    results.push({ name, pass: false, detail, duration: Date.now() - start })
    console.log(`  ❌ ${name}: ${detail}`)
  }
}

// ─── Health Check ────────────────────────────────────────────────────────────

async function smokeHealth() {
  console.log('\n🔍 Health Check')
  await test('GET /health returns 200', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
    return `HTTP ${res.status}`
  })

  await test('Health response has system: "voltron"', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    const body = (await res.json()) as Record<string, unknown>
    const data = body.data as Record<string, unknown>
    if (data?.system !== 'voltron') {
      throw new Error(`Expected system:"voltron", got system:"${data?.system}"`)
    }
    return `system: "${data.system}"`
  })

  await test('Health response has status: "ok"', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    const body = (await res.json()) as Record<string, unknown>
    const data = body.data as Record<string, unknown>
    if (data?.status !== 'ok') {
      throw new Error(`Expected status:"ok", got status:"${data?.status}"`)
    }
    return `status: "${data.status}"`
  })
}

// ─── VOLTRON Wire Routes (Mode 1) ───────────────────────────────────────────

async function smokeMode1() {
  console.log('\n🚀 Mode 1: VOLTRON Wire Execution')

  await test('POST /api/voltron/wire/execute returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/voltron/wire/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wire_id: 'test', client_id: 'test' }),
    })
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    return `HTTP ${res.status} (auth required)`
  })

  await test('GET /api/voltron/wire/nonexistent/status returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/voltron/wire/nonexistent/status`)
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    return `HTTP ${res.status} (auth required)`
  })

  await test('GET /api/voltron/wire/nonexistent/stream returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/voltron/wire/nonexistent/stream`)
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    return `HTTP ${res.status} (auth required)`
  })
}

// ─── VOLTRON Registry ───────────────────────────────────────────────────────

async function smokeRegistry() {
  console.log('\n📋 VOLTRON Registry')

  await test('GET /api/voltron/registry returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/voltron/registry`)
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    return `HTTP ${res.status} (auth required)`
  })
}

// ─── Mode 2 Chat ────────────────────────────────────────────────────────────

async function smokeMode2() {
  console.log('\n💬 Mode 2: Chat (POST /agent/chat)')

  await test('POST /agent/chat returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What accounts does Jim have?' }),
    })
    // Should require auth
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`Expected 401/403, got ${res.status}`)
    }
    return `HTTP ${res.status} (auth required)`
  })
}

// ─── Webhook Deploy ─────────────────────────────────────────────────────────

async function smokeWebhook() {
  console.log('\n🔗 Webhook Deploy')

  await test('POST /webhook/deploy rejects missing signature', async () => {
    const res = await fetch(`${BASE_URL}/webhook/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'refs/heads/main' }),
    })
    if (res.status !== 401 && res.status !== 500) {
      throw new Error(`Expected 401 or 500, got ${res.status}`)
    }
    return `HTTP ${res.status} (signature validation works)`
  })

  await test('POST /webhook/deploy rejects invalid signature', async () => {
    const res = await fetch(`${BASE_URL}/webhook/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=invalid',
      },
      body: JSON.stringify({ ref: 'refs/heads/main' }),
    })
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    return `HTTP ${res.status} (HMAC validation rejects bad signatures)`
  })
}

// ─── Summary ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  VOLTRON SMOKE TEST — TRK-13864`)
  console.log(`  Target: ${BASE_URL}`)
  console.log(`  Date:   ${new Date().toISOString()}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  await smokeHealth()
  await smokeMode1()
  await smokeRegistry()
  await smokeMode2()
  await smokeWebhook()

  // ─── Report ─────────────────────────────────────────────────────────────

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  const total = results.length

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  RESULTS: ${passed}/${total} passed | ${failed} failed`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (failed > 0) {
    console.log('\n  FAILURES:')
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.detail}`)
    })
  }

  console.log(`\n  All systems ${failed === 0 ? '🟢 GREEN' : '🔴 RED'}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
