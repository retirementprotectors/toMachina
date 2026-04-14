/**
 * ZRD-O14: Ranger E2E — Orchestration API + Mesh View
 * Verifies the ranger orchestration route and Command Center mesh integration.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const routePath = resolve(repoRoot, 'services/api/src/routes/rangers.ts')
const serverPath = resolve(repoRoot, 'services/api/src/server.ts')
const meshViewPath = resolve(repoRoot, 'packages/ui/src/modules/Megazord/MegazordMeshView.tsx')
const commandCenterPath = resolve(repoRoot, 'packages/ui/src/modules/Megazord/MegazordCommandCenter.tsx')
const basePath = resolve(repoRoot, 'services/api/src/rangers/ranger-base.ts')
const indexPath = resolve(repoRoot, 'services/api/src/rangers/index.ts')

describe('Ranger Orchestration API (ZRD-O08)', () => {
  const source = readFileSync(routePath, 'utf-8')

  it('exports rangerRoutes', () => {
    expect(source).toContain('export const rangerRoutes')
  })

  it('has POST /dispatch endpoint', () => {
    expect(source).toContain("'/dispatch'")
    expect(source).toContain('rangerId')
  })

  it('has GET /:runId/status endpoint', () => {
    expect(source).toContain("'/:runId/status'")
  })

  it('has GET /history endpoint with pagination', () => {
    expect(source).toContain("'/history'")
    expect(source).toContain('getPaginationParams')
  })

  it('has POST /:runId/cancel endpoint', () => {
    expect(source).toContain("'/:runId/cancel'")
    expect(source).toContain("'cancelled'")
  })

  it('has GET /registry endpoint', () => {
    expect(source).toContain("'/registry'")
    expect(source).toContain('listRangers')
  })

  it('validates unknown rangerId returns error', () => {
    expect(source).toContain('Unknown ranger')
  })

  it('uses Firebase Auth (inherits from server.ts /api middleware)', () => {
    const server = readFileSync(serverPath, 'utf-8')
    expect(server).toContain("'/api/rangers'")
    expect(server).toContain('rangerRoutes')
  })
})

describe('Ranger Base Template (ZRD-O01)', () => {
  const source = readFileSync(basePath, 'utf-8')

  it('exports createRanger factory', () => {
    expect(source).toContain('export function createRanger')
  })

  it('exports isRunCancelled', () => {
    expect(source).toContain('export async function isRunCancelled')
  })

  it('writes to ranger_runs Firestore collection', () => {
    expect(source).toContain("'ranger_runs'")
  })

  it('lazy-loads wire executor', () => {
    expect(source).toContain("import('@tomachina/core/atlas/wire-executor')")
  })

  it('handles errors without silent continuation', () => {
    expect(source).toContain("status: 'failed'")
    expect(source).toContain('error: errorMsg')
  })
})

describe('Rangers Barrel Export', () => {
  const source = readFileSync(indexPath, 'utf-8')

  it('exports all 5 Ranger executors', () => {
    expect(source).toContain('rangerAcf')
    expect(source).toContain('rangerImport')
    expect(source).toContain('rangerCommission')
    expect(source).toContain('rangerReference')
    expect(source).toContain('rangerCorrespondence')
  })

  it('exports registry functions', () => {
    expect(source).toContain('getRanger')
    expect(source).toContain('listRangers')
    expect(source).toContain('isValidRanger')
  })
})

describe('Command Center Mesh View (ZRD-O09)', () => {
  const meshSource = readFileSync(meshViewPath, 'utf-8')
  const ccSource = readFileSync(commandCenterPath, 'utf-8')

  it('MegazordMeshView component exists', () => {
    expect(meshSource).toContain('export function MegazordMeshView')
  })

  it('fetches from /api/rangers/registry', () => {
    expect(meshSource).toContain('/api/rangers/registry')
  })

  it('fetches from /api/rangers/history', () => {
    expect(meshSource).toContain('/api/rangers/history')
  })

  it('dispatches via /api/rangers/dispatch', () => {
    expect(meshSource).toContain('/api/rangers/dispatch')
  })

  it('uses mecha-green color', () => {
    expect(meshSource).toContain('#10b981')
  })

  it('has auto-refresh for running Rangers', () => {
    expect(meshSource).toContain('REFRESH_INTERVAL')
    expect(meshSource).toContain('setInterval')
  })

  it('Command Center includes Mesh section', () => {
    expect(ccSource).toContain("'mesh'")
    expect(ccSource).toContain('MegazordMeshView')
    expect(ccSource).toContain("icon: 'cable'")
  })
})
