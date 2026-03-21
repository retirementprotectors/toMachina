/**
 * Document Linking Types — maps documents in ACF to ProDash UI locations
 */

/** Config rule for linking a document type to a UI location */
export interface DocumentLinkConfig {
  id: string
  document_type: string
  display_name: string
  target_ui: 'client_detail' | 'account_detail' | 'case_detail'
  acf_subfolder: string
  product_types: string[] // ['*'] for all, or ['Medicare', 'Retirement', etc.]
  file_patterns: string[] // glob-like patterns for matching filenames
  priority: number
  icon: string
}

/** Indexed document metadata for fast UI retrieval */
export interface DocumentIndexEntry {
  client_id: string
  file_id: string
  file_name: string
  document_type: string
  acf_subfolder: string
  drive_url: string
  mime_type: string
  size: number
  modified_at: string
  indexed_at: string
}

/** Document taxonomy entry (from Firestore, replaces RAPID_MATRIX sheet) */
export interface DocumentTaxonomyEntry {
  id: string
  source: string
  unit: string
  document_type: string
  short: string
  file_label: string
  pipeline: string
  owner_role: string
  acf_subfolder: string
  priority: string
  active: boolean
}
