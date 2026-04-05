/**
 * ZRD-O14: Ranger E2E — Correspondence Ranger
 * Verifies ranger-correspondence is correctly configured with WIRE_INCOMING_CORRESPONDENCE.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rangerPath = resolve(repoRoot, 'services/api/src/rangers/ranger-correspondence.ts')

describe('Ranger Correspondence (ZRD-O06)', () => {
  const source = readFileSync(rangerPath, 'utf-8')

  it('binds to WIRE_INCOMING_CORRESPONDENCE', () => {
    expect(source).toContain("wireId: 'WIRE_INCOMING_CORRESPONDENCE'")
  })

  it('defines all 8 super tools including ACF_FINALIZE', () => {
    const tools = [
      'SUPER_PREPARE', 'SUPER_CLASSIFY', 'SUPER_EXTRACT', 'SUPER_VALIDATE',
      'SUPER_NORMALIZE', 'SUPER_MATCH', 'SUPER_WRITE', 'ACF_FINALIZE',
    ]
    for (const tool of tools) {
      expect(source).toContain(`'${tool}'`)
    }
  })

  it('uses sonnet model (Vision tasks need it)', () => {
    expect(source).toContain("model: 'sonnet'")
  })

  it('has maxRetries of 1 (no retry on classification)', () => {
    expect(source).toContain('maxRetries: 1')
  })

  it('mentions server-only requirement', () => {
    expect(source.toLowerCase()).toContain('server-only')
  })
})
