// ---------------------------------------------------------------------------
// Atomic Tool: normalize-book-of-business
// BOB_ALIASES ported from RAPID_CORE CORE_Normalize.gs (lines 1187-1238)
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition, AtomicToolResult } from '../types'
import { BOB_ALIASES } from '../../normalizers/field-normalizers'

export const definition: AtomicToolDefinition = {
  tool_id: 'normalize-book-of-business',
  name: 'Normalize Book of Business',
  description:
    'Normalize book_of_business field using BOB_ALIASES map from RAPID_CORE. Strips agent name suffixes (slash patterns), maps known variations to canonical names.',
  used_by: ['SUPER_NORMALIZE'],
}

export interface NormalizeBoBInput {
  records: Record<string, unknown>[]
  /** Field name containing the book of business value. Defaults to "book_of_business". */
  field?: string
}

export interface NormalizeBoBOutput {
  records: Record<string, unknown>[]
  changes: Array<{ index: number; original: string; normalized: string }>
}

/**
 * Normalize book_of_business on all records.
 * Pure function — uses BOB_ALIASES from field-normalizers.ts.
 */
export function execute(
  input: NormalizeBoBInput
): AtomicToolResult<NormalizeBoBOutput> {
  const { records, field = 'book_of_business' } = input

  if (!records || !Array.isArray(records)) {
    return { success: false, error: 'Input records must be an array' }
  }

  const changes: NormalizeBoBOutput['changes'] = []
  const normalized = records.map((record, index) => {
    const raw = record[field]
    if (raw == null || String(raw).trim() === '') {
      return record
    }

    const original = String(raw)
    const result = normalizeBoB(original)

    if (result !== original) {
      changes.push({ index, original, normalized: result })
    }

    return { ...record, [field]: result }
  })

  return {
    success: true,
    data: { records: normalized, changes },
    processed: records.length,
    passed: records.length,
    failed: 0,
  }
}

// ---------------------------------------------------------------------------
// Normalizer (mirrors RAPID_CORE normalizeBoB exactly)
// ---------------------------------------------------------------------------

function normalizeBoB(raw: string): string {
  if (!raw) return ''

  const cleaned = String(raw)
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s*\/\s*.*$/, '') // Strip agent name suffix after slash
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const lower = cleaned.toLowerCase()
  if (BOB_ALIASES[lower]) return BOB_ALIASES[lower]

  // Title case fallback
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
