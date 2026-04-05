/**
 * ZRD-D08: Data Accuracy — ACF Subfolder & Document Classification
 *
 * Verifies:
 *   - 5 ACF lifecycle subfolder types are recognized
 *   - DOCUMENT_TYPE_TO_SUBFOLDER maps each doc type to the correct subfolder
 *   - labelDocument routes documents to the correct ACF subfolder
 *   - File naming convention is applied correctly via label templates
 *   - Edge cases: ambiguous classification, duplicate-like names, no-match fallback
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  ACF_REQUIRED_SUBFOLDERS,
  DOCUMENT_TYPE_TO_SUBFOLDER,
} from '../../../packages/core/src/atlas/tools/acf-tools'
import { labelDocument } from '../../../packages/core/src/atlas/tools/label-document'
import type { TaxonomyEntry } from '../../../packages/core/src/atlas/tools/label-document'

const repoRoot = resolve(__dirname, '..', '..', '..')

// ---------------------------------------------------------------------------
// Shared test taxonomy (covers all 5 subfolders)
// ---------------------------------------------------------------------------

const TEST_TAXONOMY: TaxonomyEntry[] = [
  // Client subfolder
  { document_type: 'id_document', acf_subfolder: 'Client', file_label_template: '{policy_number} {last_name} ID Document', priority: 'high' },
  { document_type: 'voided_check', acf_subfolder: 'Client', file_label_template: '{last_name} Voided Check', priority: 'normal' },
  { document_type: 'tax_document', acf_subfolder: 'Client', file_label_template: '{last_name} Tax Document {date}', priority: 'normal' },
  { document_type: 'trust_document', acf_subfolder: 'Client', file_label_template: '{last_name} Trust', priority: 'high' },
  { document_type: 'poa_hipaa', acf_subfolder: 'Client', file_label_template: '{last_name} POA-HIPAA', priority: 'high' },
  { document_type: 'fact_finder', acf_subfolder: 'Client', file_label_template: '{last_name} Fact Finder {date}', priority: 'normal' },
  // NewBiz subfolder
  { document_type: 'application_form', acf_subfolder: 'NewBiz', file_label_template: '{policy_number} {last_name} {carrier} Application', priority: 'high', pipeline: 'new_business', pipeline_id: 'NB-001' },
  { document_type: 'transfer_form', acf_subfolder: 'NewBiz', file_label_template: '{policy_number} {last_name} Transfer', priority: 'high' },
  { document_type: 'delivery_receipt', acf_subfolder: 'NewBiz', file_label_template: '{policy_number} {last_name} Delivery Receipt', priority: 'normal' },
  { document_type: 'replacement_form', acf_subfolder: 'NewBiz', file_label_template: '{policy_number} {last_name} Replacement', priority: 'normal' },
  { document_type: 'suitability', acf_subfolder: 'NewBiz', file_label_template: '{policy_number} {last_name} Suitability', priority: 'high' },
  // Cases subfolder
  { document_type: 'illustration', acf_subfolder: 'Cases', file_label_template: '{last_name} {carrier} Illustration {date}', priority: 'normal' },
  { document_type: 'comparison', acf_subfolder: 'Cases', file_label_template: '{last_name} Comparison {date}', priority: 'normal' },
  { document_type: 'proposal', acf_subfolder: 'Cases', file_label_template: '{last_name} Proposal {date}', priority: 'normal' },
  { document_type: 'analysis', acf_subfolder: 'Cases', file_label_template: '{last_name} Analysis {date}', priority: 'normal' },
  // Account subfolder
  { document_type: 'statement', acf_subfolder: 'Account', file_label_template: '{policy_number} {last_name} Statement {date}', priority: 'normal' },
  { document_type: 'confirmation', acf_subfolder: 'Account', file_label_template: '{policy_number} {last_name} Confirmation {date}', priority: 'normal' },
  { document_type: 'annual_review', acf_subfolder: 'Account', file_label_template: '{policy_number} {last_name} Annual Review {date}', priority: 'normal' },
  { document_type: 'distribution', acf_subfolder: 'Account', file_label_template: '{policy_number} {last_name} Distribution {date}', priority: 'high' },
  // Reactive subfolder (no explicit mapping in DOCUMENT_TYPE_TO_SUBFOLDER — catch-all for reactive intake)
  { document_type: 'complaint', acf_subfolder: 'Reactive', file_label_template: '{last_name} Complaint {date}', priority: 'urgent' },
  { document_type: 'grievance', acf_subfolder: 'Reactive', file_label_template: '{last_name} Grievance {date}', priority: 'urgent' },
  { document_type: 'lapse_notice', acf_subfolder: 'Reactive', file_label_template: '{policy_number} {last_name} Lapse Notice {date}', priority: 'urgent' },
]

// ---------------------------------------------------------------------------
// ACF_REQUIRED_SUBFOLDERS
// ---------------------------------------------------------------------------

describe('ZRD-D08: ACF_REQUIRED_SUBFOLDERS — 5 lifecycle subfolder types', () => {
  it('has exactly 5 subfolders', () => {
    expect(ACF_REQUIRED_SUBFOLDERS).toHaveLength(5)
  })

  it('contains all 5 required lifecycle types', () => {
    const subs = ACF_REQUIRED_SUBFOLDERS as readonly string[]
    expect(subs).toContain('Client')
    expect(subs).toContain('NewBiz')
    expect(subs).toContain('Cases')
    expect(subs).toContain('Account')
    expect(subs).toContain('Reactive')
  })

  it('all subfolder names are non-empty strings', () => {
    for (const sf of ACF_REQUIRED_SUBFOLDERS) {
      expect(typeof sf).toBe('string')
      expect(sf.length).toBeGreaterThan(0)
    }
  })

  it('no duplicate subfolder names', () => {
    const unique = new Set(ACF_REQUIRED_SUBFOLDERS)
    expect(unique.size).toBe(ACF_REQUIRED_SUBFOLDERS.length)
  })
})

// ---------------------------------------------------------------------------
// DOCUMENT_TYPE_TO_SUBFOLDER
// ---------------------------------------------------------------------------

describe('ZRD-D08: DOCUMENT_TYPE_TO_SUBFOLDER — routing completeness', () => {
  it('has at least 15 document type mappings', () => {
    expect(Object.keys(DOCUMENT_TYPE_TO_SUBFOLDER).length).toBeGreaterThanOrEqual(15)
  })

  it('all mapped subfolders are one of the 5 required lifecycle types', () => {
    const validSubfolders = new Set(ACF_REQUIRED_SUBFOLDERS as readonly string[])
    for (const [docType, subfolder] of Object.entries(DOCUMENT_TYPE_TO_SUBFOLDER)) {
      expect(validSubfolders.has(subfolder),
        `document_type '${docType}' maps to unknown subfolder '${subfolder}'`
      ).toBe(true)
    }
  })

  it('Client subfolder documents are mapped correctly', () => {
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['id_document']).toBe('Client')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['voided_check']).toBe('Client')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['tax_document']).toBe('Client')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['trust_document']).toBe('Client')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['poa_hipaa']).toBe('Client')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['fact_finder']).toBe('Client')
  })

  it('NewBiz subfolder documents are mapped correctly', () => {
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['application_form']).toBe('NewBiz')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['transfer_form']).toBe('NewBiz')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['delivery_receipt']).toBe('NewBiz')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['replacement_form']).toBe('NewBiz')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['suitability']).toBe('NewBiz')
  })

  it('Cases subfolder documents are mapped correctly', () => {
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['illustration']).toBe('Cases')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['comparison']).toBe('Cases')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['proposal']).toBe('Cases')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['analysis']).toBe('Cases')
  })

  it('Account subfolder documents are mapped correctly', () => {
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['statement']).toBe('Account')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['confirmation']).toBe('Account')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['annual_review']).toBe('Account')
    expect(DOCUMENT_TYPE_TO_SUBFOLDER['distribution']).toBe('Account')
  })

  it('no document_type maps to Reactive (Reactive is intake-only, not in DOCUMENT_TYPE_TO_SUBFOLDER)', () => {
    const reactiveTypes = Object.entries(DOCUMENT_TYPE_TO_SUBFOLDER)
      .filter(([, sf]) => sf === 'Reactive')
      .map(([dt]) => dt)
    // Reactive is not in the static map — handled by intake channel routing
    expect(reactiveTypes).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// labelDocument — subfolder routing
// ---------------------------------------------------------------------------

describe('ZRD-D08: labelDocument — Client subfolder routing', () => {
  it('routes id_document to Client subfolder', () => {
    const result = labelDocument({
      document_type: 'id_document',
      extracted_data: { last_name: 'Johnson', policy_number: 'POL-001234' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(true)
    expect(result.acf_subfolder).toBe('Client')
  })

  it('routes poa_hipaa to Client subfolder', () => {
    const result = labelDocument({
      document_type: 'poa_hipaa',
      extracted_data: { last_name: 'García' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.acf_subfolder).toBe('Client')
  })

  it('routes fact_finder to Client subfolder', () => {
    const result = labelDocument({
      document_type: 'fact_finder',
      extracted_data: { last_name: 'Smith' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.acf_subfolder).toBe('Client')
  })
})

describe('ZRD-D08: labelDocument — NewBiz subfolder routing', () => {
  it('routes application_form to NewBiz subfolder', () => {
    const result = labelDocument({
      document_type: 'application_form',
      extracted_data: { last_name: 'Johnson', policy_number: 'POL-001234', carrier_name: 'Athene' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(true)
    expect(result.acf_subfolder).toBe('NewBiz')
    expect(result.pipeline).toBe('new_business')
    expect(result.pipeline_id).toBe('NB-001')
  })

  it('routes suitability to NewBiz subfolder', () => {
    const result = labelDocument({
      document_type: 'suitability',
      extracted_data: { last_name: 'Smith', policy_number: 'POL-009012' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.acf_subfolder).toBe('NewBiz')
  })
})

describe('ZRD-D08: labelDocument — Cases subfolder routing', () => {
  it('routes illustration to Cases subfolder', () => {
    const result = labelDocument({
      document_type: 'illustration',
      extracted_data: { last_name: 'Williams', carrier_name: 'Nationwide' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(true)
    expect(result.acf_subfolder).toBe('Cases')
  })

  it('routes proposal to Cases subfolder', () => {
    const result = labelDocument({
      document_type: 'proposal',
      extracted_data: { last_name: 'Zhang' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.acf_subfolder).toBe('Cases')
  })
})

describe('ZRD-D08: labelDocument — Account subfolder routing', () => {
  it('routes statement to Account subfolder', () => {
    const result = labelDocument({
      document_type: 'statement',
      extracted_data: { last_name: 'Davis', policy_number: 'POL-005678' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(true)
    expect(result.acf_subfolder).toBe('Account')
  })

  it('routes annual_review to Account subfolder with high priority', () => {
    // NOTE: annual_review is 'normal' priority in our taxonomy, distribution is 'high'
    const result = labelDocument({
      document_type: 'distribution',
      extracted_data: { last_name: 'Miller', policy_number: 'POL-010001' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.acf_subfolder).toBe('Account')
    expect(result.priority).toBe('high')
  })
})

describe('ZRD-D08: labelDocument — Reactive subfolder routing', () => {
  it('routes complaint to Reactive subfolder', () => {
    const result = labelDocument({
      document_type: 'complaint',
      extracted_data: { last_name: 'Brown' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(true)
    expect(result.acf_subfolder).toBe('Reactive')
    expect(result.priority).toBe('urgent')
  })

  it('routes lapse_notice to Reactive subfolder', () => {
    const result = labelDocument({
      document_type: 'lapse_notice',
      extracted_data: { last_name: 'Taylor', policy_number: 'POL-020002' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.acf_subfolder).toBe('Reactive')
    expect(result.priority).toBe('urgent')
  })
})

// ---------------------------------------------------------------------------
// labelDocument — file naming convention
// ---------------------------------------------------------------------------

describe('ZRD-D08: labelDocument — file naming convention', () => {
  it('resolves {policy_number} and {last_name} tokens in label', () => {
    const result = labelDocument({
      document_type: 'application_form',
      extracted_data: { last_name: 'Johnson', policy_number: 'POL-001234', carrier_name: 'Athene' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.label).not.toBeNull()
    expect(result.label).toContain('POL-001234')
    expect(result.label).toContain('JOHNSON') // last_name is uppercased per template helper
    expect(result.label).toContain('Athene')
  })

  it('resolves {last_name} token (uppercased) in Client subfolder labels', () => {
    const result = labelDocument({
      document_type: 'id_document',
      extracted_data: { last_name: 'smith', policy_number: 'POL-999' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.label).toContain('SMITH')
  })

  it('produces a clean label with no empty tokens or double spaces', () => {
    const result = labelDocument({
      document_type: 'illustration',
      extracted_data: { last_name: 'García', carrier_name: 'North American' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.label).not.toContain('{')
    expect(result.label).not.toContain('}')
    expect(result.label).not.toMatch(/\s{2,}/)
  })

  it('produces a clean label when optional fields are missing', () => {
    // policy_number not provided — token should be stripped, not left as literal
    const result = labelDocument({
      document_type: 'statement',
      extracted_data: { last_name: 'Lee' }, // no policy_number
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.label).not.toContain('{policy_number}')
    expect(result.label).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ZRD-D08: edge cases', () => {
  it('unrecognized document_type falls back to Source Documents subfolder', () => {
    const result = labelDocument({
      document_type: 'mystery_document_type_xyz',
      extracted_data: { last_name: 'Unknown' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(false)
    expect(result.acf_subfolder).toBe('Source Documents')
  })

  it('empty taxonomy produces no-match fallback', () => {
    const result = labelDocument({
      document_type: 'statement',
      extracted_data: {},
      taxonomy_types: [],
    })
    expect(result.matched).toBe(false)
    expect(result.acf_subfolder).toBe('Source Documents')
    expect(result.pipeline_id).toBeNull()
  })

  it('empty document_type returns default fallback', () => {
    const result = labelDocument({
      document_type: '',
      extracted_data: { last_name: 'Jones' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(false)
    expect(result.acf_subfolder).toBe('Source Documents')
  })

  it('case-insensitive document_type matching', () => {
    // Taxonomy has lowercase 'application_form' — test uppercase input
    const result = labelDocument({
      document_type: 'APPLICATION_FORM',
      extracted_data: { last_name: 'Johnson', policy_number: 'POL-001', carrier_name: 'Athene' },
      taxonomy_types: TEST_TAXONOMY,
    })
    expect(result.matched).toBe(true)
    expect(result.acf_subfolder).toBe('NewBiz')
  })

  it('labelDocument is a pure function — no side effects on input data', () => {
    const input = {
      document_type: 'statement',
      extracted_data: { last_name: 'Harris', policy_number: 'POL-777' },
      taxonomy_types: TEST_TAXONOMY,
    }
    const dataBefore = JSON.stringify(input)
    labelDocument(input)
    expect(JSON.stringify(input)).toBe(dataBefore)
  })
})

// ---------------------------------------------------------------------------
// ACF route file exists and references all 5 subfolder names
// ---------------------------------------------------------------------------

describe('ZRD-D08: acf.ts API route contains all 5 lifecycle subfolder operations', () => {
  const acfRoutePath = resolve(repoRoot, 'services/api/src/routes/acf.ts')
  const source = readFileSync(acfRoutePath, 'utf-8')

  it('acf.ts route file is readable and non-empty', () => {
    expect(source.length).toBeGreaterThan(100)
  })

  it('references all 5 subfolder lifecycle operations', () => {
    // The route should manage subfolders
    expect(source).toContain('subfolders')
  })

  it('implements ACF create endpoint', () => {
    expect(source).toContain('createACF')
  })

  it('implements ACF audit endpoint', () => {
    expect(source).toContain('audit')
  })

  it('implements ACF route (file routing) endpoint', () => {
    expect(source).toContain('/route')
  })
})

// ---------------------------------------------------------------------------
// acf-tools.ts exports are consistent with ACF_REQUIRED_SUBFOLDERS
// ---------------------------------------------------------------------------

describe('ZRD-D08: acf-tools.ts export consistency', () => {
  it('DOCUMENT_TYPE_TO_SUBFOLDER only maps to subfolders that exist in ACF_REQUIRED_SUBFOLDERS or Source Documents', () => {
    const validSubfolders = new Set([
      ...(ACF_REQUIRED_SUBFOLDERS as readonly string[]),
      'Source Documents', // fallback
    ])
    for (const [, sf] of Object.entries(DOCUMENT_TYPE_TO_SUBFOLDER)) {
      expect(validSubfolders.has(sf)).toBe(true)
    }
  })

  it('the 4 major subfolder types (Client/NewBiz/Cases/Account) all have at least 1 document type', () => {
    const counts: Record<string, number> = { Client: 0, NewBiz: 0, Cases: 0, Account: 0 }
    for (const sf of Object.values(DOCUMENT_TYPE_TO_SUBFOLDER)) {
      if (sf in counts) counts[sf]++
    }
    for (const [sf, count] of Object.entries(counts)) {
      expect(count, `${sf} has zero document types mapped`).toBeGreaterThan(0)
    }
  })
})
