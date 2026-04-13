// ---------------------------------------------------------------------------
// Atomic Tool: label-document
// Extracted from: watcher.js taxonomy lookup + resolveFileLabel() + logTaxonomyMiss()
// Matches document types against taxonomy and resolves file labels
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition } from '../types'

export const definition: AtomicToolDefinition = {
  tool_id: 'label-document',
  name: 'Document Labeler',
  description:
    'Match a document type against the taxonomy, resolve file label templates with extracted data, and determine ACF subfolder routing.',
  category: 'DOCUMENT_PROCESSING',
}

// --- Types ---

export interface TaxonomyEntry {
  document_type: string
  pipeline?: string
  owner_role?: string
  acf_subfolder?: string
  file_label_template?: string
  priority?: string
  pipeline_id?: string
}

export interface LabelDocumentInput {
  document_type: string
  extracted_data: Record<string, unknown>
  taxonomy_types: TaxonomyEntry[]
  /** Optional Firestore write function for taxonomy misses — pass null if not available */
  log_taxonomy_miss?: (docType: string) => Promise<void>
}

export interface LabelDocumentOutput {
  label: string | null
  acf_subfolder: string
  pipeline_id: string | null
  priority: string
  matched: boolean
  matched_type: string | null
  owner_role: string | null
  pipeline: string | null
}

// --- Helpers ---

function resolveFileLabel(
  template: string,
  data: Record<string, unknown>
): string {
  let resolved = template

  // Standard substitutions from extracted data
  const subs: Record<string, string> = {
    '{policy_number}': String(data.policy_number || data.account_number || ''),
    '{account_number}': String(data.account_number || data.policy_number || ''),
    '{last_name}': String(data.last_name || '').toUpperCase(),
    '{first_name}': String(data.first_name || ''),
    '{carrier}': String(data.carrier || ''),
    '{document_type}': String(data.document_type || ''),
    '{date}': String(data.document_date || data.as_of_date || new Date().toISOString().slice(0, 10)),
    '{document_date}': String(data.document_date || new Date().toISOString().slice(0, 10)),
  }

  for (const [token, value] of Object.entries(subs)) {
    resolved = resolved.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value)
  }

  // Clean up empty tokens and extra spaces/dashes
  resolved = resolved
    .replace(/\{[^}]+\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/- -/g, '-')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim()

  return resolved || null as unknown as string
}

// --- Execute ---

export function labelDocument(input: LabelDocumentInput): LabelDocumentOutput {
  const { document_type, extracted_data, taxonomy_types } = input

  // Default output for unmatched
  const defaultOutput: LabelDocumentOutput = {
    label: null,
    acf_subfolder: 'Source Documents',
    pipeline_id: null,
    priority: 'normal',
    matched: false,
    matched_type: null,
    owner_role: null,
    pipeline: null,
  }

  if (!document_type || !taxonomy_types || taxonomy_types.length === 0) {
    return defaultOutput
  }

  // Case-insensitive match against taxonomy
  const normalizedType = document_type.toLowerCase().trim()
  const match = taxonomy_types.find(
    (t) => t.document_type.toLowerCase().trim() === normalizedType
  )

  if (!match) {
    // Log taxonomy miss (fire-and-forget if logger available)
    if (input.log_taxonomy_miss) {
      input.log_taxonomy_miss(document_type).catch(() => {})
    }

    return {
      ...defaultOutput,
      label: document_type, // Use raw type as label fallback
    }
  }

  // Resolve file label from template
  let label: string | null = null
  if (match.file_label_template) {
    label = resolveFileLabel(match.file_label_template, {
      ...extracted_data,
      document_type: match.document_type,
    })
  } else {
    // Default label: "PolicyNum- LASTNAME Carrier DocType Date"
    const policyNum = String(extracted_data.policy_number || extracted_data.account_number || '')
    const lastName = String(extracted_data.last_name || '').toUpperCase()
    const carrier = String(extracted_data.carrier || '')
    const date = String(extracted_data.document_date || new Date().toISOString().slice(0, 10))
    label = [policyNum, lastName, carrier, match.document_type, date]
      .filter(Boolean)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  return {
    label,
    acf_subfolder: match.acf_subfolder || 'Source Documents',
    pipeline_id: match.pipeline_id || null,
    priority: match.priority || 'normal',
    matched: true,
    matched_type: match.document_type,
    owner_role: match.owner_role || null,
    pipeline: match.pipeline || null,
  }
}
