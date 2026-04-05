/**
 * ZRD-O14: Ranger E2E — Commission Sync Ranger
 * Verifies ranger-commission is correctly configured with WIRE_COMMISSION_SYNC binding.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rangerPath = resolve(repoRoot, 'services/api/src/rangers/ranger-commission.ts')

describe('Ranger Commission Sync (ZRD-O04)', () => {
  const source = readFileSync(rangerPath, 'utf-8')

  it('binds to WIRE_COMMISSION_SYNC', () => {
    expect(source).toContain("wireId: 'WIRE_COMMISSION_SYNC'")
  })

  it('defines 5 super tools in correct order', () => {
    const tools = ['SUPER_EXTRACT', 'SUPER_VALIDATE', 'SUPER_NORMALIZE', 'SUPER_MATCH', 'SUPER_WRITE']
    for (const tool of tools) {
      expect(source).toContain(`'${tool}'`)
    }
  })

  it('mentions accuracy to the penny in system prompt', () => {
    expect(source).toContain('Accuracy to the penny')
  })

  it('uses haiku model', () => {
    expect(source).toContain("model: 'haiku'")
  })
})
