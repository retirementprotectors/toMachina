// ---------------------------------------------------------------------------
// Super Tool: WRITE
// Prepares records for write — applies final transforms, builds write batch.
// NOTE: Actual Firestore writes happen in services/api or services/bridge.
// This tool prepares the write payload — it does NOT write directly.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
} from '../types'
import { execute as routeToCollection } from '../tools/route-to-collection'
import type { MatchTag } from './match'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_WRITE',
  name: 'Prepare Write Batch',
  description:
    'Prepare records for Firestore write. Routes to correct collection, generates write operations (create/update/skip), adds timestamps and audit fields. Does NOT write — returns a batch payload for the API layer.',
  tools: ['route-to-collection'],
}

export type WriteOperation = 'CREATE' | 'UPDATE' | 'SKIP' | 'DELETE'

export interface WriteRecord {
  operation: WriteOperation
  collection: string
  subcollection?: string
  document_id?: string
  data: Record<string, unknown>
  reason: string
}

export interface WriteInput {
  records: Array<{
    record: Record<string, unknown>
    tag: MatchTag
    existing_id?: string
  }>
}

export interface WriteOutput {
  batch: WriteRecord[]
  summary: {
    creates: number
    updates: number
    skips: number
    deletes: number
  }
}

/**
 * Execute the Write super tool.
 * Pure function — prepares write batch without touching Firestore.
 */
export async function execute(
  input: WriteInput,
  context: SuperToolContext
): Promise<SuperToolResult<WriteOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { records } = input

    if (!records || !Array.isArray(records)) {
      return { success: false, error: 'Input records must be an array' }
    }

    // Determine target collection
    const routeResult = routeToCollection({
      category: context.target_category as string | undefined,
      collection_override: context.target_collection,
    })
    toolResults['route-to-collection'] = routeResult

    const collection = routeResult.data?.collection || 'clients'
    const subcollection = routeResult.data?.subcollection

    const now = new Date().toISOString()
    const batch: WriteRecord[] = []

    for (const { record, tag, existing_id } of records) {
      switch (tag) {
        case 'NEW_INSERT': {
          batch.push({
            operation: 'CREATE',
            collection,
            subcollection,
            data: {
              ...record,
              created_at: now,
              updated_at: now,
              import_source: context.triggered_by || 'atlas-wire',
            },
            reason: 'New record — no match found',
          })
          break
        }

        case 'EXISTING_MATCH': {
          // Fill-blank merge — never overwrite existing data
          batch.push({
            operation: 'UPDATE',
            collection,
            subcollection,
            document_id: existing_id,
            data: {
              ...record,
              updated_at: now,
              last_import_source: context.triggered_by || 'atlas-wire',
            },
            reason: `Matched existing record ${existing_id}`,
          })
          break
        }

        case 'SPOUSE_PROSPECT': {
          // Create as new record with spouse flag
          batch.push({
            operation: 'CREATE',
            collection,
            subcollection,
            data: {
              ...record,
              client_classification: 'Prospect',
              relationship_type: 'spouse',
              related_client_id: existing_id,
              created_at: now,
              updated_at: now,
              import_source: context.triggered_by || 'atlas-wire',
            },
            reason: `Spouse prospect — related to ${existing_id}`,
          })
          break
        }

        case 'DUPLICATE': {
          batch.push({
            operation: 'SKIP',
            collection,
            data: record,
            reason: 'Duplicate detected within import batch',
          })
          break
        }

        case 'REVIEW_NEEDED': {
          batch.push({
            operation: 'SKIP',
            collection,
            data: record,
            reason: 'Requires manual review — partial match found',
          })
          break
        }

        default: {
          batch.push({
            operation: 'SKIP',
            collection,
            data: record,
            reason: `Unknown tag: ${tag}`,
          })
        }
      }
    }

    const summary = {
      creates: batch.filter((b) => b.operation === 'CREATE').length,
      updates: batch.filter((b) => b.operation === 'UPDATE').length,
      skips: batch.filter((b) => b.operation === 'SKIP').length,
      deletes: batch.filter((b) => b.operation === 'DELETE').length,
    }

    return {
      success: true,
      data: { batch, summary },
      tool_results: toolResults,
      stats: {
        records_in: records.length,
        records_out: summary.creates + summary.updates,
        filtered: summary.skips + summary.deletes,
        errors: 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Write preparation failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}
