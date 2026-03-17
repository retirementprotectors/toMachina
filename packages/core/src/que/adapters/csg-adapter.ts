/**
 * CSG Medicare Adapter
 *
 * Defines the interface for CSG Actuarial Medicare quoting.
 * The actual HTTP calls live in the API route (services/api/src/routes/medicare-quote.ts) —
 * core has no HTTP. This adapter validates parameters and defines response mapping.
 *
 * To execute quotes: POST /api/que/sessions/:id/quote with source_id=QSRC_CSG
 */

import type { QueAdapterType } from '../types'
import type { QueAdapter, QueAdapterResult } from './base-adapter'

const REQUIRED_FIELDS = ['zip', 'dob', 'gender', 'plan_letter', 'effective_date'] as const

export class CsgMedicareAdapter implements QueAdapter {
  source_id = 'QSRC_CSG'
  adapter_type: QueAdapterType = 'api'

  /**
   * Validate that all required Medicare quoting fields are present.
   * Returns null if valid, or an error message listing missing fields.
   */
  validate(params: Record<string, unknown>): string | null {
    const missing: string[] = []

    for (const field of REQUIRED_FIELDS) {
      const value = params[field]
      if (value === undefined || value === null || value === '') {
        missing.push(field)
      }
    }

    if (missing.length > 0) {
      return `Missing required fields: ${missing.join(', ')}`
    }

    return null
  }

  /**
   * CSG quotes require API-level execution (HTTP calls to CSG Actuarial API).
   * This adapter cannot execute quotes directly — core has no HTTP.
   * Use the API route instead.
   */
  async quote(_params: Record<string, unknown>): Promise<QueAdapterResult> {
    return {
      success: false,
      quotes: [],
      error:
        'CSG adapter requires API-level execution. Use POST /api/que/sessions/:id/quote with source_id=QSRC_CSG',
    }
  }
}
