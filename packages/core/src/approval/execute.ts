// ---------------------------------------------------------------------------
// Stage 5: EXECUTE — Write approved fields to Firestore
// ---------------------------------------------------------------------------

import type {
  ApprovalItem,
  ApprovalBatch,
  ExecutionResult,
  BatchStatus,
  TrainingRecord,
} from './types'
import { TAB_TO_CANONICAL_CATEGORY } from './types'
import { groupItemsForExecution } from './routing'
import { buildSummary } from './batch'

/**
 * Build the write payload for a group of approved items.
 * Groups items by target_tab + entity_id and produces a single
 * field→value object for each group.
 *
 * Pure function — does NOT write to Firestore.
 * The API route calls this then performs the actual writes.
 */
export function buildExecutionPayload(
  items: ApprovalItem[]
): ExecutionGroup[] {
  // Filter to APPROVED + EDITED only
  const actionable = items.filter((i) => i.status === 'APPROVED' || i.status === 'EDITED')

  if (actionable.length === 0) return []

  const groups = groupItemsForExecution(actionable)
  const result: ExecutionGroup[] = []

  for (const [key, groupItems] of groups) {
    const [targetTab, entityId] = key.split('|')
    const fields: Record<string, string> = {}

    for (const item of groupItems) {
      fields[item.target_field] = item.proposed_value
    }

    // Inject account_category for account creates
    const canonicalCategory = TAB_TO_CANONICAL_CATEGORY[targetTab]
    if (canonicalCategory && !entityId) {
      fields['account_type_category'] = canonicalCategory
    }

    result.push({
      target_tab: targetTab,
      entity_id: entityId || '',
      is_create: !entityId,
      fields,
      items: groupItems,
    })
  }

  return result
}

/**
 * Mark items with execution results.
 * Returns updated items array.
 */
export function applyExecutionResults(
  items: ApprovalItem[],
  results: ExecutionResult[]
): ApprovalItem[] {
  const resultMap = new Map<string, ExecutionResult>()
  for (const r of results) {
    resultMap.set(r.approval_id, r)
  }

  return items.map((item) => {
    const result = resultMap.get(item.approval_id)
    if (!result) return item

    if (result.status === 'success') {
      return {
        ...item,
        status: 'EXECUTED' as const,
        entity_id: result.created_id || item.entity_id,
      }
    } else {
      return {
        ...item,
        status: 'ERROR' as const,
        error_message: result.error_message || 'Unknown error',
      }
    }
  })
}

/**
 * Determine final batch status based on item outcomes.
 */
export function determineBatchStatus(items: ApprovalItem[]): BatchStatus {
  const hasExecuted = items.some((i) => i.status === 'EXECUTED')
  const hasError = items.some((i) => i.status === 'ERROR')
  const hasPending = items.some((i) => i.status === 'PENDING')

  if (hasPending) return 'IN_REVIEW'
  if (hasError && hasExecuted) return 'PARTIAL'
  if (hasError && !hasExecuted) return 'ERROR'
  if (hasExecuted) return 'EXECUTED'
  return 'PENDING'
}

/**
 * Extract training records from EDITED items.
 * These capture user corrections for future extraction improvement.
 */
export function extractTrainingData(
  batch: ApprovalBatch,
  correctedBy: string
): TrainingRecord[] {
  const records: TrainingRecord[] = []
  const now = new Date().toISOString()

  for (const item of batch.items) {
    if (item.status !== 'EDITED') continue

    // Find the original value from execution results or the item itself
    // The item's proposed_value has been updated to the edited value
    // We need the original extraction value — stored in training metadata
    records.push({
      training_id: `tr-${item.approval_id}`,
      batch_id: batch.batch_id,
      approval_id: item.approval_id,
      target_tab: item.target_tab,
      target_field: item.target_field,
      original_value: '', // Set by caller who has the original
      corrected_value: item.proposed_value,
      confidence: item.confidence,
      source_type: batch.source_type,
      created_at: now,
      corrected_by: correctedBy,
    })
  }

  return records
}

/**
 * Finalize a batch after execution.
 * Returns the updated batch object.
 */
export function finalizeBatch(
  batch: ApprovalBatch,
  results: ExecutionResult[]
): ApprovalBatch {
  const updatedItems = applyExecutionResults(batch.items, results)
  const status = determineBatchStatus(updatedItems)
  const now = new Date().toISOString()

  return {
    ...batch,
    items: updatedItems,
    status,
    summary: buildSummary(updatedItems, batch.entity_name),
    execution_results: results,
    executed_at: now,
    updated_at: now,
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionGroup {
  target_tab: string
  entity_id: string
  is_create: boolean
  fields: Record<string, string>
  items: ApprovalItem[]
}
