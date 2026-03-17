// ---------------------------------------------------------------------------
// Super Tool: VALIDATE
// Orchestrates: validate-record (qualification gate)
// Filters records that don't meet minimum data quality requirements.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
} from '../types'
import { execute as validateRecordExecute } from '../tools/validate-record'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_VALIDATE',
  name: 'Validate & Qualify',
  description:
    'Run qualification gate on all records. Must have (first_name + last_name + contact method) OR an account reference. Disqualified records are returned separately for audit.',
  tools: ['validate-record'],
}

export interface ValidateInput {
  records: Record<string, unknown>[]
}

export interface ValidateOutput {
  qualified: Record<string, unknown>[]
  disqualified: Array<{ record: Record<string, unknown>; reason: string }>
}

/**
 * Execute the Validate super tool.
 * Pure function — qualification gate only, no external dependencies.
 */
export async function execute(
  input: ValidateInput,
  _context: SuperToolContext
): Promise<SuperToolResult<ValidateOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { records } = input

    if (!records || !Array.isArray(records)) {
      return { success: false, error: 'Input records must be an array' }
    }

    // Run qualification gate
    const result = validateRecordExecute({ records })
    toolResults['validate-record'] = result

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Validation failed',
        tool_results: toolResults,
      }
    }

    const { qualified, disqualified } = result.data

    return {
      success: true,
      data: { qualified, disqualified },
      tool_results: toolResults,
      stats: {
        records_in: records.length,
        records_out: qualified.length,
        filtered: disqualified.length,
        errors: 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Validate failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}
