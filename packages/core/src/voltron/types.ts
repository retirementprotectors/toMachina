// ─── VOLTRON Action Engine — Core Types ─────────────────────────────────────
// Mirrors ATLAS pattern with VOLTRON-specific divergences for client-facing
// super tool orchestration, wire execution, and registry management.
// ─────────────────────────────────────────────────────────────────────────────

// ── Role & Classification ───────────────────────────────────────────────────

export type VoltronUserRole = 'COORDINATOR' | 'SPECIALIST' | 'DIRECTOR' | 'VP' | 'ADMIN'

export const VOLTRON_ROLE_RANK: Record<VoltronUserRole, number> = {
  COORDINATOR: 1,
  SPECIALIST: 2,
  DIRECTOR: 3,
  VP: 4,
  ADMIN: 5,
}

export type VoltronToolType = 'ATOMIC' | 'SUPER' | 'WIRE'
export type VoltronToolSource = 'API_ROUTE' | 'MCP' | 'VOLTRON' | 'FIRESTORE'

// ── Entitlement Matrix ──────────────────────────────────────────────────────
// TRK-13747: Role → allowed tool types. Enforced at both API and agent level.
//
//   COORDINATOR  → Atomics only (own scope)
//   SPECIALIST   → Atomics + Supers
//   DIRECTOR     → Atomics + Supers + Wires
//   VP / ADMIN   → All (Atomics + Supers + Wires + admin operations)

export const VOLTRON_ROLE_TYPE_ACCESS: Record<VoltronUserRole, readonly VoltronToolType[]> = {
  COORDINATOR: ['ATOMIC'],
  SPECIALIST: ['ATOMIC', 'SUPER'],
  DIRECTOR: ['ATOMIC', 'SUPER', 'WIRE'],
  VP: ['ATOMIC', 'SUPER', 'WIRE'],
  ADMIN: ['ATOMIC', 'SUPER', 'WIRE'],
}

/**
 * Check if a role is allowed to access a given tool type.
 * Returns false for unknown roles (fail-safe: deny by default).
 */
export function isToolTypeAllowed(role: VoltronUserRole, toolType: VoltronToolType): boolean {
  const allowed = VOLTRON_ROLE_TYPE_ACCESS[role]
  if (!allowed) return false
  return allowed.includes(toolType)
}

// ── Tool Results ────────────────────────────────────────────────────────────

export interface VoltronToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    duration_ms: number
    tool_id: string
  }
}

export interface VoltronSuperResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  tool_results: VoltronToolResult[]
  duration_ms: number
  stats?: Record<string, unknown>
}

// ── Context & Input ─────────────────────────────────────────────────────────

export interface VoltronContext {
  client_id: string
  user_role: VoltronUserRole
  wire_id?: string
  entitlement: number
  user_email: string
}

export interface VoltronWireInput {
  wire_id: string
  client_id: string
  params: Record<string, unknown>
  entitlement: number
}

// ── Wire Execution ──────────────────────────────────────────────────────────

export interface VoltronStageResult {
  stage: string
  super_tool_id: string
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped' | 'approval_pending'
  started_at?: string
  completed_at?: string
  output?: unknown
  error?: string
}

export interface VoltronWireResult {
  execution_id: string
  wire_id: string
  user_email: string
  client_id: string
  started_at: string
  completed_at: string
  stage_results: VoltronStageResult[]
  status: 'complete' | 'failed' | 'approval_pending' | 'simulated'
  artifacts: VoltronArtifact[]
}

export interface VoltronArtifact {
  type: string
  link: string
  label?: string
}

// ── Registry ────────────────────────────────────────────────────────────────

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

// ── Definitions ─────────────────────────────────────────────────────────────

export interface VoltronSuperToolDefinition {
  super_tool_id: string
  name: string
  description: string
  tools: string[]
  entitlement_min: VoltronUserRole
}

export interface VoltronWireDefinition {
  wire_id: string
  name: string
  description: string
  super_tools: string[]
  approval_gates?: string[]
  entitlement_min: VoltronUserRole
}

// ── Super Tool Execute Signature ────────────────────────────────────────────

export type VoltronSuperToolExecuteFn = (
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
) => Promise<VoltronSuperResult>
