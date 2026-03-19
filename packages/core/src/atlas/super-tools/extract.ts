// ---------------------------------------------------------------------------
// Super Tool: EXTRACT
// Orchestrates: introspect (fingerprint + profile) → route-to-collection
// First step in any wire — determines what the data IS and where it goes.
//
// TWO MODES:
// 1. CSV mode (default) — header fingerprinting + column profiling
// 2. Vision mode — Claude Vision document extraction from page images
// ---------------------------------------------------------------------------

import type Anthropic from '@anthropic-ai/sdk'
import type {
  SuperToolDefinition,
  SuperToolContext,
  SuperToolResult,
  AtomicToolResult,
  ColumnMapping,
  AtlasFormat,
} from '../types'
import {
  hashHeaderFingerprint,
  profileCsvColumns,
  matchFingerprint,
  matchProfiles,
  profileCollection,
} from '../introspect'
import { execute as routeToCollection } from '../tools/route-to-collection'

export const definition: SuperToolDefinition = {
  super_tool_id: 'SUPER_EXTRACT',
  name: 'Extract & Identify',
  description:
    'Detect file format via header fingerprinting, profile columns, match against format library, determine target collection. Vision mode: Claude Vision document extraction from scanned images.',
  tools: ['introspect', 'route-to-collection', 'extract-vision'],
}

// --- CSV Mode Types (unchanged) ---

export interface ExtractInput {
  mode?: 'csv'
  headers: string[]
  rows: Record<string, unknown>[]
  /** Known formats to match against */
  formats?: AtlasFormat[]
  /** Collection profiles to match columns against (from Firestore collection sample) */
  collection_profiles?: Record<string, unknown>[]
}

// --- Vision Mode Types ---

export interface TaxonomyType {
  document_type: string
  pipeline?: string
  owner_role?: string
}

export interface VisionExtractInput {
  mode: 'vision'
  image_paths: string[]
  context?: {
    specialist?: string
    fileName?: string
    taxonomyTypes?: TaxonomyType[]
  }
  anthropic_api_key?: string
  model?: string
}

export interface VisionExtractOutput {
  client: Record<string, unknown>
  accounts: Record<string, unknown[]>
  mail_metadata?: Record<string, unknown>
  confidence?: Record<string, unknown>
}

export type ExtractInputUnion = ExtractInput | VisionExtractInput

export interface ExtractOutput {
  fingerprint: string
  format_match: { format: AtlasFormat; confidence: number } | null
  column_mappings: ColumnMapping[]
  target_collection: string
  target_subcollection?: string
  target_category: string
  match_method: 'fingerprint_exact' | 'fingerprint_partial' | 'full_introspect'
}

/**
 * Execute Vision mode — Claude Vision document extraction from scanned page images.
 * Extracted from watcher.js extractDataFromImages() (line 2170+) and extractMailData() (line 3095+).
 * PROVEN PROMPTS preserved verbatim from production watcher.
 */
