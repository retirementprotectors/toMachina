// ---------------------------------------------------------------------------
// Super Tool: CLASSIFY
// Orchestrates: classify-boundaries → split-pdf → label-document
// New stage for WIRE_INCOMING_CORRESPONDENCE — classifies multi-page scans.
// ---------------------------------------------------------------------------

import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
} from '../types'
import { classifyBoundaries } from '../tools/classify-boundaries'
import type { ClassifyBoundariesInput, ClassifiedDocument as BoundaryDoc } from '../tools/classify-boundaries'
import { splitPdf } from '../tools/split-pdf'
import type { SplitPdfInput } from '../tools/split-pdf'
import { labelDocument } from '../tools/label-document'
import type { TaxonomyEntry, LabelDocumentInput } from '../tools/label-document'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_CLASSIFY',
  name: 'Document Classification + Splitting',
  description:
    'Boundary detection, PDF splitting, and document labeling for multi-page scans. Detects where one document ends and the next begins, splits the PDF, and labels each document by type.',
  tools: ['classify-boundaries', 'split-pdf', 'label-document'],
}

/* ─── Input/Output Types ─── */

export type { TaxonomyEntry }

export interface ClassifyInput {
  image_paths: string[]
  file_name: string
  file_path?: string
  taxonomy_types: TaxonomyEntry[]
}

export interface ClassifiedOutputDoc {
  doc_index: number
  pages: number[]
  type: string
  label: string
  file_path: string
  acf_subfolder: string
  pipeline_id: string | null
  priority: string
}

export interface ClassifyOutput {
  document_count: number
  documents: ClassifiedOutputDoc[]
}

/* ─── Execute ─── */

export async function execute(
  input: ClassifyInput,
  _context: SuperToolContext
): Promise<SuperToolResult<ClassifyOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { image_paths, file_name, file_path, taxonomy_types } = input

    if (!image_paths || image_paths.length === 0) {
      return { success: false, error: 'image_paths array is required and must not be empty' }
    }

    // ──── Step 1: Classify Boundaries ────
    const boundaryInput: ClassifyBoundariesInput = {
      image_paths,
      page_count: image_paths.length,
      taxonomy_types: taxonomy_types.map((t) => ({
        document_type: t.document_type,
        pipeline: t.pipeline,
        owner_role: t.owner_role,
      })),
    }

    const boundaryResult = await classifyBoundaries(boundaryInput)

    toolResults['classify-boundaries'] = {
      success: boundaryResult !== null,
      processed: 1,
      passed: boundaryResult ? boundaryResult.document_count : 0,
    }

    if (!boundaryResult) {
      return {
        success: false,
        error: 'Boundary detection failed — null result',
        tool_results: toolResults,
      }
    }

    const { document_count, documents: boundaryDocs } = boundaryResult

    // ──── Step 2: Split PDF (skip if single document) ────
    let splitFiles: Array<{ path: string; doc_index: number; type: string; pages: number[] }> = []

    if (document_count > 1 && file_path) {
      const splitInput: SplitPdfInput = {
        pdf_path: file_path,
        documents: boundaryDocs.map((d) => ({
          doc_index: d.doc_index,
          pages: d.pages,
          type: d.type,
        })),
      }

      const splitResult = await splitPdf(splitInput)

      toolResults['split-pdf'] = {
        success: splitResult.success,
        processed: 1,
        passed: splitResult.files.length,
      }

      if (!splitResult.success) {
        return {
          success: false,
          error: 'PDF split failed',
          tool_results: toolResults,
        }
      }

      splitFiles = splitResult.files
    } else {
      // Single doc — no split needed
      toolResults['split-pdf'] = {
        success: true,
        processed: 1,
        passed: 1,
      }
      splitFiles = boundaryDocs.map((d) => ({
        path: file_path ?? '',
        doc_index: d.doc_index,
        type: d.type,
        pages: d.pages,
      }))
    }

    // ──── Step 3: Label Each Document ────
    const classifiedDocs: ClassifiedOutputDoc[] = []

    for (const splitFile of splitFiles) {
      const boundaryDoc = boundaryDocs.find((d) => d.doc_index === splitFile.doc_index)
      const docType = boundaryDoc?.type ?? splitFile.type

      const labelInput: LabelDocumentInput = {
        document_type: docType,
        extracted_data: { file_name, client_name: boundaryDoc?.client_name ?? null },
        taxonomy_types,
      }

      const labelResult = labelDocument(labelInput)

      classifiedDocs.push({
        doc_index: splitFile.doc_index,
        pages: splitFile.pages,
        type: docType,
        label: labelResult.label ?? `${docType} - ${file_name}`,
        file_path: splitFile.path,
        acf_subfolder: labelResult.acf_subfolder,
        pipeline_id: labelResult.pipeline_id,
        priority: labelResult.priority,
      })
    }

    toolResults['label-document'] = {
      success: true,
      processed: splitFiles.length,
      passed: classifiedDocs.length,
    }

    return {
      success: true,
      data: {
        document_count: classifiedDocs.length,
        documents: classifiedDocs,
      },
      tool_results: toolResults,
      stats: {
        records_in: 1,
        records_out: classifiedDocs.length,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error in SUPER_CLASSIFY'
    return {
      success: false,
      error: message,
      tool_results: toolResults,
    }
  }
}
