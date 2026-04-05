// ---------------------------------------------------------------------------
// Ranger Types — MEGAZORD OPERATE Track (ZRD-O01)
// ---------------------------------------------------------------------------
// Rangers are deterministic multi-step pipeline executors.
// They read a wire definition, execute each super tool in order,
// track progress in Firestore, and report results.
// NO LLM reasoning — the wire IS the task list.
// ---------------------------------------------------------------------------

/** Model hint — Rangers default to 'haiku' (cheapest). Only correspondence needs 'sonnet' for Vision. */
export type RangerModel = 'sonnet' | 'haiku'

/** Lifecycle states for a Ranger execution run */
export type RangerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'

/** Per-step execution status */
export type RangerStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// ---------------------------------------------------------------------------
// Config — what a Ranger IS
// ---------------------------------------------------------------------------

export interface RangerConfig {
  /** Unique identifier for this Ranger (e.g. 'ranger-acf', 'ranger-import') */
  rangerId: string
  /** Wire ID this Ranger executes (from WIRE_DEFINITIONS_V2) */
  wireId: string
  /** System prompt context for audit trail — describes what this Ranger does */
  systemPrompt: string
  /** Ordered list of super tool IDs from the wire definition */
  superTools: string[]
  /** Model preference — 'haiku' for most, 'sonnet' for Vision tasks */
  model: RangerModel
  /** Max retries per step before halting */
  maxRetries: number
}

// ---------------------------------------------------------------------------
// Execution — what a Ranger DOES
// ---------------------------------------------------------------------------

export interface RangerStepResult {
  stepId: string
  superToolId: string
  status: RangerStepStatus
  startedAt: string | null
  completedAt: string | null
  duration_ms: number
  attempt: number
  output?: unknown
  error?: string
  stats?: {
    records_in: number
    records_out: number
    filtered: number
    errors: number
  }
}

export interface RangerExecutionResult {
  runId: string
  rangerId: string
  wireId: string
  status: RangerStatus
  startedAt: string
  completedAt: string | null
  steps: RangerStepResult[]
  triggeredBy: string
  input: RangerDispatchInput
  output?: RangerOutput
  error?: string
}

export interface RangerOutput {
  /** Total records processed across all steps */
  records_processed: number
  /** Records successfully created */
  records_created: number
  /** Records updated (matched existing) */
  records_updated: number
  /** Records skipped (dedup or filter) */
  records_skipped: number
  /** Records that failed processing */
  records_failed: number
  /** Total execution time */
  execution_time_ms: number
  /** Per-step summary for quick review */
  step_summary: Array<{ superToolId: string; status: RangerStepStatus; duration_ms: number }>
}

// ---------------------------------------------------------------------------
// Dispatch — how a Ranger is TRIGGERED
// ---------------------------------------------------------------------------

export interface RangerDispatchInput {
  /** Optional Drive file ID to process */
  fileId?: string
  /** Optional multiple file IDs */
  fileIds?: string[]
  /** Data mode: 'csv' | 'document' | 'commission' */
  mode?: 'csv' | 'document' | 'commission'
  /** Target category hint */
  targetCategory?: string
  /** Client ID context */
  clientId?: string
  /** Additional parameters passed to the wire executor */
  params?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Firestore doc shapes — ranger_runs collection
// ---------------------------------------------------------------------------

export interface RangerRunDoc {
  runId: string
  rangerId: string
  wireId: string
  status: RangerStatus
  steps: RangerStepResult[]
  startedAt: string
  completedAt: string | null
  triggeredBy: string
  input: RangerDispatchInput
  output: RangerOutput | null
  error: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Registry — metadata for listing Rangers
// ---------------------------------------------------------------------------

export interface RangerMeta {
  rangerId: string
  wireId: string
  name: string
  description: string
  superTools: string[]
  model: RangerModel
  maxRetries: number
}
