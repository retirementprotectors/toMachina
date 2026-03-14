/**
 * bridge-verify.ts
 *
 * Standalone verification script for the Bridge service.
 * Tests health, write operations (insert/update/delete), and batch writes.
 * Uses _bridge_test collection for test data — safe to run repeatedly.
 *
 * Run: npx tsx services/api/src/scripts/bridge-verify.ts
 */

const BRIDGE_URL = process.env.BRIDGE_URL || 'https://tm-bridge-365181509090.us-central1.run.app'
const TEST_COLLECTION = '_bridge_test'

// ============================================================================
// Test harness
// ============================================================================

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL'
  duration_ms: number
  detail: string
}

const results: TestResult[] = []

async function runTest(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now()
  try {
    const detail = await fn()
    results.push({ name, status: 'PASS', duration_ms: Date.now() - start, detail })
  } catch (err) {
    results.push({ name, status: 'FAIL', duration_ms: Date.now() - start, detail: String(err) })
  }
}

async function bridgeFetch(path: string, body?: Record<string, unknown>): Promise<Response> {
  const opts: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  return fetch(`${BRIDGE_URL}${path}`, opts)
}

// ============================================================================
// Tests
// ============================================================================

const testDocId = `bridge_test_${Date.now()}`

await runTest('Bridge /health responds', async () => {
  const resp = await bridgeFetch('/health')
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as Record<string, unknown>
  return `status=${resp.status}, body=${JSON.stringify(data)}`
})

await runTest('Bridge /write insert succeeds', async () => {
  const resp = await bridgeFetch('/write', {
    collection: TEST_COLLECTION,
    operation: 'insert',
    id: testDocId,
    data: { test_field: 'hello', created_at: new Date().toISOString() },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { success: boolean; error?: string }
  if (!data.success) throw new Error(`Bridge returned success=false: ${data.error}`)
  return `Inserted ${TEST_COLLECTION}/${testDocId}`
})

await runTest('Bridge /write update succeeds', async () => {
  const resp = await bridgeFetch('/write', {
    collection: TEST_COLLECTION,
    operation: 'update',
    id: testDocId,
    data: { test_field: 'updated', updated_at: new Date().toISOString() },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { success: boolean; error?: string }
  if (!data.success) throw new Error(`Bridge returned success=false: ${data.error}`)
  return `Updated ${TEST_COLLECTION}/${testDocId}`
})

await runTest('Bridge /write delete (soft) succeeds', async () => {
  const resp = await bridgeFetch('/write', {
    collection: TEST_COLLECTION,
    operation: 'delete',
    id: testDocId,
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { success: boolean; error?: string }
  if (!data.success) throw new Error(`Bridge returned success=false: ${data.error}`)
  return `Soft-deleted ${TEST_COLLECTION}/${testDocId}`
})

await runTest('Bridge /batch-write works', async () => {
  const batchId1 = `${testDocId}_batch_1`
  const batchId2 = `${testDocId}_batch_2`

  const resp = await bridgeFetch('/batch-write', {
    operations: [
      {
        collection: TEST_COLLECTION,
        operation: 'insert',
        id: batchId1,
        data: { batch_test: true, index: 1 },
      },
      {
        collection: TEST_COLLECTION,
        operation: 'insert',
        id: batchId2,
        data: { batch_test: true, index: 2 },
      },
    ],
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { success: boolean; error?: string; results?: unknown[] }
  if (!data.success) throw new Error(`Bridge returned success=false: ${data.error}`)
  return `Batch inserted 2 docs into ${TEST_COLLECTION}`
})

await runTest('Bridge /status/sheets returns configured platforms', async () => {
  const resp = await bridgeFetch('/status/sheets')
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { success: boolean; data?: Record<string, unknown> }
  if (!data.success) throw new Error(`Bridge returned success=false`)
  return `Sheets status: ${JSON.stringify(data.data)}`
})

// ============================================================================
// Results
// ============================================================================

console.log(`\n${'='.repeat(60)}`)
console.log(`Bridge Verification — ${BRIDGE_URL}`)
console.log(`${'='.repeat(60)}\n`)

for (const r of results) {
  const tag = r.status === 'PASS' ? ' PASS ' : ' FAIL '
  console.log(`[${tag}] ${r.name} (${r.duration_ms}ms)`)
  console.log(`         ${r.detail}\n`)
}

const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length

console.log(`${'='.repeat(60)}`)
console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} tests`)
console.log(`${'='.repeat(60)}`)

process.exit(failed > 0 ? 1 : 0)
