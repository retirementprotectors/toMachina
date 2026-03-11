import { type Request, type Response, type NextFunction } from 'express'

/**
 * Request validation middleware factory.
 *
 * Usage:
 *   router.post('/', validateWrite({ required: ['first_name', 'last_name'], types: { email: 'string' } }), handler)
 *
 * Only runs on POST, PATCH, PUT methods.
 * Returns 400 with structured error if validation fails.
 */

interface ValidationRule {
  /** Fields that must be present and non-empty on POST */
  required?: string[]
  /** Field type checks: { fieldName: 'string' | 'number' | 'boolean' | 'array' | 'object' } */
  types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>
  /** Fields that must NOT be in the request body (immutable fields) */
  immutable?: string[]
  /** Maximum body size in keys (prevent bloated payloads) */
  maxFields?: number
}

export function validateWrite(rules: ValidationRule) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only validate on write methods
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
      next()
      return
    }

    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({
        success: false,
        error: 'Request body must be a JSON object',
      })
      return
    }

    const errors: string[] = []

    // Required fields (only on POST — PATCH allows partial updates)
    if (rules.required && req.method === 'POST') {
      for (const field of rules.required) {
        if (body[field] == null || body[field] === '') {
          errors.push(`Missing required field: ${field}`)
        }
      }
    }

    // Type checks
    if (rules.types) {
      for (const [field, expectedType] of Object.entries(rules.types)) {
        const val = body[field]
        if (val == null) continue // Skip absent fields

        let valid = false
        switch (expectedType) {
          case 'string':
            valid = typeof val === 'string'
            break
          case 'number':
            valid = typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))
            break
          case 'boolean':
            valid = typeof val === 'boolean'
            break
          case 'array':
            valid = Array.isArray(val)
            break
          case 'object':
            valid = typeof val === 'object' && !Array.isArray(val)
            break
        }

        if (!valid) {
          errors.push(`Field "${field}" must be of type ${expectedType}`)
        }
      }
    }

    // Immutable fields (cannot be set via API)
    if (rules.immutable) {
      for (const field of rules.immutable) {
        if (body[field] !== undefined) {
          errors.push(`Field "${field}" is immutable and cannot be set`)
          delete body[field] // Remove it silently as well
        }
      }
    }

    // Max fields check
    if (rules.maxFields && Object.keys(body).length > rules.maxFields) {
      errors.push(`Request body exceeds maximum of ${rules.maxFields} fields`)
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      })
      return
    }

    next()
  }
}
