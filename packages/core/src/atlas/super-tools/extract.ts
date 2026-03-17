// ---------------------------------------------------------------------------
// Super Tool: EXTRACT
// Orchestrates: introspect (fingerprint + profile) → route-to-collection
// First step in any wire — determines what the data IS and where it goes.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
  ColumnMapping,
  AtlasFormat,
} from '../types'
import {
  hashHeaderFingerprint,
  profileCsvColumns,
  matchFingerprint,
  matchProfiles,
  profileCollection,
} from '../introspect'
import { execute as routeToCollection } from '../tools/route-to-collection'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_EXTRACT',
  name: 'Extract & Identify',
  description:
    'Detect file format via header fingerprinting, profile columns, match against format library, determine target collection. Returns column mappings and routing info.',
  tools: ['introspect', 'route-to-collection'],
}

export interface ExtractInput {
  headers: string[]
  rows: Record<string, unknown>[]
  /** Known formats to match against */
  formats?: AtlasFormat[]
  /** Collection profiles to match columns against (from Firestore collection sample) */
  collection_profiles?: Record<string, unknown>[]
}

export interface ExtractOutput {
  fingerprint: string
  format_match: { format: AtlasFormat; confidence: number } | null
  column_mappings: ColumnMapping[]
  target_collection: string
  target_subcollection?: string
  target_category: string
  match_method: 'fingerprint_exact' | 'fingerprint_partial' | 'full_introspect'
}

/**
 * Execute the Extract super tool.
 * Pure function — no Firestore dependencies. Format library and collection
 * profiles must be passed in by the caller (API route or service layer).
 */
export async function execute(
  input: ExtractInput,
  context: SuperToolContext
): Promise<SuperToolResult<ExtractOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { headers, rows, formats = [], collection_profiles = [] } = input

    if (!headers || headers.length === 0) {
      return { success: false, error: 'Headers array is required and must not be empty' }
    }

    // Step 1: Hash headers into fingerprint
    const fingerprint = hashHeaderFingerprint(headers)

    // Step 2: Try fingerprint match against known formats
    const formatMatch = matchFingerprint(fingerprint, headers, formats)

    let columnMappings: ColumnMapping[] = []
    let matchMethod: ExtractOutput['match_method'] = 'full_introspect'
    let targetCategory = context.target_category || ''

    if (formatMatch && formatMatch.confidence === 100) {
      // Exact fingerprint match — use saved column map
      matchMethod = 'fingerprint_exact'
      targetCategory = targetCategory || formatMatch.format.default_category
      columnMappings = Object.entries(formatMatch.format.column_map).map(
        ([csvHeader, firestoreField]) => ({
          csv_header: csvHeader,
          firestore_field: firestoreField,
          confidence: 100,
          status: 'auto' as const,
          alternatives: [],
        })
      )

      toolResults['introspect-fingerprint'] = {
        success: true,
        data: { method: 'fingerprint_exact', confidence: 100 },
      }
    } else if (formatMatch && formatMatch.confidence > 80) {
      // Partial match — use as starting point but flag for review
      matchMethod = 'fingerprint_partial'
      targetCategory = targetCategory || formatMatch.format.default_category
      columnMappings = Object.entries(formatMatch.format.column_map).map(
        ([csvHeader, firestoreField]) => ({
          csv_header: csvHeader,
          firestore_field: firestoreField,
          confidence: formatMatch.confidence,
          status: 'suggested' as const,
          alternatives: [],
        })
      )

      toolResults['introspect-fingerprint'] = {
        success: true,
        data: { method: 'fingerprint_partial', confidence: formatMatch.confidence },
      }
    } else {
      // Full introspect — profile columns and match against collection
      matchMethod = 'full_introspect'
      const csvProfiles = profileCsvColumns(headers, rows)

      if (collection_profiles.length > 0) {
        const collProfiles = profileCollection(collection_profiles)
        const carrierMaps = formats.map((f) => f.column_map)
        columnMappings = matchProfiles(csvProfiles, collProfiles, carrierMaps)
      } else {
        // No collection profiles — create unmapped entries
        columnMappings = headers.map((h) => ({
          csv_header: h,
          firestore_field: '',
          confidence: 0,
          status: 'unmapped' as const,
          alternatives: [],
        }))
      }

      toolResults['introspect-profile'] = {
        success: true,
        data: {
          method: 'full_introspect',
          profiles_count: Object.keys(csvProfiles).length,
        },
      }
    }

    // Step 3: Route to collection
    const routeResult = routeToCollection({
      category: targetCategory,
      target_category: targetCategory,
      data_domain: context.target_collection,
    })

    toolResults['route-to-collection'] = routeResult

    const route = routeResult.data
    const targetCollection = route?.collection || 'clients'
    const targetSubcollection = route?.subcollection

    return {
      success: true,
      data: {
        fingerprint,
        format_match: formatMatch,
        column_mappings: columnMappings,
        target_collection: targetCollection,
        target_subcollection: targetSubcollection,
        target_category: targetCategory,
        match_method: matchMethod,
      },
      tool_results: toolResults,
      stats: {
        records_in: rows.length,
        records_out: rows.length,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Extract failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}
