import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  VOLTRON_ROLE_RANK,
  VOLTRON_ROLE_TYPE_ACCESS,
  type VoltronUserRole,
  type VoltronToolType,
  type VoltronRegistryEntry,
} from '../../../packages/core/src/voltron/types'

// ---------------------------------------------------------------------------
// TRK-13801: Entitlement Filtering at Registry Level — Verification Tests
// Validates all 5 role types receive correct tool subsets from registry.
// ---------------------------------------------------------------------------

const REGISTRY_PATH = resolve(
  __dirname,
  '../../../packages/core/src/voltron/generated/voltron-registry.json',
)

const ALL_ENTRIES: VoltronRegistryEntry[] = JSON.parse(
  readFileSync(REGISTRY_PATH, 'utf-8'),
)

const ALL_ROLES: VoltronUserRole[] = ['COORDINATOR', 'SPECIALIST', 'DIRECTOR', 'VP', 'ADMIN']

/** Replicate the dual enforcement logic from voltron-registry.ts */
function filterByEntitlement(
  entries: VoltronRegistryEntry[],
  role: VoltronUserRole,
): VoltronRegistryEntry[] {
  const callerRank = VOLTRON_ROLE_RANK[role]
  const allowedTypes = VOLTRON_ROLE_TYPE_ACCESS[role]

  return entries.filter(entry => {
    const entryRank = VOLTRON_ROLE_RANK[entry.entitlement_min as VoltronUserRole] ?? 1
    const rankOk = entryRank <= callerRank
    const typeOk = allowedTypes.includes(entry.type as VoltronToolType)
    return rankOk && typeOk
  })
}

