// ---------------------------------------------------------------------------
// Stage 1: FLATTEN — Transform extracted data into field-level approval items
// ---------------------------------------------------------------------------

import type {
  ApprovalItem,
  ExtractedData,
  ExtractionContext,
  TargetTab,
} from './types'
import {
  SKIP_FIELDS,
  TAB_TO_ENDPOINT,
  TAB_TO_MATRIX,
  ACCOUNT_CATEGORY_TO_TAB,
  FIELD_ACRONYMS,
} from './types'

/**
 * Flatten extracted document data into field-level approval items.
 * Each item = one proposed field write. Pure function, no side effects.
 *
 * Ported from IMPORT_Approval.gs flattenExtractedData_()
 */
export function flattenExtractedData(
  data: ExtractedData,
  context: ExtractionContext
): Omit<ApprovalItem, 'approval_id' | 'batch_id' | 'status' | 'decided_by' | 'decided_at' | 'slack_message_ts' | 'slack_channel' | 'created_at' | 'error_message' | 'current_value' | 'entity_id'>[] {
  const items: Omit<ApprovalItem, 'approval_id' | 'batch_id' | 'status' | 'decided_by' | 'decided_at' | 'slack_message_ts' | 'slack_channel' | 'created_at' | 'error_message' | 'current_value' | 'entity_id'>[] = []

  // Flatten client fields
  if (data.client) {
    flattenEntity(
      data.client,
      '_CLIENT_MASTER',
      'CLIENT',
      context,
      items
    )
  }

  // Flatten accounts by category
  if (data.accounts) {
    for (const [category, accountList] of Object.entries(data.accounts)) {
      if (!Array.isArray(accountList)) continue
      const tab = ACCOUNT_CATEGORY_TO_TAB[category.toLowerCase()]
      if (!tab) continue

      for (let i = 0; i < accountList.length; i++) {
        const account = accountList[i]
        const label = category.toUpperCase() + (accountList.length > 1 ? ` #${i + 1}` : '')
        flattenEntity(account, tab, `ACCOUNT / ${label}`, context, items)
      }
    }
  }

  // Flatten producer
  if (data.producer) {
    flattenEntity(
      data.producer,
      '_PRODUCER_MASTER',
      'PRODUCER',
      context,
      items
    )
  }

  // Flatten revenue items
  if (data.revenue) {
    for (let i = 0; i < data.revenue.length; i++) {
      const rev = data.revenue[i]
      const label = 'REVENUE' + (data.revenue.length > 1 ? ` #${i + 1}` : '')
      flattenEntity(rev, '_REVENUE_MASTER', label, context, items)
    }
  }

  return items
}

/**
 * Flatten a single entity (client, account, producer, revenue) into field-level items.
 */
function flattenEntity(
  entity: Record<string, unknown>,
  targetTab: TargetTab,
  categoryPrefix: string,
  context: ExtractionContext,
  items: Omit<ApprovalItem, 'approval_id' | 'batch_id' | 'status' | 'decided_by' | 'decided_at' | 'slack_message_ts' | 'slack_channel' | 'created_at' | 'error_message' | 'current_value' | 'entity_id'>[]
): void {
  const endpoint = TAB_TO_ENDPOINT[targetTab]
  const matrix = TAB_TO_MATRIX[targetTab]

  if (!endpoint || !matrix) return

  for (const [field, rawValue] of Object.entries(entity)) {
    // Skip auto-generated and metadata fields
    if (SKIP_FIELDS.has(field)) continue

    // Skip null/undefined/empty
    if (rawValue == null || rawValue === '') continue

    const value = String(rawValue).trim()
    if (!value) continue

    const displayLabel = generateFieldLabel(field)
    const displayCategory = `${categoryPrefix} / ${displayLabel}`

    items.push({
      source_type: context.source_type,
      source_id: context.source_id,
      queue_id: context.queue_id,
      target_matrix: matrix,
      target_tab: targetTab,
      target_field: field,
      api_endpoint: endpoint,
      entity_name: context.entity_name || '',
      display_category: displayCategory,
      display_label: displayLabel,
      proposed_value: value,
      confidence: context.confidence ?? 0.9,
    })
  }
}

/**
 * Generate a human-readable label from a snake_case field name.
 * Handles acronyms (SSN, DOB, GHL, etc.) and prepositions.
 *
 * Example: primary_beneficiary_pct → "Primary Beneficiary PCT"
 */
export function generateFieldLabel(field: string): string {
  return field
    .split('_')
    .map((word) => {
      if (FIELD_ACRONYMS.has(word.toLowerCase())) {
        return word.toUpperCase()
      }
      if (['of', 'the', 'and', 'or', 'in', 'for', 'to', 'at'].includes(word.toLowerCase())) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}
