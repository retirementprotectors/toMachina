import { test, expect } from '@playwright/test'

/**
 * Smoke test: API health endpoint.
 *
 * Verifies that /api/health returns a valid response.
 * The API is proxied through each portal's Next.js rewrites,
 * so this test hits the portal's proxy which forwards to Cloud Run.
 *
 * In local dev, the API runs on port 8080 and portals proxy /api/* to it.
 */
test.describe('API — Health endpoint', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('/api/health')

    // Accept 200 (healthy) or 503 (degraded but responding)
    // A timeout or network error would throw before we get here
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('status')
    expect(body.data).toHaveProperty('service', 'tomachina-api')

    if (response.status() === 200) {
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('ok')
    }
  })

  test('health endpoint includes timestamp', async ({ request }) => {
    const response = await request.get('/api/health')
    const body = await response.json()

    expect(body.data).toHaveProperty('timestamp')

    // Timestamp should be a valid ISO string
    const ts = new Date(body.data.timestamp)
    expect(ts.getTime()).not.toBeNaN()
  })

  test('health endpoint responds within 10 seconds', async ({ request }) => {
    const start = Date.now()
    const response = await request.get('/api/health')
    const elapsed = Date.now() - start

    expect(response.status()).toBeLessThan(500)
    expect(elapsed).toBeLessThan(10_000)
  })
})
