/**
 * CMO Registry (MUS-C02)
 *
 * Master registry of all CMO tools, super tools, and wires.
 * Follows QUE pattern: flat array + pure filter functions.
 */
import type { CmoRegistryEntry, CmoToolDomain, CmoChannel, CmoWireDefinition } from './types'
import { CMO_TOOLS } from './tools'
import { CMO_WIRES } from './wires'

/** Master registry — all tools + wire entries */
export const CMO_REGISTRY: CmoRegistryEntry[] = [
  ...CMO_TOOLS,
  ...CMO_WIRES.map((w): CmoRegistryEntry => ({
    id: w.wireId,
    type: 'WIRE',
    domain: 'cmo',
    name: w.name,
    description: w.description,
    channel: w.channel,
    composedOf: w.steps.map((s) => s.toolId),
  })),
]

/** Look up a single registry entry by ID */
export function getCmoTool(id: string): CmoRegistryEntry | undefined {
  return CMO_REGISTRY.find((e) => e.id === id)
}

/** Filter entries by tool domain (canva, wordpress, veo, etc.) */
export function getCmoToolsByDomain(domain: CmoToolDomain): CmoRegistryEntry[] {
  return CMO_REGISTRY.filter((e) => e.toolDomain === domain)
}

/** Filter entries by content channel */
export function getCmoToolsByChannel(channel: CmoChannel): CmoRegistryEntry[] {
  return CMO_REGISTRY.filter((e) => {
    if (!e.channel) return false
    if (Array.isArray(e.channel)) return e.channel.includes(channel)
    return e.channel === channel
  })
}

/** Filter entries by type (TOOL, SUPER_TOOL, WIRE) */
export function getCmoToolsByType(type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'): CmoRegistryEntry[] {
  return CMO_REGISTRY.filter((e) => e.type === type)
}

/** Get a wire definition by ID */
export function getCmoWire(wireId: string): CmoWireDefinition | undefined {
  return CMO_WIRES.find((w) => w.wireId === wireId)
}
