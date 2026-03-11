import { type Request, type Response, type NextFunction } from 'express'

/**
 * In-memory rate limiter: 100 req/min per authenticated user.
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

const MAX_REQUESTS = 100
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

export function rateLimit(req: Request, res: Response, next: NextFunction) {
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
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - bucket.count))
  res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000))

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    res.setHeader('Retry-After', retryAfter)
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Try again in ' + retryAfter + ' seconds.',
    })
    return
  }

  next()
}
