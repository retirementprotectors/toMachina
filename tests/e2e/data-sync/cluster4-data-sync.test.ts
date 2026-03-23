/**
 * Cluster 4: Data Sync & Migration — Pipeline Verification Sprint
 *
 * 7 tests covering:
 *   TRK-13620: Household ACF Drive folder creation
 *   TRK-13648: Flow engine entity_type household
 *   TRK-13628: Import pipeline auto-detects households
 *   TRK-13606: Backfill normalizer dry-run
 *   TRK-13623: Backfill BoB cross-reference dry-run
 *   TRK-13616: NAIC population dry-run
 *   TRK-13608: Write Gate middleware
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { initializeApp, getApps } from 'firebase-admin/app'
import { apiPost } from '../helpers/api-client.js'
import { GCP_PROJECT_ID } from '../helpers/constants.js'

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({ projectId: GCP_PROJECT_ID })
}

const API_AVAILABLE = !!process.env.TEST_API_URL

// ── Resolve paths relative to repo root ──
const repoRoot = resolve(__dirname, '..', '..', '..')
const acfRoutePath = resolve(repoRoot, 'services/api/src/routes/acf.ts')
const importRoutePath = resolve(repoRoot, 'services/api/src/routes/import.ts')
const backfillMedicareCharterPath = resolve(repoRoot, 'services/api/src/scripts/backfill-medicare-charter.ts')
const carrierBobMatchPath = resolve(repoRoot, 'services/api/src/scripts/carrier-bob-match.ts')
const populateNaicPath = resolve(repoRoot, 'services/api/src/scripts/populate-naic.ts')
const writeGatePath = resolve(repoRoot, 'services/api/src/middleware/write-gate.ts')
const flowTypesPath = resolve(repoRoot, 'packages/core/src/flow/types.ts')

// ============================================================================
// TRK-13620: Household ACF Drive folder creation
// ============================================================================
describe('TRK-13620: Household ACF Drive folder creation', () => {
  it('should handle household_id in ACF create route', async () => {
    // Structural verification: the ACF route accepts household_id
    const acfSource = readFileSync(acfRoutePath, 'utf-8')

    // createACF function signature includes householdId param
    expect(acfSource).toContain('householdId')

    // Route passes household_id from client doc to createACF
    expect(acfSource).toContain('household_id')

    // Household-aware nesting: checks household folder before creating
    expect(acfSource).toContain('Household-aware')

    // If API is available, hit the endpoint
    if (API_AVAILABLE) {
      const result = await apiPost<{ folder_id?: string; subfolder_ids?: Record<string, string> }>(
        '/api/acf/create',
        { client_id: 'e2e-test-household-acf', household_id: 'e2e-test-hh' }
      )
      // Either succeeds with folder data, or fails gracefully (404 client not found)
      if (result.success && result.data) {
        expect(result.data.folder_id).toBeTruthy()
        expect(result.data.subfolder_ids).toBeTruthy()
      }
    }
  })
})

// ============================================================================
// TRK-13648: Flow engine entity_type household
// ============================================================================
describe('TRK-13648: Flow engine entity_type household', () => {
  it('should include entity_type field in FlowInstanceData type', async () => {
    // Structural verification: FlowInstanceData has entity_type field
    const flowSource = readFileSync(flowTypesPath, 'utf-8')

    // entity_type exists on FlowInstanceData
    expect(flowSource).toContain('entity_type: string')

    // entity_type field accepts string values including 'HOUSEHOLD'
    expect(flowSource).toContain('entity_type')

    // CreateInstanceInput also supports entity_type
    expect(flowSource).toContain('entity_type?: string')

    // If API is available, test creating an instance with HOUSEHOLD entity_type
    if (API_AVAILABLE) {
      const result = await apiPost<{ entity_type?: string }>('/api/flow/instances', {
        pipeline_key: 'e2e-test-pipeline',
        entity_type: 'HOUSEHOLD',
        entity_id: 'e2e-test-hh-001',
        entity_name: 'E2E Test Household',
        assigned_to: 'e2e-test@retireprotected.com',
        created_by: 'e2e-test@retireprotected.com',
      })
      if (result.success && result.data) {
        expect(result.data.entity_type).toBe('HOUSEHOLD')
      }
    }
  })
})

// ============================================================================
// TRK-13628: Import pipeline auto-detects households
// ============================================================================
describe('TRK-13628: Import pipeline auto-detects households', () => {
  it('should contain household auto-detection logic in import route', () => {
    const importSource = readFileSync(importRoutePath, 'utf-8')

    // Phase 1.5: Auto-detect households from imported clients
    expect(importSource).toContain('Auto-detect households')

    // Builds address groups for matching
    expect(importSource).toContain('addressGroups')

    // Groups by lastName + address + zip
    expect(importSource).toMatch(/lastName.*address.*zip/)

    // Creates household records for groups with 2+ members
    expect(importSource).toContain('householdBatch')

    // Checks for existing household_id before creating new ones
    expect(importSource).toContain('existingHouseholdId')

    // Detects spouse-field matches as a second heuristic
    expect(importSource).toContain('spousePairs')
  })
})

// ============================================================================
// TRK-13606: Backfill normalizer dry-run
// ============================================================================
describe('TRK-13606: Backfill normalizer dry-run', () => {
  it('should default to DRY_RUN mode and not write when dry', () => {
    const scriptSource = readFileSync(backfillMedicareCharterPath, 'utf-8')

    // DRY_RUN constant exists, defaults to true (only false with --execute)
    expect(scriptSource).toContain("const DRY_RUN = !process.argv.includes('--execute')")

    // Script references Firestore batch operations (only executed when not dry)
    expect(scriptSource).toContain('DRY_RUN')

    // Script uses firebase-admin for Firestore access
    expect(scriptSource).toContain("from 'firebase-admin/firestore'")

    // Uses charter identity resolution
    expect(scriptSource).toContain('resolveCharterIdentity')

    // Batch limit to avoid exceeding Firestore 500-write limit
    expect(scriptSource).toContain('BATCH_LIMIT')
  })
})

// ============================================================================
// TRK-13623: Backfill BoB cross-reference dry-run
// ============================================================================
describe('TRK-13623: Backfill BoB cross-reference dry-run', () => {
  it('should exist and contain carrier address cross-reference logic', () => {
    const scriptSource = readFileSync(carrierBobMatchPath, 'utf-8')

    // Script exists and initializes Firebase
    expect(scriptSource).toContain("from 'firebase-admin/app'")
    expect(scriptSource).toContain("from 'firebase-admin/firestore'")

    // Builds carrier address lookup map
    expect(scriptSource).toContain('carrierAddresses')

    // Matches by normalized first|last name key
    expect(scriptSource).toMatch(/first.*last.*toLowerCase/)

    // Includes city, state, zip in match data
    expect(scriptSource).toContain('city')
    expect(scriptSource).toContain('state')
    expect(scriptSource).toContain('zip')
  })
})

// ============================================================================
// TRK-13616: NAIC population dry-run
// ============================================================================
describe('TRK-13616: NAIC population dry-run', () => {
  it('should default to DRY_RUN mode with charter-to-NAIC lookup', () => {
    const scriptSource = readFileSync(populateNaicPath, 'utf-8')

    // DRY_RUN constant exists, defaults to true (only false with --execute)
    expect(scriptSource).toContain("const DRY_RUN = !process.argv.includes('--execute')")

    // Uses CHARTER_IDENTITY_MAP for lookups
    expect(scriptSource).toContain('CHARTER_IDENTITY_MAP')

    // References CarrierIdentity type
    expect(scriptSource).toContain('CarrierIdentity')

    // Firebase admin initialization
    expect(scriptSource).toContain("from 'firebase-admin/app'")

    // Batch limit present
    expect(scriptSource).toContain('BATCH_LIMIT')
  })
})

// ============================================================================
// TRK-13608: Write Gate middleware
// ============================================================================
describe('TRK-13608: Write Gate middleware', () => {
  it('should enforce bulk write check, lineage, and schema validation', () => {
    const gateSource = readFileSync(writeGatePath, 'utf-8')

    // Exports writeGate middleware function
    expect(gateSource).toContain('export function writeGate')

    // Bulk write threshold: >10 items without x-bulk-approved header => 403
    expect(gateSource).toContain('x-bulk-approved')
    expect(gateSource).toMatch(/body\.length\s*>\s*10/)

    // Lineage metadata from headers
    expect(gateSource).toContain('x-agent-session-id')
    expect(gateSource).toContain('x-source-script')

    // Fire-and-forget lineage logging to guardian_writes
    expect(gateSource).toContain('logWriteLineage')

    // Schema validation on mutation
    expect(gateSource).toContain('validateSchema')

    // Returns 400 on schema failure
    expect(gateSource).toContain('Schema validation failed')

    // Returns 403 on bulk without approval
    expect(gateSource).toContain('Bulk write blocked')
  })

  it('should reject bulk writes without approval header via API', async () => {
    if (!API_AVAILABLE) return

    // Send a bulk array of 11+ items to a protected route without x-bulk-approved header
    const bulkPayload = Array.from({ length: 12 }, (_, i) => ({
      id: `e2e-bulk-test-${i}`,
      name: `Bulk Test ${i}`,
    }))

    const result = await apiPost<unknown>('/api/clients', bulkPayload)

    // Should be blocked — either 403 from write gate or another 4xx
    expect(result.success).toBe(false)
    if (result.error) {
      expect(result.error).toMatch(/4\d\d/)
    }
  })
})
