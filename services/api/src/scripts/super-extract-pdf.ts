#!/usr/bin/env npx tsx
/**
 * SUPER_EXTRACT_PDF — Bulk PDF → Structured Data via Claude Vision
 *
 * Reads local PDFs, converts pages to images, sends to Claude Vision
 * for structured extraction, outputs JSON ready for WIRE_DATA_IMPORT.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/super-extract-pdf.ts --dir ~/Downloads --pattern "*.pdf" --carrier "Kansas City Life"
 *   npx tsx services/api/src/scripts/super-extract-pdf.ts --files "1:18.pdf,2:18.pdf" --carrier "Kansas City Life"
 *   npx tsx services/api/src/scripts/super-extract-pdf.ts --dir ~/Downloads --pattern "[0-9]*.pdf" --carrier "Kansas City Life" --dry-run
 *   npx tsx services/api/src/scripts/super-extract-pdf.ts --dir ~/Downloads --pattern "[0-9]*.pdf" --carrier "Kansas City Life" --enrich
 *
 * Options:
 *   --dir DIR          Directory containing PDFs (default: ~/Downloads)
 *   --pattern GLOB     Glob pattern for PDF filenames (default: *.pdf)
 *   --files F1,F2,...  Specific filenames (comma-separated)
 *   --carrier NAME     Carrier name hint for extraction prompt
 *   --type TYPE        Document type: statement, kcl_portfolio, commission, application, general
 *   --output FILE      Write results to JSON file (default: stdout summary + file)
 *   --concurrency N    Max parallel extractions (default: 3)
 *   --limit N          Process only first N files
 *   --dry-run          List files without processing
 *   --enrich           After extraction, match + update Firestore clients
 *   --max-pages N      Max pages per PDF to process (default: 25)
 */

import Anthropic from '@anthropic-ai/sdk'
import { pdf } from 'pdf-to-img'
import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import dotenv from 'dotenv'

// Load API key from MCP-Hub .env or local .env.anthropic
dotenv.config({ path: path.join(process.env.HOME || '', 'Projects/services/MCP-Hub/.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.anthropic') })

// ═══════════════════════════════════════════════════════════════════════════
// CLI ARGS
// ═══════════════════════════════════════════════════════════════════════════

function getArg(name: string, defaultVal?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1) return defaultVal
  return process.argv[idx + 1] || defaultVal
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`)

const DIR = getArg('dir', path.join(process.env.HOME || '', 'Downloads'))!
const PATTERN = getArg('pattern', '*.pdf')!
const FILES = getArg('files')
const CARRIER = getArg('carrier', '')!
const DOC_TYPE = getArg('type', 'kcl_portfolio')!
const OUTPUT = getArg('output', path.join(DIR, `super-extract-${Date.now()}.json`))!
const CONCURRENCY = parseInt(getArg('concurrency', '3')!, 10)
const LIMIT = parseInt(getArg('limit', '999')!, 10)
const MAX_PAGES = parseInt(getArg('max-pages', '25')!, 10)
const DRY_RUN = hasFlag('dry-run')
const ENRICH = hasFlag('enrich')

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

const PROMPTS: Record<string, string> = {
  kcl_portfolio: `You are extracting structured data from a Kansas City Life Insurance portfolio/detail PDF.

This PDF contains detail pages for multiple insurance policies (up to 10 per batch).
Each policy has sections: General Information, People (address/phone), Values, and Transactions.

For EACH policy in this PDF, extract a JSON object with these fields:

{
  "policy_number": "7-digit number",
  "status": "Active|Paid Up|Reduced|Lapsed",
  "policy_type": "Universal Life|Whole Life|Term Life|Annuity",
  "insured_name": "LAST, FIRST M",
  "birthdate": "MM/DD/YYYY",
  "plan_name": "full plan name",
  "plan_code": "short code like LIFEPROT11, NOVA07C, etc.",
  "plan_option": "A, B, or empty",
  "issue_date": "MM/DD/YYYY",
  "maturity_date": "MM/DD/YYYY or empty",
  "risk_class": "NONSMOKER, SMOKER, STD-SELECT, etc.",
  "specified_amount": "$XX,XXX.XX (face amount)",
  "total_premiums_paid": "$XX,XXX.XX",
  "policy_value": "$XX,XXX.XX",
  "mode": "Annual|Monthly|Quarterly|Semi-Annual",
  "premium_billed": "$XX.XX",
  "billing_status": "On Schedule|Suspended|etc.",
  "guideline_single": "$XX,XXX.XX or empty",
  "guideline_accumulation": "$XX,XXX.XX or empty",
  "address": "street address",
  "city": "CITY NAME",
  "state": "XX (2-letter)",
  "zip": "XXXXX",
  "zip4": "XXXX (the +4 portion) or empty",
  "phone": "(XXX) XXX-XXXX or empty",
  "issue_age": "NN",
  "ssn_last4": "XXXX (digits only, no dashes)",
  "sex": "MALE|FEMALE",
  "beneficiaries": "P-NAME-RELATIONSHIP; C-NAME-RELATIONSHIP (semicolon separated)",
  "cash_value": "$XX,XXX.XX or 0.00",
  "surrender_value": "$XX,XXX.XX or 0.00",
  "death_benefit": "$XX,XXX.XX or empty",
  "loan_balance": "$XX,XXX.XX or 0.00",
  "net_loan_amount": "$XX,XXX.XX or 0.00",
  "total_transactions": N,
  "last_transaction_date": "MM/DD/YYYY or empty",
  "cost_basis": "$XX,XXX.XX or empty",
  "base_cash_value": "$XX,XXX.XX or empty",
  "net_surrender_value": "$XX,XXX.XX or empty",
  "dividend_value": "$XX,XXX.XX or empty"
}

