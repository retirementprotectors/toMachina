/**
 * Register SUPER_EXTRACT_PDF tool + KCL data source in ATLAS
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/register-kcl-atlas.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

async function main() {
  console.log('\n=== Registering SUPER_EXTRACT_PDF + KCL Source in ATLAS ===\n')

  // ─── 1. Register SUPER_EXTRACT_PDF tool ───

  const superExtractPdf = {
    tool_id: 'super-extract-pdf',
    name: 'SUPER_EXTRACT_PDF',
    description: 'Bulk PDF → Structured Data via Claude Vision. Converts PDF pages to images, sends to Claude Vision for field extraction, outputs JSON ready for WIRE_DATA_IMPORT. Supports carrier-specific prompts (KCL, Aetna, etc.).',
    type: 'SUPER_TOOL',
    category: 'data_import',
    status: 'active',
    location: 'services/api/src/scripts/super-extract-pdf.ts',
    dependencies: ['pdf-to-img', '@anthropic-ai/sdk'],
    inputs: {
      required: ['pdf_files'],
      optional: ['carrier', 'doc_type', 'max_pages', 'concurrency'],
    },
    outputs: {
      format: 'JSON',
      fields: ['policies[]', 'extraction_date', 'total_policies', 'errors[]'],
    },
    cli: {
      command: 'npx tsx services/api/src/scripts/super-extract-pdf.ts',
      examples: [
        '--dir ~/Downloads --pattern "[0-9]*.pdf" --carrier "Kansas City Life" --dry-run',
        '--dir ~/Downloads --pattern "[0-9]*.pdf" --carrier "Kansas City Life" --enrich',
        '--files "1:18.pdf,2:18.pdf" --carrier "Kansas City Life" --type kcl_portfolio',
      ],
    },
    pipeline_position: 'PRE — feeds into WIRE_DATA_IMPORT (SUPER_EXTRACT → VALIDATE → NORMALIZE → MATCH → WRITE)',
    registered_at: new Date().toISOString(),
    registered_by: 'Claude Code GA',
  }

  await db.collection('tool_registry').doc('super-extract-pdf').set(superExtractPdf)
  console.log('✓ Registered tool: SUPER_EXTRACT_PDF')

  // ─── 2. Register KCL data source ───

  const kclSource = {
    source_id: 'kcl-portal',
    name: 'Kansas City Life Insurance Portal',
    description: 'KCL agent portal (classic.kclic.net) — Playwright automation scrapes Inforce policy details in batches of 10. Each batch exports as PDF via Print All. Contains: General info, People (address/phone/SSN/beneficiaries), Values (cash/surrender/death benefit/loans), Transactions.',
    type: 'CARRIER_PORTAL',
    carrier_id: 'kansas_city_life',
    carrier_name: 'Kansas City Life',
    url: 'https://classic.kclic.net/PolicyAccess/inforce.aspx',
    method: 'Playwright browser automation',
    auth: 'JDM agent login (manual — session-based, aggressive timeout)',
    format: 'PDF (Print All → Save as PDF)',
    extraction_tool: 'super-extract-pdf',
    fields_available: [
      'policy_number', 'status', 'policy_type', 'insured_name', 'birthdate',
      'plan_name', 'plan_code', 'plan_option', 'issue_date', 'maturity_date',
      'risk_class', 'specified_amount', 'total_premiums_paid', 'policy_value',
      'mode', 'premium_billed', 'billing_status',
      'address', 'city', 'state', 'zip', 'zip4', 'phone', 'ssn_last4', 'sex', 'issue_age',
      'beneficiaries', 'cash_value', 'surrender_value', 'death_benefit',
      'loan_balance', 'net_loan_amount', 'total_transactions', 'last_transaction_date',
      'guideline_single', 'guideline_accumulation', 'cost_basis', 'dividend_value',
    ],
    scrape_workflow: [
      '1. Open classic.kclic.net, JDM logs in manually',
      '2. Navigate to Inforce > Cross Reference',
      '3. Select "All Agents of GA", search A-Z',
      '4. Check 10 boxes at a time, click "View Checked Policies"',
      '5. Click "Print All" in detail popup',
      '6. Cmd+P → Save as PDF → Downloads folder',
      '7. Repeat for all 206 policies (21 batches)',
      '8. Run SUPER_EXTRACT_PDF with --carrier "Kansas City Life" --enrich',
    ],
    first_scrape: {
      date: '2026-03-17',
      total_policies: 206,
      total_pdfs: 21,
      location: '~/Downloads/ (numbered PDFs: 1:18.pdf through 21.pdf)',
    },
    book_of_business: 'Millang Financial Group',
    agency_code: '2712S',
    agent_codes: ['91566S', '99876S', '00000S', '92308S'],
    registered_at: new Date().toISOString(),
    registered_by: 'Claude Code GA',
  }

  await db.collection('source_registry').doc('kcl-portal').set(kclSource)
  console.log('✓ Registered source: KCL Portal')

  // ─── 3. Register KCL carrier format reference ───

  const kclFormat = {
    format_id: 'kcl-portfolio-pdf',
    name: 'KCL Portfolio Detail PDF',
    description: 'Kansas City Life Print All export — multi-policy detail pages with General, People, Values, Transactions sections per policy.',
    carrier_id: 'kansas_city_life',
    carrier_name: 'Kansas City Life',
    source_type: 'pdf',
    extraction_method: 'claude_vision',
    extraction_prompt_key: 'kcl_portfolio',
    carrier_format_ts: 'KANSAS_CITY_LIFE (in carrier-formats.ts)',
    default_category: 'life',
    fingerprint: {
      type: 'pdf',
      indicators: [
        'Kansas City Life Insurance Company',
        'General Information',
        'Policy #',
        'Insured:',
        'Plan Name:',
        'Specified Amount:',
      ],
    },
    registered_at: new Date().toISOString(),
  }

  await db.collection('atlas_formats').doc('kcl-portfolio-pdf').set(kclFormat)
  console.log('✓ Registered format: KCL Portfolio PDF')

  // ─── 4. Update tool_registry with pipeline connection ───

  // Link SUPER_EXTRACT_PDF into the existing WIRE_DATA_IMPORT chain
  const wireRef = db.collection('wire_definitions').doc('WIRE_DATA_IMPORT')
  const wireSnap = await wireRef.get()
  if (wireSnap.exists) {
    const wireData = wireSnap.data()!
    const stages = wireData.stages || []
    const hasPdfStage = stages.some((s: any) => s.tool_id === 'super-extract-pdf')
    if (!hasPdfStage) {
      stages.unshift({
        order: 0,
        tool_id: 'super-extract-pdf',
        name: 'SUPER_EXTRACT_PDF',
        description: 'PDF → Structured JSON (pre-stage — runs before SUPER_EXTRACT for PDF inputs)',
        optional: true,
        condition: 'input_type === "pdf"',
      })
      await wireRef.update({ stages, updated_at: new Date().toISOString() })
      console.log('✓ Added SUPER_EXTRACT_PDF as pre-stage to WIRE_DATA_IMPORT')
    } else {
      console.log('- SUPER_EXTRACT_PDF already in WIRE_DATA_IMPORT stages')
    }
  } else {
    console.log('- WIRE_DATA_IMPORT not found — skipping pipeline linkage')
  }

  console.log('\n=== Registration Complete ===')
  console.log('\nATLAS now knows:')
  console.log('  Tool: SUPER_EXTRACT_PDF (super-extract-pdf)')
  console.log('  Source: KCL Portal (kcl-portal)')
  console.log('  Format: KCL Portfolio PDF (kcl-portfolio-pdf)')
  console.log('  Carrier: Kansas City Life (in carrier-formats.ts)')
  console.log('\nNext: Run the extraction:')
  console.log('  npx tsx services/api/src/scripts/super-extract-pdf.ts \\')
  console.log('    --dir ~/Downloads --pattern "[0-9]*.pdf" \\')
  console.log('    --carrier "Kansas City Life" --type kcl_portfolio --enrich')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
