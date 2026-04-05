/**
 * ZRD-O14: Ranger E2E — Reference Seed Ranger
 * Verifies ranger-reference is correctly configured with WIRE_REFERENCE_SEED binding.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rangerPath = resolve(repoRoot, 'services/api/src/rangers/ranger-reference.ts')

describe('Ranger Reference Seed (ZRD-O05)', () => {
  const source = readFileSync(rangerPath, 'utf-8')

  it('binds to WIRE_REFERENCE_SEED', () => {
    expect(source).toContain("wireId: 'WIRE_REFERENCE_SEED'")
  })

  it('defines 4 super tools (skips VALIDATE)', () => {
    expect(source).toContain("'SUPER_EXTRACT'")
    expect(source).toContain("'SUPER_NORMALIZE'")
    expect(source).toContain("'SUPER_MATCH'")
    expect(source).toContain("'SUPER_WRITE'")
    // Should NOT contain SUPER_VALIDATE
    const toolsMatch = source.match(/superTools:\s*\[([^\]]+)\]/s)
    expect(toolsMatch).toBeTruthy()
    if (toolsMatch) {
      expect(toolsMatch[1]).not.toContain('SUPER_VALIDATE')
    }
  })

  it('mentions idempotent in system prompt', () => {
    expect(source.toLowerCase()).toContain('idempotent')
  })
})