Return a JSON object: { "policies": [ {...}, {...}, ... ] }

IMPORTANT:
- Extract EVERY policy shown in the PDF (up to 10 per batch)
- Parse ALL dollar amounts exactly as shown (keep $ sign and commas)
- SSN will show as ***-**-XXXX — extract just the last 4 digits
- Beneficiaries format: P- prefix = Primary, C- prefix = Contingent
- For annuities, some life insurance fields will be empty — that's fine
- If a field is not present or not applicable, use empty string ""
- Return ONLY valid JSON, no markdown or explanation`,

  statement: `You are extracting structured data from an insurance policy statement PDF.

Extract:
{
  "document_type": "policy_statement",
  "carrier": "", "policy_number": "", "statement_date": "YYYY-MM-DD",
  "client_name": "", "product": "", "status": "",
  "account_value": 0.00, "cash_value": 0.00, "surrender_value": 0.00,
  "death_benefit": 0.00, "premium_due": 0.00, "premium_mode": "",
  "loan_balance": 0.00,
  "address": "", "city": "", "state": "", "zip": "", "phone": ""
}

Return ONLY valid JSON.`,

  general: `You are extracting structured data from an insurance document PDF.
Classify the document type and extract all relevant structured data as JSON.
Include any client info (name, DOB, contact), policy info (numbers, carrier, values),
and financial info (amounts, premiums).
Return ONLY valid JSON with a "document_type" field.`,
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF → IMAGES
// ═══════════════════════════════════════════════════════════════════════════

interface PageImage {
  page: number
  base64: string
  mediaType: 'image/png'
}

async function pdfToImages(filePath: string, maxPages: number): Promise<PageImage[]> {
  const buffer = fs.readFileSync(filePath)
  const images: PageImage[] = []
  let pageNum = 0

  const document = await pdf(buffer, { scale: 2.0 })
  for await (const page of document) {
    pageNum++
    if (pageNum > maxPages) break
    images.push({
      page: pageNum,
      base64: Buffer.from(page).toString('base64'),
      mediaType: 'image/png',
    })
  }

  return images
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

async function extractFromPdf(
  client: Anthropic,
  filePath: string,
  docType: string,
  carrierHint: string,
  maxPages: number
): Promise<{ success: boolean; fileName: string; data?: any; error?: string; pages?: number }> {
  const fileName = path.basename(filePath)

  try {
    const images = await pdfToImages(filePath, maxPages)
    if (images.length === 0) {
      return { success: false, fileName, error: 'No pages extracted from PDF' }
    }

    let prompt = PROMPTS[docType] || PROMPTS.general
    if (carrierHint) {
      prompt += `\n\nHint: This document is from carrier "${carrierHint}".`
    }

    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []
    for (const img of images) {
      content.push({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
      })
    }
    content.push({ type: 'text' as const, text: prompt })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [{ role: 'user', content }],
    })

    const responseText = (response.content[0] as any).text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, fileName, error: 'No JSON in response', pages: images.length }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return { success: true, fileName, data: parsed, pages: images.length }
  } catch (err: any) {
    return { success: false, fileName, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE ENRICHMENT
// ═══════════════════════════════════════════════════════════════════════════

async function enrichFirestoreClients(allPolicies: any[]) {
  const { initializeApp, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
  const db = getFirestore()

  // Load all active clients for matching
  const statuses = ['Active', 'Active - Internal', 'Active - External']
  const clients: { id: string; data: any }[] = []
  for (const s of statuses) {
    const snap = await db.collection('clients').where('client_status', '==', s).get()
    snap.docs.forEach(d => clients.push({ id: d.id, data: d.data() }))
  }

  let matched = 0
  let enriched = 0
  let notFound = 0

  for (const policy of allPolicies) {
    if (!policy.insured_name) continue

    // Parse "LAST, FIRST M" format
    const parts = policy.insured_name.split(',').map((s: string) => s.trim())
    const pLast = (parts[0] || '').toLowerCase()
    const pFirst = (parts[1] || '').split(' ')[0].toLowerCase()

    // Find matching client
    const match = clients.find(c => {
      const cLast = (c.data.last_name || '').toLowerCase()
      const cFirst = (c.data.first_name || '').toLowerCase()
      return cLast === pLast && cFirst === pFirst
    })

    if (!match) {
      notFound++
      continue
    }

    matched++

    // Check if client needs address enrichment
    const hasAddress = match.data.city && match.data.state && match.data.zip
    const updates: Record<string, any> = {}

    if (!hasAddress && policy.city && policy.state && policy.zip) {
      updates.city = policy.city.charAt(0).toUpperCase() + policy.city.slice(1).toLowerCase()
      updates.state = policy.state.toUpperCase()
      updates.zip = policy.zip
      if (policy.address) updates.address = policy.address
      if (policy.zip4) updates.address_2 = `ZIP+4: ${policy.zip4}`
      updates._kcl_enriched_at = new Date().toISOString()
    }

    if (!match.data.phone && policy.phone) {
      updates.phone = policy.phone
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('clients').doc(match.id).update(updates)
      enriched++
    }
  }

  return { matched, enriched, notFound, total: allPolicies.length }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n=== SUPER_EXTRACT_PDF ===\n')

  // Resolve file list
  let filePaths: string[] = []

  if (FILES) {
    filePaths = FILES.split(',').map(f => {
      const full = path.resolve(DIR, f.trim())
      if (!fs.existsSync(full)) {
        console.error(`File not found: ${full}`)
        process.exit(1)
      }
      return full
    })
  } else {
    const resolvedDir = path.resolve(DIR)
    const matches = await glob(path.join(resolvedDir, PATTERN))
    filePaths = matches
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .sort()
  }

  filePaths = filePaths.slice(0, LIMIT)

  console.log(`Directory: ${DIR}`)
  console.log(`Pattern: ${PATTERN}`)
  console.log(`Files found: ${filePaths.length}`)
  console.log(`Carrier: ${CARRIER || '(auto-detect)'}`)
  console.log(`Doc type: ${DOC_TYPE}`)
  console.log(`Max pages per PDF: ${MAX_PAGES}`)
  console.log(`Concurrency: ${CONCURRENCY}`)
  console.log(`Enrich Firestore: ${ENRICH}`)
  console.log()

  if (filePaths.length === 0) {
    console.log('No PDFs found. Exiting.')
    return
  }

  // Dry run — just list
  if (DRY_RUN) {
    console.log('--- DRY RUN (files to process) ---')
    for (const f of filePaths) {
      const stats = fs.statSync(f)
      const sizeKB = Math.round(stats.size / 1024)
      console.log(`  ${path.basename(f)} (${sizeKB} KB)`)
    }
    console.log(`\nTotal: ${filePaths.length} PDFs`)
    return
  }

  // Initialize Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set. Export it or add to .env')
    process.exit(1)
  }
  const client = new Anthropic({ apiKey })

  // Process in batches
  const allResults: any[] = []
  let allPolicies: any[] = []
  let totalPages = 0
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
    const batch = filePaths.slice(i, i + CONCURRENCY)
    const batchNum = Math.floor(i / CONCURRENCY) + 1
    const totalBatches = Math.ceil(filePaths.length / CONCURRENCY)

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} files)...`)

    const results = await Promise.all(
      batch.map(f => extractFromPdf(client, f, DOC_TYPE, CARRIER, MAX_PAGES))
    )

    for (const r of results) {
      allResults.push(r)
      if (r.success) {
        successCount++
        totalPages += r.pages || 0
        // Collect policies
        if (r.data?.policies) {
          allPolicies = allPolicies.concat(r.data.policies)
        } else if (r.data?.policy_number) {
          allPolicies.push(r.data)
        }
        console.log(`  OK: ${r.fileName} (${r.pages} pages, ${r.data?.policies?.length || 1} policies)`)
      } else {
        failCount++
        console.log(`  FAIL: ${r.fileName} — ${r.error}`)
      }
    }
  }

  // Summary
  console.log('\n--- EXTRACTION COMPLETE ---')
  console.log(`Files processed: ${allResults.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Total pages processed: ${totalPages}`)
  console.log(`Total policies extracted: ${allPolicies.length}`)

  // Write output
  const output = {
    extraction_date: new Date().toISOString(),
    carrier: CARRIER,
    doc_type: DOC_TYPE,
    files_processed: allResults.length,
    success_count: successCount,
    fail_count: failCount,
    total_pages: totalPages,
    total_policies: allPolicies.length,
    policies: allPolicies,
    errors: allResults.filter(r => !r.success).map(r => ({ file: r.fileName, error: r.error })),
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2))
  console.log(`\nOutput written to: ${OUTPUT}`)

  // Enrich if requested
  if (ENRICH && allPolicies.length > 0) {
    console.log('\n--- ENRICHING FIRESTORE ---')
    const enrichResult = await enrichFirestoreClients(allPolicies)
    console.log(`Matched: ${enrichResult.matched} / ${enrichResult.total}`)
    console.log(`Enriched (address/phone updated): ${enrichResult.enriched}`)
    console.log(`Not found in Firestore: ${enrichResult.notFound}`)
  }

  console.log('\n=== Done ===\n')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
