/**
 * API DTOs — Group 6: ACF / DEX / Document Index / Dropzone
 *
 * These types describe the `data` payload for each endpoint.
 * The `{ success, data, error, pagination }` envelope is in common.ts.
 *
 * Route files covered:
 *   services/api/src/routes/acf.ts
 *   services/api/src/routes/dex.ts
 *   services/api/src/routes/dex-pipeline.ts
 *   services/api/src/routes/document-index.ts
 *   services/api/src/routes/dropzone.ts
 */

import type {
  ACFConfig,
  ACFStatus,
  ACFCreateOutput,
  ACFRouteOutput,
  ACFAuditOutput,
  ACFRebuildOutput,
  ACFDriveFile,
  ACFSubfolderDetail,
} from '../acf/types'

import type {
  DexForm,
  DexFieldMapping,
  DexFieldUxConfig,
  DexKit,
  OptionPresetName,
} from '../dex/types'

import type {
  DocumentLinkConfig,
  DocumentTaxonomyEntry,
} from '../acf/document-linking'

// ============================================================================
// ACF — services/api/src/routes/acf.ts
// ============================================================================

/** GET /api/acf/config */
export type ACFConfigData = ACFConfig

/** PUT /api/acf/config */
export type ACFConfigUpdateData = ACFConfig

/** GET /api/acf/status/:clientId */
export type ACFStatusData = ACFStatus

/** POST /api/acf/audit */
export type ACFAuditData = ACFAuditOutput

/** POST /api/acf/rebuild */
export type ACFRebuildData = ACFRebuildOutput

/** GET /api/acf/:clientId — full ACF detail (subfolders + files) */
export interface ACFDetailData {
  exists: boolean
  folder_id?: string
  folder_url?: string
  subfolders: ACFSubfolderDetail[]
  root_files?: ACFDriveFile[]
  /** True when the Drive service account cannot verify the folder */
  drive_limited?: boolean
}

/** POST /api/acf/:clientId/create */
export type ACFCreateData = ACFCreateOutput

/** POST /api/acf/:clientId/route */
export type ACFRouteData = ACFRouteOutput

/** POST /api/acf/:clientId/upload */
export interface ACFUploadResult {
  file_id: string
  file_url: string
  file_name: string
  target_subfolder: string
  extraction_queued: boolean
}

/** GET /api/acf/file/:fileId/preview */
export interface ACFFilePreviewData {
  preview_url: string
  file_name: string
  mime_type: string
}

// Note: GET /api/acf/file/:fileId/download streams raw bytes (not JSON data payload)

/** POST /api/acf/:clientId/move */
export interface ACFFileMoveResult {
  moved: boolean
  file_id?: string
  from_subfolder?: string
  to_subfolder?: string
  /** Present when moved=false (e.g. "Same subfolder") */
  reason?: string
}

// ============================================================================
// DEX — services/api/src/routes/dex.ts
// ============================================================================

/** GET /api/dex/forms — paginated list */
export type DexFormListDTO = Array<DexForm & { id: string }>

/** GET /api/dex/forms/:id — form detail with field mappings */
export interface DexFormDetailData {
  form: DexForm & { id: string }
  mappings: Array<Record<string, unknown> & { id: string }>
  mapping_count: number
}

/** POST /api/dex/forms — created form ID */
export interface DexFormCreateResult {
  form_id: string
}

/** PATCH /api/dex/forms/:id — update confirmation */
export interface DexFormUpdateResult {
  form_id: string
  updated: true
}

/** GET /api/dex/mappings — field mapping list (optional UX enhancement) */
export type DexMappingListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/dex/mappings — when ?ux=true, each mapping includes _ux config */
export type DexMappingListWithUxDTO = Array<
  Record<string, unknown> & { id: string; _ux: DexFieldUxConfig }
>

/** POST /api/dex/mappings — created mapping ID */
export interface DexMappingCreateResult {
  mapping_id: string
}

/** GET /api/dex/mappings/presets — static option presets map */
export type DexPresetsData = Record<OptionPresetName, readonly string[]>

/** GET /api/dex/taxonomy/:type — taxonomy items (carriers, products, accountTypes, transactions) */
export type DexTaxonomyListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/dex/rules — rule list */
export type DexRuleListDTO = Array<Record<string, unknown> & { id: string }>

/** POST /api/dex/rules — created rule ID */
export interface DexRuleCreateResult {
  rule_id: string
}

/** POST /api/dex/packages (QUE output endpoint) */
export interface DexQueOutputData {
  message: string
  session_id: unknown
  output_types: string[]
  status: 'queued'
}

// ============================================================================
// DEX Kit Builder — services/api/src/routes/dex.ts (kits section)
// ============================================================================

/** Form layer item returned inside kit build layers */
export interface DexKitFormLayerItem {
  form_id: string
  form_name: string
  fields: Array<{
    pdf_field: string
    value: string
    source: string
  }>
}

/** POST /api/dex/kits/build — build a kit from rules */
export interface DexKitBuildData {
  kit_id: string
  client_id: string
  form_count: number
  layers: {
    firm_client: DexKitFormLayerItem[]
    firm_account: DexKitFormLayerItem[]
    product: DexKitFormLayerItem[]
    supporting: DexKitFormLayerItem[]
    disclosures: DexKitFormLayerItem[]
  }
  forms: DexKitFormLayerItem[]
}