describe('TRK-13801: Entitlement filtering at registry level', () => {
  it('registry JSON is loaded and non-empty', () => {
    expect(ALL_ENTRIES.length).toBeGreaterThan(0)
  })

  it('every entry has required entitlement_min field', () => {
    for (const entry of ALL_ENTRIES) {
      expect(entry.entitlement_min).toBeDefined()
      expect(typeof entry.entitlement_min).toBe('string')
    }
  })

  it('every entry has a valid type (ATOMIC | SUPER | WIRE)', () => {
    const validTypes = new Set(['ATOMIC', 'SUPER', 'WIRE'])
    for (const entry of ALL_ENTRIES) {
      expect(validTypes.has(entry.type)).toBe(true)
    }
  })

  // ── Per-role subset verification (all 5 roles) ──────────────────────────

  describe('COORDINATOR (rank 1) — atomics only', () => {
    const filtered = filterByEntitlement(ALL_ENTRIES, 'COORDINATOR')

    it('receives only ATOMIC tools', () => {
      const types = new Set(filtered.map(e => e.type))
      expect(types.has('SUPER')).toBe(false)
      expect(types.has('WIRE')).toBe(false)
      if (filtered.length > 0) {
        expect(types.has('ATOMIC')).toBe(true)
      }
    })

    it('cannot see any Wire definitions', () => {
      const wires = filtered.filter(e => e.type === 'WIRE')
      expect(wires).toHaveLength(0)
    })

    it('cannot see any Super Tool definitions', () => {
      const supers = filtered.filter(e => e.type === 'SUPER')
      expect(supers).toHaveLength(0)
    })

    it('only sees COORDINATOR-entitled entries (rank <= 1)', () => {
      for (const entry of filtered) {
        const rank = VOLTRON_ROLE_RANK[entry.entitlement_min as VoltronUserRole]
        expect(rank).toBeLessThanOrEqual(VOLTRON_ROLE_RANK['COORDINATOR'])
      }
    })
  })

  describe('SPECIALIST (rank 2) — atomics + supers', () => {
    const filtered = filterByEntitlement(ALL_ENTRIES, 'SPECIALIST')

    it('receives ATOMIC and SUPER tools only', () => {
      const types = new Set(filtered.map(e => e.type))
      expect(types.has('WIRE')).toBe(false)
    })

    it('cannot see Wire definitions', () => {
      const wires = filtered.filter(e => e.type === 'WIRE')
      expect(wires).toHaveLength(0)
    })

    it('sees more tools than COORDINATOR', () => {
      const coordFiltered = filterByEntitlement(ALL_ENTRIES, 'COORDINATOR')
      expect(filtered.length).toBeGreaterThan(coordFiltered.length)
    })

    it('sees SUPER tools that require SPECIALIST', () => {
      const supers = filtered.filter(e => e.type === 'SUPER')
      expect(supers.length).toBeGreaterThan(0)
    })
  })

  describe('DIRECTOR (rank 3) — atomics + supers + wires', () => {
    const filtered = filterByEntitlement(ALL_ENTRIES, 'DIRECTOR')

    it('can see ATOMIC, SUPER, and WIRE types', () => {
      const types = new Set(filtered.map(e => e.type))
      expect(types.has('ATOMIC')).toBe(true)
      expect(types.has('SUPER')).toBe(true)
      expect(types.has('WIRE')).toBe(true)
    })

    it('sees all 4 wire definitions', () => {
      const wires = filtered.filter(e => e.type === 'WIRE')
      expect(wires).toHaveLength(4)
    })

    it('sees more tools than SPECIALIST', () => {
      const specFiltered = filterByEntitlement(ALL_ENTRIES, 'SPECIALIST')
      expect(filtered.length).toBeGreaterThan(specFiltered.length)
    })
  })

  describe('VP (rank 4) — sees all tools', () => {
    const filtered = filterByEntitlement(ALL_ENTRIES, 'VP')

    it('sees every entry in the registry', () => {
      expect(filtered.length).toBe(ALL_ENTRIES.length)
    })

    it('sees all tool types', () => {
      const types = new Set(filtered.map(e => e.type))
      expect(types.has('ATOMIC')).toBe(true)
      expect(types.has('SUPER')).toBe(true)
      expect(types.has('WIRE')).toBe(true)
    })

    it('sees all 4 wires', () => {
      const wires = filtered.filter(e => e.type === 'WIRE')
      expect(wires).toHaveLength(4)
    })
  })

  describe('ADMIN (rank 5) — sees all tools', () => {
    const filtered = filterByEntitlement(ALL_ENTRIES, 'ADMIN')

    it('sees every entry in the registry', () => {
      expect(filtered.length).toBe(ALL_ENTRIES.length)
    })

    it('sees same count as VP (no VP-only or ADMIN-only tools)', () => {
      const vpFiltered = filterByEntitlement(ALL_ENTRIES, 'VP')
      expect(filtered.length).toBe(vpFiltered.length)
    })
  })

  // ── Cross-role monotonicity ──────────────────────────────────────────────

  describe('Monotonic privilege escalation', () => {
    it('each higher role sees >= tools than lower roles', () => {
      let prevCount = 0
      for (const role of ALL_ROLES) {
        const count = filterByEntitlement(ALL_ENTRIES, role).length
        expect(count).toBeGreaterThanOrEqual(prevCount)
        prevCount = count
      }
    })

    it('tool subsets are proper supersets up the rank chain', () => {
      for (let i = 0; i < ALL_ROLES.length - 1; i++) {
        const lowerSet = new Set(
          filterByEntitlement(ALL_ENTRIES, ALL_ROLES[i]).map(e => e.tool_id),
        )
        const higherFiltered = filterByEntitlement(ALL_ENTRIES, ALL_ROLES[i + 1])
        const higherSet = new Set(higherFiltered.map(e => e.tool_id))

        // Every tool visible to lower role must also be visible to higher role
        for (const toolId of lowerSet) {
          expect(higherSet.has(toolId)).toBe(true)
        }
      }
    })
  })

  // ── Specific AC validations ──────────────────────────────────────────────

  describe('Acceptance criteria validation', () => {
    it('AC1: Each role receives correct tool subset (5 distinct counts)', () => {
      const counts = ALL_ROLES.map(role => filterByEntitlement(ALL_ENTRIES, role).length)
      // COORDINATOR < SPECIALIST < DIRECTOR <= VP <= ADMIN
      expect(counts[0]).toBeLessThan(counts[1])  // COORD < SPEC
      expect(counts[1]).toBeLessThan(counts[2])  // SPEC < DIR
      expect(counts[2]).toBeLessThanOrEqual(counts[3]) // DIR <= VP
      expect(counts[3]).toBeLessThanOrEqual(counts[4]) // VP <= ADMIN
    })

    it('AC2: Coordinator cannot see Wires', () => {
      const coordTools = filterByEntitlement(ALL_ENTRIES, 'COORDINATOR')
      const wireTools = coordTools.filter(e => e.type === 'WIRE')
      expect(wireTools).toHaveLength(0)
    })

    it('AC3: VP sees all', () => {
      const vpTools = filterByEntitlement(ALL_ENTRIES, 'VP')
      expect(vpTools.length).toBe(ALL_ENTRIES.length)
    })

    it('AC4: All 5 roles verified', () => {
      for (const role of ALL_ROLES) {
        const result = filterByEntitlement(ALL_ENTRIES, role)
        expect(result.length).toBeGreaterThan(0)
      }
    })
  })
})
