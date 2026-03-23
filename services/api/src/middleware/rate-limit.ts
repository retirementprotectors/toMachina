import { type Request, type Response, type NextFunction } from 'express'
import { getConfig } from '../lib/config-helper.js'

/**
 * In-memory rate limiter with configurable req/min per authenticated user.
 * Rate limit value is read from config_registry/rate_limits (fallback: 100).
 *
 * Uses a sliding window approximation (fixed window with reset).
 * For production at scale, swap to Redis-backed limiter — but for
 * the RPI team (~10 users), in-memory is correct and zero-latency.
 */

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()

const DEFAULT_MAX_REQUESTS = 100
const WINDOW_MS = 60 * 1000 // 1 minute

// Cleanup stale buckets every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) {
      buckets.delete(key)
    }
  }
}, 5 * 60 * 1000)

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    // Read configurable rate limit (cached 60s by getConfig)
    const config = await getConfig<{ requests_per_minute: number }>('rate_limits', { requests_per_minute: DEFAULT_MAX_REQUESTS })
    const maxRequests = typeof config.requests_per_minute === 'number' ? config.requests_per_minute : DEFAULT_MAX_REQUESTS

    // Key by authenticated user email, fallback to IP
    const user = (req as any).user?.email || req.ip || 'unknown'
    const now = Date.now()

    let bucket = buckets.get(user)

    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + WINDOW_MS }
      buckets.set(user, bucket)
    }

    bucket.count++

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - bucket.count))
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000))

    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Try again in ' + retryAfter + ' seconds.',
      })
      return
    }

    next()
  } catch {
    // On config read failure, allow through
    next()
  }
}