export async function executeVision(
  input: VisionExtractInput
): Promise<SuperToolResult<VisionExtractOutput>> {
  try {
    // Dynamic import to avoid requiring @anthropic-ai/sdk for CSV mode callers
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const fs = await import('fs')
    const path = await import('path')

    const apiKey = input.anthropic_api_key || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return { success: false, error: 'ANTHROPIC_API_KEY required for vision mode' }
    }

    const anthropic = new Anthropic({ apiKey })
    const ctx = input.context || {}

    // Build image blocks (skip missing files)
    const MAX_PAYLOAD_BYTES = 100 * 1024 * 1024
    const imageBlocks: Array<Record<string, unknown>> = []
    let totalBytes = 0

    for (const imagePath of input.image_paths) {
      if (!fs.existsSync(imagePath)) {
        console.warn(`   Page image missing (skipped): ${path.basename(imagePath)}`)
        continue
      }
      const imageData = fs.readFileSync(imagePath)
      const base64 = imageData.toString('base64')
      if (totalBytes + base64.length > MAX_PAYLOAD_BYTES) {
        console.warn(`   Skipping remaining pages — payload would exceed limit (${imageBlocks.length} pages included)`)
        break
      }
      totalBytes += base64.length
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: base64 },
      })
    }

    if (imageBlocks.length === 0) {
      return { success: false, error: 'No page images available for vision extraction' }
    }

    // Determine which prompt to use: mail extraction vs general extraction
    // Mail extraction is used when we have taxonomy types (indicating physical mail processing)
    const useMail = ctx.taxonomyTypes && ctx.taxonomyTypes.length > 0
    const prompt = useMail
      ? buildMailExtractionPrompt(ctx)
      : buildGeneralExtractionPrompt(ctx)

    // Build content blocks — use `any` to bypass namespace resolution
    // issues with the dynamically-imported Anthropic SDK types
    const contentBlocks = [...imageBlocks, { type: 'text', text: prompt }]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: { content: Array<{ type: string; text?: string }> } = await (anthropic.messages as any).create({
      model: input.model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const firstBlock = response.content[0]
    const text = firstBlock?.text ?? ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON found in vision extraction response' }
    }

    const extracted = JSON.parse(jsonMatch[0]) as VisionExtractOutput
    return {
      success: true,
      data: extracted,
      stats: {
        records_in: input.image_paths.length,
        records_out: 1,
        filtered: 0,
        errors: 0,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Vision extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// PROVEN PROMPT — mail extraction from watcher.js:3128+ (extractMailData)
// Simplified to remove runtime taxonomy/learning lookups (caller passes those in context)
function buildMailExtractionPrompt(ctx: { specialist?: string; fileName?: string; taxonomyTypes?: TaxonomyType[] }): string {
  const typeList = buildTypeListForVision(ctx.taxonomyTypes || [])

  return `You are an expert mail analyst for RPI (Retirement Protectors Inc), a financial services firm.

Analyze this scanned mail document and extract structured data for import into RPI's MATRIX database.

Context:
- File: ${ctx.fileName || 'Unknown'}
- Source: Scanned physical mail

STEP 1: CLASSIFY THE DOCUMENT TYPE
Pick exactly ONE document_type from this list:
${typeList}
Choose the single best match. If uncertain, pick the closest match and note your uncertainty in confidence.notes.

STEP 2: DETERMINE THE BUSINESS UNIT
Based on the carrier name, product type, and document content, determine if this is "Medicare" or "Retirement":
- Medicare: MAPD, Med Supp, PDP, Medicare Advantage, Wellmark BCBS Medicare, Humana Medicare, UHC Medicare
- Retirement: Life insurance, annuities, investments, IRAs, 401k, brokerage, banking

STEP 3: EXTRACT DATA
Based on the document type, extract ALL relevant data.

Return JSON with this EXACT structure:
{
  "mail_metadata": {
    "document_type": "string - exact type name from list above",
    "unit": "Medicare|Retirement",
    "pipeline": "string - the pipeline shown next to your chosen type (PRO, REACTIVE, or NewBiz)",
    "owner_role": "string - the role shown next to your chosen type (COR, AST, or SPC)",
    "urgency": "urgent|normal|fyi",
    "carrier_name": "string - insurance company or financial institution",
    "policy_number": "string or null",
    "account_number": "string or null",
    "effective_date": "YYYY-MM-DD or null",
    "document_date": "YYYY-MM-DD or null",
    "action_required": "file|review|respond|escalate|process",
    "action_notes": "string - what needs to happen",
    "filing_name": "string - suggested filename per RPI convention"
  },
  "client": {
    "first_name": "string",
    "last_name": "string",
    "dob": "YYYY-MM-DD or null",
    "email": "string or null",
    "phone": "string or null",
    "address": "string or null",
    "city": "string or null",
    "state": "2-letter code or null",
    "zip": "5-digit string or null",
    "medicare_number": "string or null",
    "spouse_name": "string or null"
  },
  "accounts": {
    "investments": [],
    "life": [],
    "annuity": [],
    "banking": []
  },
  "confidence": {
    "client_info": "high|medium|low",
    "account_info": "high|medium|low",
    "notes": "string - any uncertainties or issues"
  }
}

CRITICAL RULES:
1. Categorize accounts correctly: investments (IRAs, 401k, brokerage), banking (checking, savings, CDs, mortgages), life (life insurance), annuity (annuity contracts)
2. Convert all monetary values to numbers (no $, no commas)
3. Convert all dates to YYYY-MM-DD format
4. If information is unclear, set to null and note in confidence.notes
5. Return ONLY valid JSON, no markdown or explanation`
}

// PROVEN PROMPT — general extraction from watcher.js:2205+ (extractDataFromImages)
function buildGeneralExtractionPrompt(ctx: { specialist?: string; fileName?: string }): string {
  return `You are an expert financial document analyst for RPI (Retirement Protectors Inc).

Analyze these financial statement images and extract ALL client and account information.

Context:
- Specialist: ${ctx.specialist || 'Unknown'}
- File: ${ctx.fileName || 'Unknown'}

Return a JSON object with this EXACT structure:
{
  "client": {
    "first_name": "string",
    "middle_name": "string or null",
    "last_name": "string",
    "dob": "YYYY-MM-DD or null",
    "email": "string or null",
    "phone": "string or null",
    "address": "string or null",
    "city": "string or null",
    "state": "2-letter code or null",
    "zip": "5-digit string or null",
    "ssn_last4": "string (last 4 digits) or null",
    "medicare_number": "string or null",
    "spouse_name": "string or null"
  },
  "accounts": {
    "investments": [],
    "life": [],
    "annuity": [],
    "banking": []
  },
  "confidence": {
    "client_info": "high|medium|low",
    "account_info": "high|medium|low",
    "notes": "string - any uncertainties or issues"
  }
}

CRITICAL RULES:
1. Categorize accounts correctly: investments (IRAs, 401k, brokerage), banking (checking, savings, CDs), life (life insurance), annuity (annuity contracts)
2. Convert all monetary values to numbers (no $, no commas)
3. Convert all dates to YYYY-MM-DD format
4. If information is unclear, set to null and note in confidence.notes
5. Return ONLY valid JSON, no markdown or explanation`
}

function buildTypeListForVision(taxonomyTypes: TaxonomyType[]): string {
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
    PRO: 'PRO pipeline (Proactive Service):',
    REACTIVE: 'REACTIVE pipeline (Client-initiated):',
    NewBiz: 'NewBiz pipeline (New business):',
  }
  let text = ''
  for (const [pipeline, items] of Object.entries(byPipeline)) {
    text += `\n${labels[pipeline] || pipeline + ':'}\n${items.join('\n')}\n`
  }
  return text
}

/**
 * Execute the Extract super tool.
 * Dispatches to CSV mode or Vision mode based on input.mode.
 *
 * CSV mode: Pure function — no Firestore dependencies. Format library and collection
 * profiles must be passed in by the caller (API route or service layer).
 *
 * Vision mode: Calls Claude Vision API for document extraction from scanned images.
 */
export async function execute(
  input: ExtractInputUnion,
  context: SuperToolContext
): Promise<SuperToolResult<ExtractOutput | VisionExtractOutput>> {
  // Vision mode dispatch
  if ('mode' in input && input.mode === 'vision') {
    return executeVision(input as VisionExtractInput)
  }

  // CSV mode (original, unchanged)
  return executeCsv(input as ExtractInput, context)
}

/**
 * Execute CSV mode (original implementation — COMPLETELY UNCHANGED).
 */
async function executeCsv(
  input: ExtractInput,
  context: SuperToolContext
): Promise<SuperToolResult<ExtractOutput>> {
  const toolResults: Record<string, AtomicToolResult> = {}

  try {
    const { headers, rows, formats = [], collection_profiles = [] } = input

    if (!headers || headers.length === 0) {
      return { success: false, error: 'Headers array is required and must not be empty' }
    }

    // Step 1: Hash headers into fingerprint
    const fingerprint = hashHeaderFingerprint(headers)

    // Step 2: Try fingerprint match against known formats
    const formatMatch = matchFingerprint(fingerprint, headers, formats)

    let columnMappings: ColumnMapping[] = []
    let matchMethod: ExtractOutput['match_method'] = 'full_introspect'
    let targetCategory = context.target_category || ''

    if (formatMatch && formatMatch.confidence === 100) {
      // Exact fingerprint match — use saved column map
      matchMethod = 'fingerprint_exact'
      targetCategory = targetCategory || formatMatch.format.default_category
      columnMappings = Object.entries(formatMatch.format.column_map).map(
        ([csvHeader, firestoreField]) => ({
          csv_header: csvHeader,
          firestore_field: firestoreField,
          confidence: 100,
          status: 'auto' as const,
          alternatives: [],
        })
      )

      toolResults['introspect-fingerprint'] = {
        success: true,
        data: { method: 'fingerprint_exact', confidence: 100 },
      }
    } else if (formatMatch && formatMatch.confidence > 80) {
      // Partial match — use as starting point but flag for review
      matchMethod = 'fingerprint_partial'
      targetCategory = targetCategory || formatMatch.format.default_category
      columnMappings = Object.entries(formatMatch.format.column_map).map(
        ([csvHeader, firestoreField]) => ({
          csv_header: csvHeader,
          firestore_field: firestoreField,
          confidence: formatMatch.confidence,
          status: 'suggested' as const,
          alternatives: [],
        })
      )

      toolResults['introspect-fingerprint'] = {
        success: true,
        data: { method: 'fingerprint_partial', confidence: formatMatch.confidence },
      }
    } else {
      // Full introspect — profile columns and match against collection
      matchMethod = 'full_introspect'
      const csvProfiles = profileCsvColumns(headers, rows)

      if (collection_profiles.length > 0) {
        const collProfiles = profileCollection(collection_profiles)
        const carrierMaps = formats.map((f) => f.column_map)
        columnMappings = matchProfiles(csvProfiles, collProfiles, carrierMaps)
      } else {
        // No collection profiles — create unmapped entries
        columnMappings = headers.map((h) => ({
          csv_header: h,
          firestore_field: '',
          confidence: 0,
          status: 'unmapped' as const,
          alternatives: [],
        }))
      }

      toolResults['introspect-profile'] = {
        success: true,
        data: {
          method: 'full_introspect',
          profiles_count: Object.keys(csvProfiles).length,
        },
      }
    }

    // Step 3: Route to collection
    const routeResult = routeToCollection({
      category: targetCategory,
      target_category: targetCategory,
      data_domain: context.target_collection,
    })

    toolResults['route-to-collection'] = routeResult

    const route = routeResult.data
    const targetCollection = route?.collection || 'clients'
    const targetSubcollection = route?.subcollection

    return {
      success: true,
      data: {
        fingerprint,
        format_match: formatMatch,
        column_mappings: columnMappings,
        target_collection: targetCollection,
        target_subcollection: targetSubcollection,
        target_category: targetCategory,
        match_method: matchMethod,
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
      error: `Extract failed: ${err instanceof Error ? err.message : String(err)}`,
      tool_results: toolResults,
    }
  }
}
