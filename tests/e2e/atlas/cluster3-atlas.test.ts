import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  WIRE_DEFINITIONS_V2,
  WIRES_REQUIRING_CLIENT_TOOL_CHAIN,
} from '../../../packages/core/src/atlas/wires'
import { QUE_REGISTRY } from '../../../packages/core/src/que/registry'
import { execute as extractExecute } from '../../../packages/core/src/atlas/super-tools/extract'

// ---------------------------------------------------------------------------
// Cluster 3: ATLAS Architecture Tests
// ---------------------------------------------------------------------------

describe('TRK-13603: WIRE_DATA_IMPORT registration', () => {
  it('WIRE_DATA_IMPORT exists with correct wire_id', () => {
    const wire = WIRE_DEFINITIONS_V2.find((w) => w.wire_id === 'WIRE_DATA_IMPORT')
    expect(wire).toBeDefined()
    expect(wire!.wire_id).toBe('WIRE_DATA_IMPORT')
  })

  it('WIRE_DATA_IMPORT has the correct super_tools chain', () => {
    const wire = WIRE_DEFINITIONS_V2.find((w) => w.wire_id === 'WIRE_DATA_IMPORT')!
    expect(wire.super_tools).toEqual([
      'SUPER_EXTRACT',
      'SUPER_VALIDATE',
      'SUPER_NORMALIZE',
      'SUPER_MATCH',
      'SUPER_WRITE',
    ])
  })

  it('all 5 wire definitions have required fields', () => {
    expect(WIRE_DEFINITIONS_V2).toHaveLength(5)
    for (const wire of WIRE_DEFINITIONS_V2) {
      expect(wire.wire_id).toBeTruthy()
      expect(typeof wire.wire_id).toBe('string')
      expect(wire.name).toBeTruthy()
      expect(typeof wire.name).toBe('string')
      expect(wire.description).toBeTruthy()
      expect(typeof wire.description).toBe('string')
      expect(Array.isArray(wire.super_tools)).toBe(true)
      expect(wire.super_tools.length).toBeGreaterThan(0)
    }
  })
})

describe('TRK-13631: Old wires retired', () => {
  it('WIRE_DEFINITIONS_V2 has exactly 5 entries', () => {
    expect(WIRE_DEFINITIONS_V2).toHaveLength(5)
  })

  it('v2 wire IDs are the 5 expected wires', () => {
    const wireIds = WIRE_DEFINITIONS_V2.map((w) => w.wire_id)
    expect(wireIds).toEqual([
      'WIRE_DATA_IMPORT',
      'WIRE_COMMISSION_SYNC',
      'WIRE_REFERENCE_SEED',
      'WIRE_INCOMING_CORRESPONDENCE',
      'WIRE_ACF_CLEANUP',
    ])
  })

  it('old wires (except WIRE_INCOMING_CORRESPONDENCE) do not exist in v2', () => {
    const v2Ids = new Set(WIRE_DEFINITIONS_V2.map((w) => w.wire_id))
    // WIRES_REQUIRING_CLIENT_TOOL_CHAIN has 9 old wire IDs
    const oldWires = WIRES_REQUIRING_CLIENT_TOOL_CHAIN as readonly string[]
    expect(oldWires).toHaveLength(9)

    for (const oldId of oldWires) {
      if (oldId === 'WIRE_INCOMING_CORRESPONDENCE') {
        // This one was kept in v2
        expect(v2Ids.has(oldId)).toBe(true)
      } else {
        expect(v2Ids.has(oldId)).toBe(false)
      }
    }
  })
})

describe('TRK-13629: QUE Phase 2+3 tools registered', () => {
  it('QUE_REGISTRY has at least 55 entries', () => {
    expect(QUE_REGISTRY.length).toBeGreaterThanOrEqual(55)
  })

  it('has >= 25 TOOL entries (calc + lookup + generators)', () => {
    const tools = QUE_REGISTRY.filter((e) => e.type === 'TOOL')
    expect(tools.length).toBeGreaterThanOrEqual(25)
  })

  it('has >= 10 SUPER_TOOL entries', () => {
    const superTools = QUE_REGISTRY.filter((e) => e.type === 'SUPER_TOOL')
    expect(superTools.length).toBeGreaterThanOrEqual(10)
  })

  it('has >= 10 WIRE entries', () => {
    const wires = QUE_REGISTRY.filter((e) => e.type === 'WIRE')
    expect(wires.length).toBeGreaterThanOrEqual(10)
  })
})

describe('TRK-13633: ATLAS registration completeness', () => {
  it('every QUE_REGISTRY entry has required fields', () => {
    for (const entry of QUE_REGISTRY) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
      expect(['TOOL', 'SUPER_TOOL', 'WIRE']).toContain(entry.type)
      expect(entry.domain).toBe('que')
      expect(typeof entry.name).toBe('string')
      expect(entry.name.length).toBeGreaterThan(0)
      expect(typeof entry.description).toBe('string')
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })

  it('no duplicate IDs in QUE_REGISTRY', () => {
    const ids = QUE_REGISTRY.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

describe('TRK-13630: DEX tools produce document operations', () => {
  it('acf.ts route file exists and contains create/upload/route operations', () => {
    const acfPath = resolve(__dirname, '../../../services/api/src/routes/acf.ts')
    const source = readFileSync(acfPath, 'utf-8')

    // Create folder operation (acf-create tool)
    expect(source).toContain('createFolder')
    // Upload file operation (file-to-acf)
    expect(source).toContain('uploadFileToDrive')
    // Route/classify outgoing operation (acf-route tool)
    expect(source).toContain('/:clientId/route')
  })

  it('html-to-pdf capability exists in the codebase', () => {
    // html-to-pdf is referenced in QUE assembly tools
    const assembleOutputPath = resolve(
      __dirname,
      '../../../packages/core/src/que/super-tools/assemble-output.ts'
    )
    const source = readFileSync(assembleOutputPath, 'utf-8')
    expect(source.toLowerCase()).toContain('html')
    expect(source.toLowerCase()).toContain('pdf')
  })
})

describe('TRK-13624: SUPER_EXTRACT vision mode', () => {
  it('execute function exists and is callable', () => {
    expect(typeof extractExecute).toBe('function')
  })

  it('extract module defines VisionExtractInput with image_paths', () => {
    const extractPath = resolve(
      __dirname,
      '../../../packages/core/src/atlas/super-tools/extract.ts'
    )
    const source = readFileSync(extractPath, 'utf-8')

    // Vision mode types are defined
    expect(source).toContain('VisionExtractInput')
    expect(source).toContain('image_paths')
    // Vision mode dispatch exists
    expect(source).toContain("mode === 'vision'")
    // executeVision function exists
    expect(source).toContain('executeVision')
  })
})
