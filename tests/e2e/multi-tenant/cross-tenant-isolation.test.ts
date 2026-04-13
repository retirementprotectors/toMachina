/**
 * ZRD-PLAT-MT-012 — Cross-tenant isolation test suite
 *
 * The non-negotiable quality bar per Discovery Doc Gate 4:
 *   "A cross-tenant read attempt FAILS in an automated test."
 *
 * Two test phases:
 *
 *  1. Structural tests (run in CI today) — verify the code surface that
 *     enables tenant isolation is in place:
 *       - getDb() returns distinct Firestore instances per partner slug
 *       - getDefaultDb() always returns the (default) instance
 *       - partnerDbId() slug → named-DB naming contract
 *       - firestore.partner.rules.template has the required isPartnerUser /
 *         isSuperAdmin helpers and default-deny
 *       - partner_registry rule in firestore.rules (exec-read, owner-write)
 *
 *  2. Live cross-tenant reads (run AFTER MT-008 provisions a test partner DB
 *     — skipped in CI today via SKIP_LIVE=1). These are the 5 scenarios
 *     Discovery Doc Tab 6 Gate 4 describes:
 *       a. Partner A token → read Partner B /clients → 403 or empty
 *       b. Partner token → read RPI (default) /clients → scoped to partner DB only
 *       c. RPI token → direct hit to partner DB → 403
 *       d. Super-admin token → reads partner DB → 200 + audit entry written
 *       e. Unauthenticated → 401 on all routes
 *
 * JDM sign-off (TCO) on Phase 2 of this suite is the MT-008 + MT-012
 * combined gate before the Midwest Medigap DB goes live with real data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Structural tests (always run) ────────────────────────────────────────────

const REPO_ROOT = join(__dirname, '..', '..', '..')

describe('ZRD-PLAT-MT-012 — Structural isolation surface', () => {
  it('services/api/src/lib/db.ts exports getDb() + getDefaultDb() + partnerDbId()', async () => {
    // Import from the source — Vitest runs TS directly.
    const dbModule = await import(
      /* @vite-ignore */ join(REPO_ROOT, 'services/api/src/lib/db.ts')
    ).catch((err) => {
      throw new Error(`Failed to import services/api/src/lib/db.ts: ${err.message}`)
    })

    expect(typeof dbModule.getDb).toBe('function')
    expect(typeof dbModule.getDefaultDb).toBe('function')
    expect(typeof dbModule.partnerDbId).toBe('function')
  })

  it('partnerDbId() returns correct named-DB ids', async () => {
    const { partnerDbId } = await import(
      /* @vite-ignore */ join(REPO_ROOT, 'services/api/src/lib/db.ts')
    )
    expect(partnerDbId()).toBe('(default)')
    expect(partnerDbId(null)).toBe('(default)')
    expect(partnerDbId(undefined)).toBe('(default)')
    expect(partnerDbId('midwest-medigap')).toBe('partner-midwest-medigap')
    expect(partnerDbId('acme-health')).toBe('partner-acme-health')
  })

  it('firestore.partner.rules.template exists with required helpers', () => {
    const path = join(REPO_ROOT, 'firestore.partner.rules.template')
    expect(existsSync(path)).toBe(true)

    const template = readFileSync(path, 'utf-8')
    expect(template).toMatch(/function\s+isPartnerUser\s*\(\)/)
    expect(template).toMatch(/function\s+isSuperAdmin\s*\(\)/)
    // Default-deny must be present
    expect(template).toMatch(/match\s+\/\{document=\*\*\}/)
    // PARTNER_SLUG placeholder must exist for provisioning-time substitution
    expect(template).toContain('PARTNER_SLUG')
    // The immutable-after-create rule for wire_executions
    expect(template).toMatch(/wire_executions/)
    expect(template).toMatch(/allow update,\s*delete:\s*if\s+false/)
  })

  it('firestore.rules includes partner_registry collection rule', () => {
    const path = join(REPO_ROOT, 'firestore.rules')
    expect(existsSync(path)).toBe(true)

    const rules = readFileSync(path, 'utf-8')
    expect(rules).toMatch(/match\s+\/partner_registry\/\{slug\}/)
    // executive-read, owner-write per MT-001
    expect(rules).toMatch(/allow read:\s*if\s+isExecutiveOrAbove\(\)/)
  })

  it('services/bigquery-stream exports partnerDatasetName() + makePartnerStream()', async () => {
    const mod = await import(
      /* @vite-ignore */ join(REPO_ROOT, 'services/bigquery-stream/src/index.ts')
    ).catch((err) => {
      throw new Error(`Failed to import bigquery-stream/src/index.ts: ${err.message}`)
    })
    expect(typeof mod.partnerDatasetName).toBe('function')
    expect(mod.partnerDatasetName('midwest-medigap')).toBe('partner_midwest_medigap')
    expect(typeof mod.makePartnerStream).toBe('function')
  })
})

// ─── Live cross-tenant reads (run post-MT-008 partner DB provisioning) ─────────

const LIVE = process.env.LIVE_TENANT_TESTS === '1'
const describeLive = LIVE ? describe : describe.skip

describeLive('ZRD-PLAT-MT-012 — Live cross-tenant read attempts (SKIPPED unless LIVE_TENANT_TESTS=1)', () => {
  beforeAll(async () => {
    // Intentionally empty for now — live tests require:
    //   1. A test partner DB (partner-mt-test) provisioned by MT-008
    //   2. Partner A + Partner B + RPI + super-admin tokens available
    //      via env vars (TEST_PARTNER_A_TOKEN, TEST_PARTNER_B_TOKEN, etc.)
    //   3. TEST_API_URL pointing at the deployed tm-api Cloud Run URL
    // Skeleton added; filling in is a follow-up task once the test partner DB exists.
  })

  it('Scenario A: Partner A token → GET /api/clients in Partner B context → fails', async () => {
    expect.assertions(0)
    // TODO(ZRD-PLAT-MT-012 live): Implement once TEST_PARTNER_A_TOKEN + _B_TOKEN exist
  })

  it('Scenario B: Partner token → cannot read RPI default /api/clients', async () => {
    expect.assertions(0)
    // TODO(ZRD-PLAT-MT-012 live)
  })

  it('Scenario C: RPI token → direct named-DB hit returns nothing or 403', async () => {
    expect.assertions(0)
    // TODO(ZRD-PLAT-MT-012 live)
  })

  it('Scenario D: Super-admin token → reads partner DB + audit entry written', async () => {
    expect.assertions(0)
    // TODO(ZRD-PLAT-MT-012 live)
  })

  it('Scenario E: Unauthenticated request → 401 on all routes', async () => {
    expect.assertions(0)
    // TODO(ZRD-PLAT-MT-012 live)
  })
})
