// ---------------------------------------------------------------------------
// Super Tool: INTROSPECT
// Deep column analysis — wraps the introspect engine for standalone use.
// Unlike EXTRACT (which is part of a wire), this is for ad-hoc analysis.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
  ColumnMapping,
  FieldProfile,
  AtlasFormat,
} from '../types'
import {
  hashHeaderFingerprint,
  profileCsvColumns,
  profileCollection,
  matchProfiles,
  matchFingerprint,
} from '../introspect'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_INTROSPECT',
  name: 'Introspect & Profile',
  description:
    'Deep column-level analysis of incoming data. Profiles all fields, detects types, computes null rates, matches against known formats and collection schemas. Used for format library building and data quality assessment.',
  tools: ['introspect'],
}

export interface IntrospectInput {
  headers: string[]
  rows: Record<string, unknown>[]
  /** Known formats to match against */
  formats?: AtlasFormat[]
  /** Existing collection docs to profile for matching */
  collection_docs?: Record<string, unknown>[]
}

export interface IntrospectOutput {
  fingerprint: string
  format_match: { format: AtlasFormat; confidence: number } | null
  csv_profiles: Record<string, FieldProfile>
  collection_profiles: Record<string, FieldProfile> | null
  column_mappings: ColumnMapping[]
  summary: {
    total_columns: number
    auto_mapped: number
    suggested: number
    unmapped: number
    avg_confidence: number
  }
}

/**
 * Execute the Introspect super tool.
 * Pure function — full column profiling and matching.
 */
export async function execute(
  input: IntrospectInput,
  _context: SuperToolContext
): Promise<SuperToolResult<IntrospectOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { headers, rows, formats = [], collection_docs } = input

    if (!headers || headers.length === 0) {
      return { success: false, error: 'Headers array is required' }
    }

    // Step 1: Fingerprint
    const fingerprint = hashHeaderFingerprint(headers)
    toolResults['hash-fingerprint'] = { success: true, data: { fingerprint } }

    // Step 2: Format library match
    const formatMatch = matchFingerprint(fingerprint, headers, formats)
    toolResults['match-fingerprint'] = {
      success: true,
      data: { matched: !!formatMatch, confidence: formatMatch?.confidence || 0 },
    }

    // Step 3: Profile CSV columns
    const csvProfiles = profileCsvColumns(headers, rows)
    toolResults['profile-csv'] = {
      success: true,
      data: { columns: Object.keys(csvProfiles).length },
    }

    // Step 4: Profile collection (if provided)
    let collectionProfiles: Record<string, FieldProfile> | null = null
    if (collection_docs && collection_docs.length > 0) {
      collectionProfiles = profileCollection(collection_docs)
      toolResults['profile-collection'] = {
        success: true,
        data: { fields: Object.keys(collectionProfiles).length },
      }
    }

    // Step 5: Match profiles
    let columnMappings: ColumnMapping[] = []
    if (collectionProfiles) {
      const carrierMaps = formats.map((f) => f.column_map)
      columnMappings = matchProfiles(csvProfiles, collectionProfiles, carrierMaps)
    } else if (formatMatch) {
      columnMappings = Object.entries(formatMatch.format.column_map).map(
        ([csvHeader, firestoreField]) => ({
          csv_header: csvHeader,
          firestore_field: firestoreField,
          confidence: formatMatch.confidence,
          status: (formatMatch.confidence >= 90 ? 'auto' : 'suggested') as 'auto' | 'suggested',
          alternatives: [],
        })
      )
    } else {
      columnMappings = headers.map((h) => ({
        csv_header: h,
        firestore_field: '',
        confidence: 0,
        status: 'unmapped' as const,
        alternatives: [],
      }))
    }

    // Compute summary
    const autoMapped = columnMappings.filter((m) => m.status === 'auto').length
    const suggested = columnMappings.filter((m) => m.status === 'suggested').length
    const unmapped = columnMappings.filter((m) => m.status === 'unmapped').length
    const totalConfidence = columnMappings.reduce((sum, m) => sum + m.confidence, 0)
    const avgConfidence = columnMappings.length > 0
      ? Math.round(totalConfidence / columnMappings.length)
      : 0

    return {
      success: true,
      data: {
        fingerprint,
        format_match: formatMatch,
        csv_profiles: csvProfiles,
        collection_profiles: collectionProfiles,
        column_mappings: columnMappings,
        summary: {
          total_columns: headers.length,
          auto_mapped: autoMapped,
          suggested,
          unmapped,
          avg_confidence: avgConfidence,
        },
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
      error: `Introspect failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}
