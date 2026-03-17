// ---------------------------------------------------------------------------
// Atomic Tool: normalize-status
// Canonical status values using STATUS_MAP from field-normalizers
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition, AtomicToolResult } from '../types'
import { STATUS_MAP } from '../../normalizers/field-normalizers'

export const definition: AtomicToolDefinition = {
  tool_id: 'normalize-status',
  name: 'Normalize Status Fields',
  description:
    'Normalize status-type fields (status, client_status, account_status, policy_status, agent_status) to canonical values using STATUS_MAP.',
  used_by: ['SUPER_NORMALIZE'],
}

/** Fields that should be run through the status normalizer */
const STATUS_FIELDS = ['status', 'client_status', 'account_status', 'policy_status', 'agent_status'] as const

export interface NormalizeStatusInput {
  records: Record<string, unknown>[]
  /** Override which fields to normalize. Defaults to STATUS_FIELDS. */
  fields?: string[]
}

export interface NormalizeStatusOutput {
  records: Record<string, unknown>[]
  changes: Array<{ index: number; field: string; original: string; normalized: string }>
}

/**
 * Normalize status fields on all records.
 * Pure function — uses STATUS_MAP from field-normalizers.ts.
 */
export function execute(
  input: NormalizeStatusInput
): AtomicToolResult<NormalizeStatusOutput> {
  const { records, fields } = input
  const targetFields = fields || [...STATUS_FIELDS]

  if (!records || !Array.isArray(records)) {
    return { success: false, error: 'Input records must be an array' }
  }

  const changes: NormalizeStatusOutput['changes'] = []
  const normalized = records.map((record, index) => {
    const updated = { ...record }

    for (const field of targetFields) {
      const raw = record[field]
      if (raw == null || String(raw).trim() === '') continue

      const original = String(raw)
      const result = normalizeStatusValue(original)

      if (result !== original) {
        changes.push({ index, field, original, normalized: result })
        updated[field] = result
      }
    }

    return updated
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
// Normalizer (mirrors RAPID_CORE normalizeStatus exactly)
// ---------------------------------------------------------------------------

function normalizeStatusValue(raw: string): string {
  if (!raw) return ''

  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+eff\s+.*$/g, '')
    .replace(/\s+date\s+.*$/g, '')
    .replace(/\s*[-]\s*\d[\d\s]*$/g, '')
    .replace(/\s+\d{4,}$/g, '')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''
  if (STATUS_MAP[cleaned]) return STATUS_MAP[cleaned]

  // Title case fallback
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
