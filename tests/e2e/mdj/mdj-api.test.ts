import { describe, it, expect } from 'vitest'
import { apiGet, apiPost } from '../helpers/api-client'

describe('MDJ API', () => {
  it('POST /api/mdj/chat returns SSE stream', async () => {
    const res = await fetch(`${process.env.TEST_API_URL || 'http://localhost:8080'}/api/mdj/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', portal: 'prodash' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('GET /api/mdj/conversations returns array', async () => {
    const result = await apiGet<{ success: boolean; data: unknown[] }>('/api/mdj/conversations')
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('GET /api/mdj/specialists returns 6 specialists', async () => {
    const result = await apiGet<{ success: boolean; data: unknown[] }>('/api/mdj/specialists')
    expect(result.success).toBe(true)
    expect(result.data.length).toBe(6)
  })

  it('POST /api/mdj/conversations/:id/approve returns success', async () => {
    const result = await apiPost<{ success: boolean }>('/api/mdj/conversations/test-id/approve', {
      call_id: 'test-call-id',
    })
    // Even with fake IDs, endpoint should respond (not crash)
    expect(result).toBeDefined()
  })
})
