// ---------------------------------------------------------------------------
// Atomic Tool: classify-boundaries
// Extracted from: watcher.js:1373-1493 (classifyDocumentBoundaries)
// Claude Vision boundary detection for multi-document PDF scans
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import type { AtomicToolDefinition } from '../types'

export const definition: AtomicToolDefinition = {
  tool_id: 'classify-boundaries',
  name: 'Document Boundary Classification',
  description:
    'Claude Vision analysis of scanned PDF pages to detect where one document ends and another begins. Returns page groups with document types.',
  category: 'DOCUMENT_PROCESSING',
}

// --- Types ---

export interface TaxonomyType {
  document_type: string
  pipeline?: string
  owner_role?: string
}

export interface ClassifyBoundariesInput {
  image_paths: string[]
  page_count?: number
  taxonomy_types?: TaxonomyType[]
  anthropic_api_key?: string
  model?: string
}

export interface ClassifiedDocument {
  doc_index: number
  pages: number[]
  type: string
  description: string
  client_name: string | null
}

export interface ClassifyBoundariesOutput {
  document_count: number
  documents: ClassifiedDocument[]
}

// --- Helpers ---

function buildTypeListForPrompt(taxonomyTypes: TaxonomyType[]): string {
  if (!taxonomyTypes || taxonomyTypes.length === 0) {
    return '(No taxonomy types available — classify to your best judgment)'
  }

  const byPipeline: Record<string, string[]> = {}
  taxonomyTypes.forEach((t) => {
    const p = t.pipeline || 'REACTIVE'
    if (!byPipeline[p]) byPipeline[p] = []
    byPipeline[p].push(`- ${t.document_type} (${t.owner_role || 'AST'})`)
  })

  const labels: Record<string, string> = {
    PRO: 'PRO pipeline (Proactive Service — rate actions, annual reviews, advisory):',
    REACTIVE: 'REACTIVE pipeline (Client-initiated service requests):',
    NewBiz: 'NewBiz pipeline (New business, applications, quotes):',
  }

  let text = ''
  for (const [pipeline, items] of Object.entries(byPipeline)) {
    text += `\n${labels[pipeline] || pipeline + ':'}\n${items.join('\n')}\n`
  }
  return text
}

// --- Execute ---

export async function classifyBoundaries(
  input: ClassifyBoundariesInput
): Promise<ClassifyBoundariesOutput | null> {
  const { image_paths, taxonomy_types = [], anthropic_api_key, model } = input

  const typeList = buildTypeListForPrompt(taxonomy_types)
  const apiKey = anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required for classify-boundaries')
  const anthropic = new Anthropic({ apiKey })

  // Build image blocks for ALL pages
  const imageBlocks: Array<Record<string, unknown>> = []
  let totalBytes = 0
  const MAX_CLASSIFY_BYTES = 100 * 1024 * 1024

  for (let i = 0; i < image_paths.length; i++) {
    const imagePath = image_paths[i]
    if (!fs.existsSync(imagePath)) {
      console.warn(`   Page ${i + 1} missing (skipped): ${path.basename(imagePath)}`)
      continue
    }

    const imageData = fs.readFileSync(imagePath)
    const base64 = imageData.toString('base64')

    if (totalBytes + base64.length > MAX_CLASSIFY_BYTES) {
      console.warn(`   Classification capped at ${imageBlocks.length} pages (payload limit)`)
      break
    }

    totalBytes += base64.length
    // Label each page so Claude knows exactly which image = which page number
    imageBlocks.push({ type: 'text', text: `--- PAGE ${i} ---` })
    imageBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: base64 },
    })
  }

  if (imageBlocks.length < 4) return null // Need at least 2 pages (each has label + image = 4 blocks)

  const pageCount = input.page_count || Math.floor(imageBlocks.length / 2)

  const hasTypes = taxonomy_types && taxonomy_types.length > 0

  // PROVEN PROMPT — copied verbatim from watcher.js:1413-1457
  const prompt = `You are a document boundary analyst for RPI (Retirement Protectors Inc). This scanned PDF contains ${pageCount} pages that may include MULTIPLE different documents scanned together.

Your job: identify where one document ends and another begins, and classify each document.

Each image above is labeled with its PAGE NUMBER (0-indexed). "--- PAGE 0 ---" is the first page, "--- PAGE 1 ---" is the second, etc.

CRITICAL: Use the page labels to reference pages. The client_name MUST be read from the ACTUAL CONTENT on that specific page — do NOT guess or carry names across unrelated documents.

Look for these boundary signals:
- Different letterhead, logo, or branding between pages
- Different document types (statement vs letter vs form vs notice)
- Different carrier/institution/company names
- "Page 1 of X" indicators starting a new sequence
- New document titles or headers
- Different client/policyholder names (different person = different document)
- Blank separator pages (group with the NEXT document, not the previous)
- Changes in formatting style (e.g., tabular data to letter format)
${hasTypes ? `
DOCUMENT TYPE CLASSIFICATION:
For the "type" field, pick the BEST MATCH from this list of known document types:
${typeList}
If none of these match, use a descriptive name but prefer the list above whenever possible.
` : ''}
Return JSON with this EXACT structure:
{
  "document_count": <number of distinct documents found>,
  "documents": [
    {
      "doc_index": 0,
      "pages": [0, 1, 2],
      "type": "<document type from the list above, or descriptive name if no match>",
      "description": "<brief description, e.g. 'Q4 2025 brokerage statement for John Smith, 3 pages'>",
      "client_name": "<name of the person this document is about, or null if unclear>"
    }
  ]
}

If this is a SINGLE document (all pages from the same source), return document_count: 1 with all pages in one group.

RULES:
1. Page numbers are 0-indexed (first page = 0, second = 1, etc.)
2. Every page must be assigned to exactly one document
3. Pages within a document must be contiguous (no gaps)
4. Blank separator pages should be grouped as "Blank Page" (they will be filtered out)
5. Return ONLY valid JSON, no markdown or explanation`

  const response = await anthropic.messages.create({
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text' as const, text: prompt }] as unknown as Anthropic.MessageCreateParams['messages'][0]['content'],
      },
    ],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as ClassifyBoundariesOutput
      if (result.document_count && Array.isArray(result.documents)) {
        // Validate page coverage
        const allPages = new Set<number>()
        for (const doc of result.documents) {
          if (Array.isArray(doc.pages)) doc.pages.forEach((p) => allPages.add(p))
        }
        const expectedPages = Math.floor(imageBlocks.length / 2)
        if (allPages.size < expectedPages) {
          console.warn(`   Classification covers ${allPages.size}/${expectedPages} pages — some pages unassigned`)
        }
        return result
      }
    }
    console.warn('   Classification returned unexpected format — treating as single document')
    return null
  } catch (e) {
    console.warn(`   Classification parse failed: ${e instanceof Error ? e.message : String(e)} — treating as single document`)
    return null
  }
}
