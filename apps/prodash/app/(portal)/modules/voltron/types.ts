/**
 * VOLTRON Action Engine — Local UI types
 * Mirrors the planned packages/core/src/voltron/types.ts contracts.
 * These will be replaced by core imports once TRK-13738 lands.
 */

export type VoltronUserRole = 'COORDINATOR' | 'SPECIALIST' | 'DIRECTOR' | 'VP' | 'ADMIN'
export type VoltronToolType = 'ATOMIC' | 'SUPER' | 'WIRE'
export type VoltronToolSource = 'API_ROUTE' | 'MCP' | 'VOLTRON' | 'FIRESTORE'

export interface VoltronRegistryEntry {
  tool_id: string
  name: string
  description: string
  type: VoltronToolType
  source: VoltronToolSource
  entitlement_min: VoltronUserRole
  parameters: Record<string, unknown>
  server_only: boolean
  generated_at: string
}

export interface VoltronWireDefinition {
  wire_id: string
  name: string
  description: string
  super_tools: string[]
  approval_gates?: string[]
  entitlement_min: VoltronUserRole
}

export interface VoltronStageResult {
  stage: string
  super_tool_id: string
  success: boolean
  data?: unknown
  error?: string
  duration_ms: number
}

export interface VoltronArtifact {
  type: string
  link: string
  label?: string
}

export interface VoltronWireResult {
  execution_id: string
  wire_id: string
  user_email: string
  client_id: string
  started_at: string
  completed_at: string
  stage_results: VoltronStageResult[]
  status: 'complete' | 'failed' | 'approval_pending'
  artifacts: VoltronArtifact[]
}

/** SSE event types emitted by /api/voltron/wire/:id/stream */
export type VoltronSSEEventType =
  | 'stage_start'
  | 'stage_complete'
  | 'stage_error'
  | 'approval_required'
  | 'wire_complete'
  | 'wire_error'

export interface VoltronSSEEvent {
  type: VoltronSSEEventType
  stage?: string
  super_tool_id?: string
  data?: unknown
  error?: string
  timestamp: string
  /** Artifacts available so far */
  artifacts?: VoltronArtifact[]
  /** Final result on wire_complete */
  result?: VoltronWireResult
}

export type ExecutionPhase = 'idle' | 'executing' | 'approval_pending' | 'complete' | 'error'

export interface WireExecutionState {
  phase: ExecutionPhase
  execution_id: string | null
  wire_id: string | null
  stages: VoltronStageResult[]
  current_stage: string | null
  artifacts: VoltronArtifact[]
  error: string | null
  result: VoltronWireResult | null
  simulation: boolean
}

/** Role rank mapping for client-side entitlement checks */
export const ROLE_RANK: Record<VoltronUserRole, number> = {
  COORDINATOR: 1,
  SPECIALIST: 2,
  DIRECTOR: 3,
  VP: 4,
  ADMIN: 5,
}
