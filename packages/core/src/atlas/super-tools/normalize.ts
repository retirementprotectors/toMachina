// ---------------------------------------------------------------------------
// Super Tool: NORMALIZE
// Orchestrates ALL normalize tools: normalizeData (full field dispatch) +
// normalize-book-of-business + normalize-status
// Runs the comprehensive normalizer pipeline from packages/core/normalizers.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
} from '../types'
import { normalizeData } from '../../normalizers'
import { execute as normalizeBoBExecute } from '../tools/normalize-book-of-business'
import { execute as normalizeStatusExecute } from '../tools/normalize-status'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_NORMALIZE',
  name: 'Normalize All Fields',
  description:
    'Run all 16 normalizer types across 90+ fields. Calls normalizeData (name, phone, email, date, state, zip, amount, carrier, product, plan, imo, address, city) PLUS dedicated normalize-book-of-business and normalize-status atomic tools.',
  tools: ['normalize-fields', 'normalize-book-of-business', 'normalize-status'],
}

export interface NormalizeInput {
  records: Record<string, unknown>[]
}

export interface NormalizeOutput {
  records: Record<string, unknown>[]
  /** Total field-level changes made */
  total_changes: number
  /** Per-tool change counts */
  change_breakdown: {
    normalize_data: number
    normalize_bob: number
    normalize_status: number
  }
}

/**
 * Execute the Normalize super tool.
 * Pure function — applies all normalizers in sequence.
 */
export async function execute(
  input: NormalizeInput,
  _context: SuperToolContext
): Promise<SuperToolResult<NormalizeOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { records } = input

    if (!records || !Array.isArray(records)) {
      return { success: false, error: 'Input records must be an array' }
    }

    // Step 1: Run normalizeData on every record (all 16 normalizer types)
    let normalizeDataChanges = 0
    let current = records.map((record) => {
      const before = JSON.stringify(record)
      const normalized = normalizeData(record)
      const after = JSON.stringify(normalized)
      if (before !== after) normalizeDataChanges++
      return normalized
    })

    toolResults['normalize-fields'] = {
      success: true,
      processed: records.length,
      passed: records.length,
      failed: 0,
      data: { changes: normalizeDataChanges },
    }

    // Step 2: Run normalize-book-of-business
    const bobResult = normalizeBoBExecute({ records: current })
    toolResults['normalize-book-of-business'] = bobResult
    if (bobResult.success && bobResult.data) {
      current = bobResult.data.records
    }

    // Step 3: Run normalize-status
    const statusResult = normalizeStatusExecute({ records: current })
    toolResults['normalize-status'] = statusResult
    if (statusResult.success && statusResult.data) {
      current = statusResult.data.records
    }

    const bobChanges = bobResult.data?.changes.length || 0
    const statusChanges = statusResult.data?.changes.length || 0
    const totalChanges = normalizeDataChanges + bobChanges + statusChanges

    return {
      success: true,
      data: {
        records: current,
        total_changes: totalChanges,
        change_breakdown: {
          normalize_data: normalizeDataChanges,
          normalize_bob: bobChanges,
          normalize_status: statusChanges,
        },
      },
      tool_results: toolResults,
      stats: {
        records_in: records.length,
        records_out: current.length,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Normalize failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}
