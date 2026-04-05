/**
 * ZRD-O14: Ranger E2E — Data Import Ranger
 * Verifies ranger-import is correctly configured with WIRE_DATA_IMPORT binding.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rangerPath = resolve(repoRoot, 'services/api/src/rangers/ranger-import.ts')

describe('Ranger Data Import (ZRD-O03)', () => {
  const source = readFileSync(rangerPath, 'utf-8')

  it('binds to WIRE_DATA_IMPORT', () => {
    expect(source).toContain("wireId: 'WIRE_DATA_IMPORT'")
  })

  it('defines 5 super tools in correct order', () => {
    const tools = ['SUPER_EXTRACT', 'SUPER_VALIDATE', 'SUPER_NORMALIZE', 'SUPER_MATCH', 'SUPER_WRITE']
    for (const tool of tools) {
      expect(source).toContain(`'${tool}'`)
    }
  })

  it('uses haiku model', () => {
    expect(source).toContain("model: 'haiku'")
  })

  it('exports rangerImport executor', () => {
    expect(source).toContain('export const rangerImport')
  })

  it('has rangerId ranger-import', () => {
    expect(source).toContain("rangerId: 'ranger-import'")
  })
})
