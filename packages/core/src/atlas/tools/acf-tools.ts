// ---------------------------------------------------------------------------
// ATLAS Atomic Tools: ACF (Active Client File) operations
// Server-only — these tools interact with Google Drive and Firestore at runtime.
// Definitions are safe to export from barrel; execute functions are stubs.
// Backend services import directly from this file for full implementation.
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition, AtomicToolResult } from '../types'

// ─── Shared Constants ───────────────────────────────────────────────────────

export const ACF_REQUIRED_SUBFOLDERS = ['Client', 'NewBiz', 'Cases', 'Account', 'Reactive'] as const

export const DOCUMENT_TYPE_TO_SUBFOLDER: Record<string, string> = {
  // Client subfolder — identity & foundation
  id_document: 'Client',
  voided_check: 'Client',
  tax_document: 'Client',
  trust_document: 'Client',
  poa_hipaa: 'Client',
  fact_finder: 'Client',
  // NewBiz subfolder — acquisition
  application_form: 'NewBiz',
  transfer_form: 'NewBiz',
  delivery_receipt: 'NewBiz',
  replacement_form: 'NewBiz',
  suitability: 'NewBiz',
  // Cases subfolder — analysis & planning
  illustration: 'Cases',
  comparison: 'Cases',
  proposal: 'Cases',
  analysis: 'Cases',
  // Account subfolder — in-force management
  statement: 'Account',
  confirmation: 'Account',
  annual_review: 'Account',
  distribution: 'Account',
}

// ─── ACF_SNAPSHOT ───────────────────────────────────────────────────────────

export const acfSnapshotDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_SNAPSHOT',
  name: 'ACF Snapshot',
  description:
    'Capture ACF folder inventory to Firestore acf_snapshots collection. Before/after guardrail for all ACF operations.',
  used_by: ['SUPER_FOLDER_CLEANUP', 'SUPER_DOCUMENT_CLEANUP', 'SUPER_AUDIT_REVIEW'],
  category: 'BULK_OPERATIONS',
}

export interface AcfSnapshotInput {
  mode: 'snapshot' | 'trash-audit' | 'verify'
  parent_folder_id: string
  threshold?: number
}

export interface AcfSnapshotOutput {
  folder_count: number
  snapshot_id?: string
  trashed_count?: number
  drift?: { added: number; removed: number; renamed: number }
}

