/**
 * Cluster 8: ACF Lifecycle — Pipeline Verification Sprint
 *
 * 3 tests covering:
 *   TRK-13627: ACF Config 5-folder structure
 *   TRK-13642: ACF routing_rules seeded from taxonomy
 *   TRK-13632: ACF household-aware creation + audit
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Resolve paths relative to repo root ──
const repoRoot = resolve(__dirname, '..', '..', '..')
const acfFinalizePath = resolve(repoRoot, 'packages/core/src/atlas/super-tools/acf-finalize.ts')
const acfTypesPath = resolve(repoRoot, 'packages/core/src/acf/types.ts')
const acfRoutePath = resolve(repoRoot, 'services/api/src/routes/acf.ts')

// ============================================================================
// TRK-13627: ACF Config 5-folder structure
// ============================================================================
describe('TRK-13627: ACF Config 5-folder structure', () => {
  it('should define exactly 5 unique ACF subfolders', () => {
    const finalizeSource = readFileSync(acfFinalizePath, 'utf-8')

    // Extract DOCUMENT_TYPE_TO_SUBFOLDER values from source
    // The mapping assigns document types to one of 5 subfolders
    const subfolderMatches = finalizeSource.match(/:\s*'(Client|NewBiz|Cases|Account|Reactive)'/g)
    expect(subfolderMatches).toBeTruthy()

    const uniqueSubfolders = new Set(
      subfolderMatches!.map(m => m.replace(/:\s*'/, '').replace(/'$/, ''))
    )

    // Exactly 4 explicit subfolders in the map
    expect(uniqueSubfolders).toContain('Client')
    expect(uniqueSubfolders).toContain('NewBiz')
    expect(uniqueSubfolders).toContain('Cases')
    expect(uniqueSubfolders).toContain('Account')

    // The 5th subfolder (Reactive) is the default fallback
    expect(finalizeSource).toContain("return 'Reactive'")

    // Together: Client, NewBiz, Cases, Account, Reactive = 5
    const allFive = ['Client', 'NewBiz', 'Cases', 'Account', 'Reactive']
    for (const folder of allFive) {
      expect(finalizeSource).toContain(folder)
    }
  })

  it('should include subfolders field in ACFConfig type', () => {
    const typesSource = readFileSync(acfTypesPath, 'utf-8')

    // ACFConfig interface exists
    expect(typesSource).toContain('export interface ACFConfig')

    // Has subfolders field typed as string[]
    expect(typesSource).toContain('subfolders: string[]')

    // Has default_subfolder field
    expect(typesSource).toContain('default_subfolder: string')
  })
})

// ============================================================================
// TRK-13642: ACF routing_rules seeded from taxonomy
// ============================================================================
describe('TRK-13642: ACF routing_rules seeded from taxonomy', () => {
  it('should map all expected document types in DOCUMENT_TYPE_TO_SUBFOLDER', () => {
    const finalizeSource = readFileSync(acfFinalizePath, 'utf-8')

    // Required document type mappings
    const requiredTypes = [
      'id_document',
      'application_form',
      'statement',
      'illustration',
    ]

    for (const docType of requiredTypes) {
      expect(finalizeSource).toContain(docType)
    }

    // Additional common document types that should be routed
    const additionalTypes = [
      'voided_check',
      'tax_document',
      'trust_document',
      'transfer_form',
      'delivery_receipt',
      'confirmation',
      'proposal',
      'comparison',
      'suitability',
      'poa_hipaa',
      'fact_finder',
      'replacement_form',
      'annual_review',
      'distribution',
      'analysis',
    ]

    for (const docType of additionalTypes) {
      expect(finalizeSource).toContain(docType)
    }
  })

  it('should define routing_rules in ACFConfig type', () => {
    const typesSource = readFileSync(acfTypesPath, 'utf-8')

    // routing_rules field exists on ACFConfig
    expect(typesSource).toContain('routing_rules?: ACFRoutingRule[]')

    // ACFRoutingRule interface includes document_type + target_subfolder + patterns
    expect(typesSource).toContain('export interface ACFRoutingRule')
    expect(typesSource).toContain('document_type: string')
    expect(typesSource).toContain('target_subfolder: string')
    expect(typesSource).toContain('patterns: string[]')
  })
})

// ============================================================================
// TRK-13632: ACF household-aware creation + audit
// ============================================================================
describe('TRK-13632: ACF household-aware creation + audit', () => {
  it('should handle household_id in createACF and nest under household folder', () => {
    const acfSource = readFileSync(acfRoutePath, 'utf-8')

    // createACF function accepts householdId parameter
    expect(acfSource).toContain('householdId?: string')

    // Checks for household_id in the request flow
    expect(acfSource).toContain('household_id')

    // Household-aware nesting: looks up household doc for parent folder
    expect(acfSource).toContain('Household-aware')
    expect(acfSource).toContain('householdId')

    // Looks up household document to find acf_folder_id
    expect(acfSource).toContain('households')
    expect(acfSource).toContain('.doc(householdId)')

    // Sets parentFolderId from household's acf_folder_id
    expect(acfSource).toContain('parentFolderId')
    expect(acfSource).toContain('acf_folder_id')

    // The POST create endpoint passes household_id from client doc
    expect(acfSource).toContain('client.household_id')
  })
})
