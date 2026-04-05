/**
 * CMO Registry Types (MUS-C01)
 *
 * Follows QUE registry pattern with CMO-specific extensions:
 * - channel: content distribution channel
 * - toolDomain: which MCP/service the tool belongs to
 */

/** Content distribution channels */
export type CmoChannel = 'print' | 'digital' | 'web' | 'social' | 'video'

/** Tool source/domain — which MCP server or service owns the tool */
export type CmoToolDomain = 'canva' | 'wordpress' | 'veo' | 'c3' | 'pdf' | 'drive' | 'frontend-design'

/** Registry entry — one tool, super tool, or wire */
export interface CmoRegistryEntry {
  id: string
  type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'
  domain: 'cmo'
  name: string
  description: string
  /** Which channels this tool serves */
  channel?: CmoChannel | CmoChannel[]
  /** Which MCP/service owns this tool */
  toolDomain?: CmoToolDomain
  /** Composed tool IDs (for super tools and wires) */
  composedOf?: string[]
}

/** A single step in a wire definition */
export interface CmoWireStep {
  stepId: string
  toolId: string
  description: string
  /** Reference to input schema (for Track 2 wiring) */
  inputSchemaRef?: string
  /** Reference to output schema (for Track 2 wiring) */
  outputSchemaRef?: string
}

/** A wire definition — multi-step creative pipeline */
export interface CmoWireDefinition {
  wireId: string
  name: string
  channel: CmoChannel
  description: string
  steps: CmoWireStep[]
}
