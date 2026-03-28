/**
 * VOLTRON Action Engine — UI Types
 *
 * Core domain types are re-exported from @tomachina/core/voltron.
 * UI-only types (SSE events, execution state machine) live here.
 *
 * TRK-13803: Replaced local mirrors with core imports.
 */

// ── Re-exports from @tomachina/core ──────────────────────────────────────────
export type {
  VoltronUserRole,
  VoltronToolType,
  VoltronToolSource,
  VoltronRegistryEntry,
  VoltronWireDefinition,
  VoltronStageResult,
  VoltronArtifact,
  VoltronWireResult,
  VoltronToolResult,
  VoltronSuperResult,
  VoltronContext,
  VoltronWireInput,
} from '@tomachina/core'

export { VOLTRON_ROLE_RANK, VOLTRON_ROLE_TYPE_ACCESS, isToolTypeAllowed } from '@tomachina/core'

/** Backward-compat alias used by UI components */
export { VOLTRON_ROLE_RANK as ROLE_RANK } from '@tomachina/core'

// ── UI-Only Types ────────────────────────────────────────────────────────────

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
  artifacts?: import('@tomachina/core').VoltronArtifact[]
  /** Final result on wire_complete */
  result?: import('@tomachina/core').VoltronWireResult
}

export type ExecutionPhase = 'idle' | 'executing' | 'approval_pending' | 'complete' | 'error'

export interface WireExecutionState {
  phase: ExecutionPhase
  execution_id: string | null
  wire_id: string | null
  stages: import('@tomachina/core').VoltronStageResult[]
  current_stage: string | null
  artifacts: import('@tomachina/core').VoltronArtifact[]
  error: string | null
  result: import('@tomachina/core').VoltronWireResult | null
  simulation: boolean
}
