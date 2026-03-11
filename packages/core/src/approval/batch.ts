// ---------------------------------------------------------------------------
// Stage 2: BATCH — Group flattened items into approval batches
// ---------------------------------------------------------------------------

import type {
  ApprovalBatch,
  ApprovalItem,
  ApprovalStatus,
  BatchSummary,
  ExtractedData,
  ExtractionContext,
} from './types'
import { flattenExtractedData, generateFieldLabel } from './flatten'

/**
 * Create an approval batch from extracted data.
 * Pure function — generates the batch object but does NOT write to Firestore.
 * The API route handles persistence.
 *
 * Ported from IMPORT_Approval.gs createApprovalBatch_()
 */
export function createBatch(
  data: ExtractedData,
  context: ExtractionContext,
  batchId: string
): ApprovalBatch {
  const now = new Date().toISOString()

  // Flatten extracted data into field-level items
  const flatItems = flattenExtractedData(data, context)

  // Build full ApprovalItems with IDs and default status
  const items: ApprovalItem[] = flatItems.map((item, index) => ({
    ...item,
    approval_id: `${batchId}-${String(index).padStart(4, '0')}`,
    batch_id: batchId,
    status: 'PENDING' as ApprovalStatus,
    current_value: '',
    entity_id: context.entity_id || '',
    decided_by: '',
    decided_at: '',
    slack_message_ts: '',
    slack_channel: '',
    created_at: now,
    error_message: '',
  }))

  // Build summary
  const summary = buildSummary(items, context.entity_name || '')

  return {
    batch_id: batchId,
    source_type: context.source_type,
    source_id: context.source_id,
    queue_id: context.queue_id,
    specialist: context.specialist,
    entity_name: context.entity_name || deriveEntityName(data),
    status: 'PENDING',
    items,
    summary,
    assigned_to: '',
    slack_message_ts: '',
    slack_channel: '',
    created_at: now,
    updated_at: now,
    executed_at: '',
    execution_results: [],
  }
}

/**
 * Build batch summary statistics.
 */
export function buildSummary(items: ApprovalItem[], entityName: string): BatchSummary {
  const by_matrix: Record<string, number> = {}
  const by_tab: Record<string, number> = {}
  const by_status: Record<ApprovalStatus, number> = {
    PENDING: 0, APPROVED: 0, EDITED: 0, KILLED: 0, EXECUTED: 0, ERROR: 0,
  }

  for (const item of items) {
    by_matrix[item.target_matrix] = (by_matrix[item.target_matrix] || 0) + 1
    by_tab[item.target_tab] = (by_tab[item.target_tab] || 0) + 1
    by_status[item.status]++
  }

  return {
    total: items.length,
    by_matrix,
    by_tab,
    by_status,
    entity_name: entityName,
  }
}

/**
 * Validate a batch is ready for creation.
 * Returns null if valid, error string if not.
 */
export function validateBatch(data: ExtractedData, context: ExtractionContext): string | null {
  if (!context.source_type) return 'Missing source_type'
  if (!context.source_id) return 'Missing source_id'

  // Must have at least one entity to flatten
  const hasClient = data.client && Object.keys(data.client).length > 0
  const hasAccounts = data.accounts && Object.values(data.accounts).some(
    (arr) => Array.isArray(arr) && arr.length > 0
  )
  const hasProducer = data.producer && Object.keys(data.producer).length > 0
  const hasRevenue = data.revenue && data.revenue.length > 0

  if (!hasClient && !hasAccounts && !hasProducer && !hasRevenue) {
    return 'No data to approve — extracted data is empty'
  }

  return null
}

/**
 * Derive entity name from extracted data (first client name found).
 */
function deriveEntityName(data: ExtractedData): string {
  if (data.client) {
    const first = String(data.client.first_name || '').trim()
    const last = String(data.client.last_name || '').trim()
    if (first || last) return [first, last].filter(Boolean).join(' ')
  }
  return ''
}

/**
 * Update a single item's status within a batch.
 * Returns the updated item. Pure function.
 *
 * Ported from IMPORT_Approval.gs updateApprovalItem_()
 */
export function updateItemStatus(
  item: ApprovalItem,
  newStatus: 'APPROVED' | 'EDITED' | 'KILLED',
  decidedBy: string,
  editedValue?: string,
  newField?: string
): ApprovalItem {
  const updated: ApprovalItem = {
    ...item,
    status: newStatus,
    decided_by: decidedBy,
    decided_at: new Date().toISOString(),
  }

  if (newStatus === 'EDITED' && editedValue !== undefined) {
    updated.proposed_value = editedValue
  }

  if (newField) {
    updated.target_field = newField
    updated.display_label = generateFieldLabel(newField)
  }

  return updated
}

/**
 * Bulk update all PENDING items in a batch.
 * Returns updated items array.
 */
export function bulkUpdateItems(
  items: ApprovalItem[],
  newStatus: 'APPROVED' | 'KILLED',
  decidedBy: string,
  excludeIds: Set<string> = new Set()
): ApprovalItem[] {
  return items.map((item) => {
    if (item.status !== 'PENDING') return item
    if (excludeIds.has(item.approval_id)) return item
    return {
      ...item,
      status: newStatus,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    }
  })
}
