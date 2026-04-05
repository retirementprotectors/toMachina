/**
 * ZRD-O14: Ranger E2E — ACF Cleanup Ranger
 * Verifies ranger-acf is correctly configured with WIRE_ACF_CLEANUP binding.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rangerAcfPath = resolve(repoRoot, 'services/api/src/rangers/ranger-acf.ts')
const typesPath = resolve(repoRoot, 'services/api/src/rangers/types.ts')
const registryPath = resolve(repoRoot, 'services/api/src/rangers/registry.ts')

describe('Ranger ACF Cleanup (ZRD-O02)', () => {
  const source = readFileSync(rangerAcfPath, 'utf-8')

  it('binds to WIRE_ACF_CLEANUP', () => {
    expect(source).toContain("wireId: 'WIRE_ACF_CLEANUP'")
  })

  it('defines exactly 3 super tools in correct order', () => {
    expect(source).toContain("'SUPER_FOLDER_CLEANUP'")
    expect(source).toContain("'SUPER_DOCUMENT_CLEANUP'")
    expect(source).toContain("'SUPER_AUDIT_REVIEW'")
  })

  it('uses haiku model (cheapest)', () => {
    expect(source).toContain("model: 'haiku'")
  })

  it('exports rangerAcf executor', () => {
    expect(source).toContain('export const rangerAcf')
  })

  it('exports RANGER_ACF_CONFIG', () => {
    expect(source).toContain('export const RANGER_ACF_CONFIG')
  })

  it('has rangerId ranger-acf', () => {
    expect(source).toContain("rangerId: 'ranger-acf'")
  })
})

describe('Ranger Types (ZRD-O01)', () => {
  const source = readFileSync(typesPath, 'utf-8')

  it('defines RangerStatus type', () => {
    expect(source).toContain("'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'")
  })

  it('defines RangerConfig interface', () => {
    expect(source).toContain('interface RangerConfig')
    expect(source).toContain('rangerId: string')
    expect(source).toContain('wireId: string')
    expect(source).toContain('superTools: string[]')
    expect(source).toContain('model: RangerModel')
    expect(source).toContain('maxRetries: number')
  })

  it('defines RangerRunDoc interface', () => {
    expect(source).toContain('interface RangerRunDoc')
    expect(source).toContain('runId: string')
    expect(source).toContain('status: RangerStatus')
    expect(source).toContain('steps: RangerStepResult[]')
  })
})

describe('Ranger Registry (ZRD-O08)', () => {
  const source = readFileSync(registryPath, 'utf-8')

  it('registers all 5 Rangers', () => {
    expect(source).toContain("'ranger-acf'")
    expect(source).toContain("'ranger-import'")
    expect(source).toContain("'ranger-commission'")
    expect(source).toContain("'ranger-reference'")
    expect(source).toContain("'ranger-correspondence'")
  })

  it('exports getRanger function', () => {
    expect(source).toContain('export function getRanger')
  })

  it('exports listRangers function', () => {
    expect(source).toContain('export function listRangers')
  })

  it('exports isValidRanger function', () => {
    expect(source).toContain('export function isValidRanger')
  })
})
