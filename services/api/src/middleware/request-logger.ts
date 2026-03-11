import { type Request, type Response, type NextFunction } from 'express'

/**
 * Request logger middleware.
 * Logs: method, path, user email, response time, status code.
 * NEVER logs PHI (no body content, no query params with PII).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  const method = req.method
  const path = req.path
  const email = (req as any).user?.email || '-'

  // Capture response finish
  res.on('finish', () => {
    const elapsed = Date.now() - start
    const status = res.statusCode
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'

    // Structured log line — no PHI, no body content
    console.log(
      JSON.stringify({
        level,
        method,
        path,
        status,
        user: email,
        ms: elapsed,
        ts: new Date().toISOString(),
      })
    )
  })

  next()
}
