// ---------------------------------------------------------------------------
// Atomic Tool: split-pdf
// Extracted from: watcher.js:1503-1565 (splitPdfByPages)
// PyMuPDF-based PDF splitting via Python subprocess
// ---------------------------------------------------------------------------

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AtomicToolDefinition } from '../types'

export const definition: AtomicToolDefinition = {
  tool_id: 'split-pdf',
  name: 'PDF Page Splitter',
  description:
    'Split a multi-document PDF into separate files by page groups using PyMuPDF (Python subprocess).',
  category: 'DOCUMENT_PROCESSING',
}

// --- Types ---

export interface PageGroup {
  doc_index: number
  pages: number[]
  type: string
}

export interface SplitPdfInput {
  pdf_path: string
  documents: PageGroup[]
  output_dir?: string
}

export interface SplitFile {
  path: string
  doc_index: number
  type: string
  pages: number[]
}

export interface SplitPdfOutput {
  success: boolean
  files: SplitFile[]
}

// --- Execute ---

export async function splitPdf(input: SplitPdfInput): Promise<SplitPdfOutput> {
  const { pdf_path, documents } = input
  const outputDir = input.output_dir || path.join(os.tmpdir(), 'toMachina-splits')
  fs.mkdirSync(outputDir, { recursive: true })

  const pageGroups = documents.map((d) => d.pages)

  // PROVEN PYTHON SCRIPT — copied verbatim from watcher.js:1510-1536
  // Cloud Run note: Python + PyMuPDF (fitz) must be available in the runtime environment.
  // Install via: pip install PyMuPDF
  const pythonScript = `
import fitz
import os
import sys
import json

pdf_path = sys.argv[1]
output_dir = sys.argv[2]
page_groups = json.loads(sys.argv[3])

doc = fitz.open(pdf_path)
output_files = []

for idx, pages in enumerate(page_groups):
    new_doc = fitz.open()
    for page_num in pages:
        if page_num < len(doc):
            new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
    base_name = os.path.basename(pdf_path).replace(' ', '_').replace('.pdf', '')
    output_path = os.path.join(output_dir, f"{base_name}_split_{idx+1:02d}.pdf")
    new_doc.save(output_path)
    new_doc.close()
    output_files.append(output_path)

doc.close()
print(json.dumps({"success": True, "files": output_files}))
`

  return new Promise<SplitPdfOutput>((resolve, reject) => {
    const python = spawn('python3', [
      '-c',
      pythonScript,
      pdf_path,
      outputDir,
      JSON.stringify(pageGroups),
    ])
    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    python.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PDF split failed: ${stderr}`))
      } else {
        try {
          const result = JSON.parse(stdout.trim()) as { success: boolean; files: string[] }
          // Enrich with document metadata
          const files: SplitFile[] = result.files.map((filePath, idx) => ({
            path: filePath,
            doc_index: documents[idx].doc_index,
            type: documents[idx].type,
            pages: documents[idx].pages,
          }))
          resolve({ success: true, files })
        } catch (e) {
          reject(new Error(`Failed to parse split result: ${stdout}`))
        }
      }
    })
  })
}