export function executeAcfSnapshot(
  input: AcfSnapshotInput
): AtomicToolResult<AcfSnapshotOutput> {
  // Stub — full implementation in services/api/src/scripts/acf-guardrails.ts
  return {
    success: true,
    data: { folder_count: 0 },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_RENAME ─────────────────────────────────────────────────────────────

export const acfRenameDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_RENAME',
  name: 'ACF Rename Folders',
  description:
    'Fix parent folder naming convention: Title Case, correct spacing, ACF prefix. Fixes ACF- to ACF -, ALL CAPS to Title Case, trailing commas, double spaces.',
  used_by: ['SUPER_FOLDER_CLEANUP'],
  category: 'NORMALIZATION_VALIDATION',
}

export interface AcfRenameInput {
  folder_ids?: string[]
  dry_run?: boolean
}

export interface AcfRenameOutput {
  renamed: number
  skipped: number
  errors: number
  renames: Array<{ folder_id: string; from: string; to: string }>
}

export function executeAcfRename(
  input: AcfRenameInput
): AtomicToolResult<AcfRenameOutput> {
  return {
    success: true,
    data: { renamed: 0, skipped: 0, errors: 0, renames: [] },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_MERGE ──────────────────────────────────────────────────────────────

export const acfMergeDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_MERGE',
  name: 'ACF Merge Duplicates',
  description:
    'Detect and merge duplicate ACF folders for the same client. Keeps the richer folder, moves files from the smaller one.',
  used_by: ['SUPER_FOLDER_CLEANUP'],
  category: 'MATCHING_DEDUP',
}

export interface AcfMergeInput {
  folder_ids?: string[]
  dry_run?: boolean
}

export interface AcfMergeOutput {
  merged: number
  skipped: number
  merges: Array<{ kept_folder_id: string; removed_folder_id: string; files_moved: number }>
}

export function executeAcfMerge(
  input: AcfMergeInput
): AtomicToolResult<AcfMergeOutput> {
  return {
    success: true,
    data: { merged: 0, skipped: 0, merges: [] },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_SUBFOLDER ──────────────────────────────────────────────────────────

export const acfSubfolderDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_SUBFOLDER',
  name: 'ACF Subfolder Audit',
  description:
    'Create/verify 5 lifecycle subfolders per ACF: Client, NewBiz, Cases, Account, Reactive.',
  used_by: ['SUPER_FOLDER_CLEANUP'],
  category: 'BULK_OPERATIONS',
}

export interface AcfSubfolderInput {
  folder_ids?: string[]
  create_missing?: boolean
}

export interface AcfSubfolderOutput {
  perfect: number
  missing_some: number
  missing_all: number
  created: number
  per_subfolder: Record<string, number>
}

export function executeAcfSubfolder(
  input: AcfSubfolderInput
): AtomicToolResult<AcfSubfolderOutput> {
  return {
    success: true,
    data: {
      perfect: 0,
      missing_some: 0,
      missing_all: 0,
      created: 0,
      per_subfolder: {},
    },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_ROUTE_FILES ────────────────────────────────────────────────────────

export const acfRouteFilesDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_ROUTE_FILES',
  name: 'ACF Route Files',
  description:
    'Move loose files from ACF folder root into the correct lifecycle subfolder based on file classification.',
  used_by: ['SUPER_FOLDER_CLEANUP'],
  category: 'NORMALIZATION_VALIDATION',
}

export interface AcfRouteFilesInput {
  folder_id: string
  dry_run?: boolean
}

export interface AcfRouteFilesOutput {
  routed: number
  skipped: number
  routes: Array<{ file_id: string; file_name: string; target_subfolder: string }>
}

export function executeAcfRouteFiles(
  input: AcfRouteFilesInput
): AtomicToolResult<AcfRouteFilesOutput> {
  return {
    success: true,
    data: { routed: 0, skipped: 0, routes: [] },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_LINK ───────────────────────────────────────────────────────────────

export const acfLinkDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_LINK',
  name: 'ACF Link to Firestore',
  description:
    'Write acf_folder_id and acf_folder_url to Firestore client doc. Bidirectional link between Drive folder and client record.',
  used_by: ['SUPER_FOLDER_CLEANUP'],
  category: 'NORMALIZATION_VALIDATION',
}

export interface AcfLinkInput {
  links: Array<{ client_id: string; folder_id: string; folder_url: string }>
}

export interface AcfLinkOutput {
  linked: number
  already_linked: number
  errors: number
}

export function executeAcfLink(
  input: AcfLinkInput
): AtomicToolResult<AcfLinkOutput> {
  return {
    success: true,
    data: { linked: 0, already_linked: 0, errors: 0 },
    processed: input.links?.length ?? 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_FLATTEN ────────────────────────────────────────────────────────────

export const acfFlattenDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_FLATTEN',
  name: 'ACF Flatten Nesting',
  description:
    'Shred nested sub-sub-folders. Bring all files up to one of the 5 lifecycle subfolders. Max depth = ACF / Subfolder / files.',
  used_by: ['SUPER_DOCUMENT_CLEANUP'],
  category: 'BULK_OPERATIONS',
}

export interface AcfFlattenInput {
  folder_id: string
  dry_run?: boolean
}

export interface AcfFlattenOutput {
  flattened: number
  folders_removed: number
  files_moved: number
}

export function executeAcfFlatten(
  input: AcfFlattenInput
): AtomicToolResult<AcfFlattenOutput> {
  return {
    success: true,
    data: { flattened: 0, folders_removed: 0, files_moved: 0 },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_DEDUPE_FILES ───────────────────────────────────────────────────────

export const acfDedupeFilesDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_DEDUPE_FILES',
  name: 'ACF Deduplicate Files',
  description:
    'Detect duplicate files across ACF subfolders. Match by content hash (MD5 from Drive API) + filename similarity. Keep the copy in the correct subfolder.',
  used_by: ['SUPER_DOCUMENT_CLEANUP'],
  category: 'MATCHING_DEDUP',
}

export interface AcfDedupeFilesInput {
  folder_id: string
  dry_run?: boolean
}

export interface AcfDedupeFilesOutput {
  duplicates_found: number
  duplicates_removed: number
  kept: Array<{ file_id: string; name: string; subfolder: string }>
  removed: Array<{ file_id: string; name: string; subfolder: string }>
}

export function executeAcfDedupeFiles(
  input: AcfDedupeFilesInput
): AtomicToolResult<AcfDedupeFilesOutput> {
  return {
    success: true,
    data: { duplicates_found: 0, duplicates_removed: 0, kept: [], removed: [] },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_RENAME_FILES ───────────────────────────────────────────────────────

export const acfRenameFilesDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_RENAME_FILES',
  name: 'ACF Rename Files',
  description:
    'Apply {YYYY-MM}_{DocType}_{Carrier}_{PolicyNum}.ext naming convention. Uses document taxonomy and carrier normalization. UNKNOWN segments flagged for ACF_AUDIT.',
  used_by: ['SUPER_DOCUMENT_CLEANUP'],
  category: 'NORMALIZATION_VALIDATION',
}

export interface AcfRenameFilesInput {
  folder_id: string
  dry_run?: boolean
}

export interface AcfRenameFilesOutput {
  renamed: number
  skipped: number
  unknown_segments: number
  renames: Array<{ file_id: string; from: string; to: string }>
  exceptions: Array<{ file_id: string; name: string; reason: string }>
}

export function executeAcfRenameFiles(
  input: AcfRenameFilesInput
): AtomicToolResult<AcfRenameFilesOutput> {
  return {
    success: true,
    data: { renamed: 0, skipped: 0, unknown_segments: 0, renames: [], exceptions: [] },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_RECLASSIFY ─────────────────────────────────────────────────────────

export const acfReclassifyDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_RECLASSIFY',
  name: 'ACF Reclassify Files',
  description:
    'Move files to the correct lifecycle subfolder based on document type. Uses DOCUMENT_TYPE_TO_SUBFOLDER mapping.',
  used_by: ['SUPER_DOCUMENT_CLEANUP'],
  category: 'NORMALIZATION_VALIDATION',
}

export interface AcfReclassifyInput {
  folder_id: string
  dry_run?: boolean
}

export interface AcfReclassifyOutput {
  reclassified: number
  already_correct: number
  moves: Array<{ file_id: string; name: string; from: string; to: string }>
}

export function resolveSubfolder(documentType?: string): string {
  if (documentType && DOCUMENT_TYPE_TO_SUBFOLDER[documentType]) {
    return DOCUMENT_TYPE_TO_SUBFOLDER[documentType]
  }
  return 'Reactive'
}

export function executeAcfReclassify(
  input: AcfReclassifyInput
): AtomicToolResult<AcfReclassifyOutput> {
  return {
    success: true,
    data: { reclassified: 0, already_correct: 0, moves: [] },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── ACF_AUDIT ──────────────────────────────────────────────────────────────

export const acfAuditDefinition: AtomicToolDefinition = {
  tool_id: 'ACF_AUDIT',
  name: 'ACF Audit',
  description:
    'Generate exceptions report: unresolvable duplicates, UNKNOWN naming segments, orphan folders, broken Firestore links, missing subfolders.',
  used_by: ['SUPER_AUDIT_REVIEW'],
  category: 'BULK_OPERATIONS',
}

export interface AcfAuditInput {
  scope?: 'full' | 'incremental'
}

export interface AcfAuditException {
  type: 'unresolvable_duplicate' | 'unknown_segment' | 'orphan_folder' | 'broken_link' | 'missing_subfolder'
  severity: 'high' | 'medium' | 'low'
  client_id?: string
  folder_id?: string
  file_id?: string
  description: string
  suggested_action: string
}

export interface AcfAuditOutput {
  total_exceptions: number
  exceptions: AcfAuditException[]
  by_type: Record<string, number>
  by_severity: Record<string, number>
}

export function executeAcfAudit(
  input: AcfAuditInput
): AtomicToolResult<AcfAuditOutput> {
  return {
    success: true,
    data: {
      total_exceptions: 0,
      exceptions: [],
      by_type: {},
      by_severity: {},
    },
    processed: 0,
    passed: 0,
    failed: 0,
  }
}

// ─── Aggregate: all ACF tool definitions ────────────────────────────────────

export function getAcfToolDefinitions(): AtomicToolDefinition[] {
  return [
    acfSnapshotDefinition,
    acfRenameDefinition,
    acfMergeDefinition,
    acfSubfolderDefinition,
    acfRouteFilesDefinition,
    acfLinkDefinition,
    acfFlattenDefinition,
    acfDedupeFilesDefinition,
    acfRenameFilesDefinition,
    acfReclassifyDefinition,
    acfAuditDefinition,
  ]
}