/** GET /api/dex/kits — paginated kit list */
export type DexKitListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/dex/kits/:id — kit detail with forms */
export interface DexKitDetailData {
  kit: Record<string, unknown> & { id: string }
  forms: Array<Record<string, unknown>>
}

/** POST /api/dex/kits/:id/fill — fill kit fields with client data */
export interface DexKitFillData {
  kit_id: string
  filled_count: number
  missing_count: number
  filled_fields: Array<{
    form_id: string
    field_name: string
    pdf_field: string
    value: string
    source: string
  }>
  missing_fields: Array<{
    form_id: string
    field_name: string
    source: string
    required: boolean
  }>
  status: string
}

// ============================================================================
// DEX Pipeline — services/api/src/routes/dex-pipeline.ts
// ============================================================================

/** Pipeline event in the timeline */
export interface DexPackageEventDTO {
  id: string
  event_id: string
  package_id: string
  event_type: string
  from_status: string | null
  to_status: string
  source: string
  actor: string
  metadata: Record<string, unknown>
  timestamp: string
}

/** POST /api/dex-pipeline/packages — created package */
export interface DexPackageCreateData {
  package_id: string
  status: 'DRAFT'
  kit_id: string
  form_count: number
}

/** GET /api/dex-pipeline/packages/summary — counts by status */
export interface DexPackageSummaryData {
  DRAFT: number
  READY: number
  SENT: number
  VIEWED: number
  SIGNED: number
  SUBMITTED: number
  COMPLETE: number
  VOIDED: number
  DECLINED: number
  total: number
}

/** GET /api/dex-pipeline/packages — paginated package list */
export type DexPackageListDTO = Array<Record<string, unknown> & { id: string }>

/** GET /api/dex-pipeline/packages/:id — package detail with timeline */
export interface DexPackageDetailData {
  package: Record<string, unknown> & { id: string }
  timeline: DexPackageEventDTO[]
}

/** PATCH /api/dex-pipeline/packages/:id/status — status change result */
export interface DexPackageStatusResult {
  package_id: string
  old_status: string
  new_status: string
}

/** POST /api/dex-pipeline/packages/:id/generate-pdf — PDF generation result */
export interface DexPdfGenerateResult {
  package_id: string
  pdf_page_count: unknown
  filled_count: number
  missing_count: number
  form_results: unknown
}

/** POST /api/dex-pipeline/packages/:id/send-docusign — DocuSign send result */
export interface DexDocuSignSendResult {
  package_id: string
  envelope_id: unknown
  status: 'SENT'
  delivery_method: string
}

// ============================================================================
// Document Index — services/api/src/routes/document-index.ts
// ============================================================================

/** Linked document item (config + matched document) */
export interface DocumentLinkDTO {
  /** All fields from DocumentLinkConfig */
  [key: string]: unknown
  /** Best-match document for this link config, or null if none found */
  document: Record<string, unknown> | null
  /** Number of matching documents */
  count: number
}

/** GET /api/document-index/client/:clientId — linked documents for client detail */
export type DocumentClientLinksData = DocumentLinkDTO[]

/** GET /api/document-index/account/:accountId — linked documents for account detail */
export type DocumentAccountLinksData = DocumentLinkDTO[]

/** GET /api/document-index/config — all document link configs (admin) */
export type DocumentLinkConfigListDTO = Array<Record<string, unknown> & { id: string }>

/** POST /api/document-index/config — create/update a config */
export interface DocumentLinkConfigResult {
  id: string
  document_type: string
}

/** PUT /api/document-index/config/:configId — update a specific config */
export interface DocumentLinkConfigUpdateResult {
  id: string
  updated: true
}

/** DELETE /api/document-index/config/:configId — delete a config */
export interface DocumentLinkConfigDeleteResult {
  id: string
  deleted: true
}

/** POST /api/document-index/scan/:clientId — single client scan result */
export interface DocumentScanResult {
  indexed: number
  client_id?: string
  message?: string
}

/** POST /api/document-index/scan-all — bulk scan result */
export interface DocumentScanAllResult {
  mode: 'full' | 'incremental'
  since: string
  clients_scanned: number
  clients_skipped: number
  clients_failed: number
  total_indexed: number
  scanned_at: string
}

/** Duplicate file entry within an ACF */
export interface DocumentDuplicateFile {
  id: string
  subfolder: string
  size: number
  modified_at: string
}

/** Duplicate group (files sharing the same name) */
export interface DocumentDuplicateGroup {
  name: string
  count: number
  files: DocumentDuplicateFile[]
}

/** GET /api/document-index/dedup/:clientId — client duplicate scan */
export interface DocumentDedupData {
  duplicates: DocumentDuplicateGroup[]
  total_files: number
  duplicate_groups: number
}

/** Client entry in the dedup report */
export interface DocumentDedupReportEntry {
  client_id: string
  client_name: string
  duplicate_groups: number
  total_duplicates: number
}

/** GET /api/document-index/dedup-report — all-client dedup report */
export interface DocumentDedupReportData {
  clients_with_duplicates: number
  total_duplicate_groups: number
  report: DocumentDedupReportEntry[]
}

/** GET /api/document-index/taxonomy — document taxonomy entries */
export type DocumentTaxonomyListDTO = Array<Record<string, unknown> & { id: string }>

// ============================================================================
// Dropzone — services/api/src/routes/dropzone.ts
// ============================================================================

/** POST /api/dropzone — file upload + intake queue result */
export interface DropzoneUploadResult {
  queue_id: string
  file_id: string | null
  file_url?: string
}
