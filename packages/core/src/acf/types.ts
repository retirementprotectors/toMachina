/**
 * ACF (Active Client File) — Type definitions
 * 5-pillar lifecycle: Config, Creation, Update Logic, Front-End Exposure, Audit + Rebuild
 */

/** Firestore acf_config document shape */
/** Rule for auto-routing documents to ACF subfolders */
export interface ACFRoutingRule {
  /** Document type label (e.g., "Statement", "Application", "Correspondence") */
  document_type: string
  /** Which subfolder to route to */
  target_subfolder: string
  /** File name patterns to match (case-insensitive, supports *) */
  patterns: string[]
}

export interface ACFConfig {
  template_folder_id: string
  ai3_template_id: string
  subfolders: string[]
  share_domain: string
  naming_pattern: string
  auto_create_on_import: boolean
  auto_route_correspondence: boolean
  default_subfolder: string
  /** Rules for auto-routing documents to subfolders by type/pattern */
  routing_rules?: ACFRoutingRule[]
}

/** Input for acf-create tool */
export interface ACFCreateInput {
  client_id: string
  client_name: string
  source_file_ids?: string[]
  household_id?: string
  config?: Partial<ACFConfig>
}

/** Output from acf-create tool */
export interface ACFCreateOutput {
  success: boolean
  folder_id: string
  folder_url: string
  subfolder_ids: Record<string, string>
  ai3_id?: string
  files_copied: number
  action: 'created_new' | 'linked_existing'
}

/** Input for acf-route tool */
export interface ACFRouteInput {
  client_id: string
  file_ids: string[]
  target_subfolder: string
  label?: string
}

/** Output from acf-route tool */
export interface ACFRouteOutput {
  success: boolean
  routed: number
  skipped: number
  acf_missing: boolean
}

/** Output from acf-status tool */
export interface ACFStatus {
  exists: boolean
  folder_id: string | null
  folder_url: string | null
  complete: boolean
  subfolder_count: number
  document_count: number
  ai3_present: boolean
  last_updated: string | null
}

/** Output from acf-audit tool */
export interface ACFAuditOutput {
  total_clients: number
  with_acf: number
  missing_acf: number
  broken_links: number
  incomplete_acf: number
  orphaned_acfs: number
  clients_missing_acf: string[]
  clients_broken: string[]
  clients_incomplete: string[]
}

/** Input for acf-rebuild tool */
export interface ACFRebuildInput {
  client_ids: string[]
  mode: 'create_missing' | 'fix_broken' | 'full_rebuild'
  dry_run: boolean
}

/** Output from acf-rebuild tool */
export interface ACFRebuildOutput {
  processed: number
  created: number
  fixed: number
  skipped: number
  errors: Array<{ client_id: string; error: string }>
}

/** Drive file metadata (subset returned by API) */
export interface ACFDriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size: number
}

/** Subfolder detail with file listing */
export interface ACFSubfolderDetail {
  id: string
  name: string
  file_count: number
  files: ACFDriveFile[]
  subfolders?: ACFSubfolderDetail[]
}

/** Full ACF detail response (GET /api/acf/:clientId) */
export interface ACFDetail {
  exists: boolean
  broken?: boolean
  folder_id?: string
  folder_url?: string | null
  subfolders: ACFSubfolderDetail[]
  root_files?: ACFDriveFile[]
}
