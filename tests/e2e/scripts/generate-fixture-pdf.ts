#!/usr/bin/env npx tsx
/**
 * Generate a synthetic test correspondence PDF for E2E tests.
 * Creates a minimal valid PDF with classifiable text content.
 * NO PHI — all data is fabricated.
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = join(__dirname, '..', 'fixtures', 'test-correspondence.pdf')

// Build a minimal valid PDF manually (no external deps needed)
function buildPdf(): Buffer {
  const content = [
    'Retirement Protectors, Inc.',
    '1234 Main Street, Suite 100',
    'Des Moines, IA 50309',
    '',
    'March 15, 2026',
    '',
    'Dear Client,',
    '',
    'RE: Annual Account Review Correspondence',
    '',
    'This correspondence is to confirm the details of your recent',
    'account review meeting held on March 10, 2026.',
    '',
    'During our meeting, we discussed the following items:',
    '',
    '1. Current portfolio allocation and performance',
    '2. Upcoming Required Minimum Distribution schedule',
    '3. Beneficiary designation review',
    '4. Insurance policy renewal options',
    '',
    'Please review the enclosed documents and contact our office',
    'if you have any questions or require additional information.',
    '',
    'Policy Number: TEST-POL-000001',
    'Account Reference: TEST-ACC-000001',
    '',
    'Sincerely,',
    '',
    'E2E Test Advisor',
    'Retirement Protectors, Inc.',
    'Phone: (555) 000-0000',
    'Email: test@example.com',
    '',
    'This is a synthetic test document. No real client data is contained herein.',
  ].join('\n')

  // Minimal PDF structure
  const objects: string[] = []
  let xrefOffsets: number[] = []

  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  // Object 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  // Object 4: Font
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  // Build text content stream
  const lines = content.split('\n')
  let streamContent = 'BT\n/F1 11 Tf\n'
  let y = 750
  for (const line of lines) {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    streamContent += `1 0 0 1 72 ${y} Tm\n(${escaped}) Tj\n`
    y -= 16
  }
  streamContent += 'ET\n'

  // Object 5: Content Stream
  objects.push(`5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`)

  // Object 3: Page (after stream so we know its length)
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>\nendobj\n')

  // Build the PDF
  let pdf = '%PDF-1.4\n'
  // Re-order objects by number for xref
  const ordered = [objects[0], objects[1], objects[4], objects[2], objects[3]] // 1,2,3,4,5

  xrefOffsets = []
  for (const obj of ordered) {
    xrefOffsets.push(pdf.length)
    pdf += obj
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n`
  for (const offset of xrefOffsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

const pdfBuffer = buildPdf()
writeFileSync(outputPath, pdfBuffer)
console.log(`[fixture] Generated test PDF: ${outputPath} (${pdfBuffer.length} bytes)`)
