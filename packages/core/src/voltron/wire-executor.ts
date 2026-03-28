// ─── VOLTRON Wire Executor ──────────────────────────────────────────────────
// Sequential super tool execution with output chaining, approval gates,
// audit trail, simulation mode, and SSE status tracking.
// Mirrors ATLAS wire-executor.ts pattern with VOLTRON-specific divergences.
//
// SSE Event Types (Mode 1 UI consumes these):
//   stage_start        — Emitted when a super tool stage begins execution
//   stage_complete     — Emitted when a super tool stage completes successfully
//   stage_error        — Emitted when a super tool stage fails
//   approval_required  — Emitted when execution pauses at an approval gate
//   wire_complete      — Emitted when all stages finish successfully
//   wire_error         — Emitted when the wire fails (any stage error)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronContext,
  VoltronWireInput,
  VoltronWireResult,
  VoltronStageResult,
  VoltronArtifact,
  VoltronSuperToolExecuteFn,
  VoltronSuperResult,
} from './types.js'
import { VOLTRON_WIRE_DEFINITIONS, getVoltronWireById, validateWireExecution } from './wires.js'

// ── Static Super Tool Imports (no dynamic resolution) ───────────────────────

import { execute as executeReviewPrep } from './super-tools/review-prep.js'
import { execute as executePullDocuments } from './super-tools/pull-documents.js'
import { execute as executeDraftCommunication } from './super-tools/draft-communication.js'
import { execute as executeRmdAnalysis } from './super-tools/rmd-analysis.js'
import { execute as executeCoverageGap } from './super-tools/coverage-gap.js'
import { execute as executeMeetingPrep } from './super-tools/meeting-prep.js'
import { execute as executeBuildCasework } from './super-tools/build-casework.js'
import { execute as executeRunIllustration } from './super-tools/run-illustration.js'

const SUPER_TOOL_MAP: Record<string, VoltronSuperToolExecuteFn> = {
  REVIEW_PREP: executeReviewPrep,
  PULL_DOCUMENTS: executePullDocuments,
  DRAFT_COMMUNICATION: executeDraftCommunication,
  RMD_ANALYSIS: executeRmdAnalysis,
  COVERAGE_GAP: executeCoverageGap,
  MEETING_PREP: executeMeetingPrep,
  BUILD_CASEWORK: executeBuildCasework,
  RUN_ILLUSTRATION: executeRunIllustration,
}

function resolveSuperTool(superToolId: string): VoltronSuperToolExecuteFn | null {
  return SUPER_TOOL_MAP[superToolId] || null
}

// ── SSE Event Types ─────────────────────────────────────────────────────────

/** Typed SSE event types emitted during wire execution */
export type WireSSEEventType =
  | 'stage_start'
  | 'stage_complete'
  | 'stage_error'
  | 'approval_required'
  | 'wire_complete'
  | 'wire_error'

/** SSE event payload — consumed by Mode 1 UI via EventSource */
export interface WireSSEEvent {
  /** Event type discriminator */
  type: WireSSEEventType
  /** Unique execution identifier */
  execution_id: string
  /** Wire definition ID */
  wire_id: string
  /** Stage detail — present on stage_* and approval_required events */
  stage?: VoltronStageResult
  /** Total stages in this wire */
  total_stages?: number
  /** 0-based index of the current stage */
  stage_index?: number
  /** Final wire result — present on wire_complete and wire_error events */
  result?: VoltronWireResult
  /** ISO 8601 timestamp */
  timestamp: string
}

// ── Status Tracking (for SSE consumers) ─────────────────────────────────────

export type WireStatusListener = (event: WireSSEEvent) => void

const activeExecutions = new Map<string, {
  events: WireSSEEvent[]
  listeners: Set<WireStatusListener>
}>()

export function subscribeToWire(executionId: string, listener: WireStatusListener): () => void {
  const execution = activeExecutions.get(executionId)
  if (execution) {
    execution.listeners.add(listener)
    // Replay existing events so late subscribers catch up
    for (const event of execution.events) {
      listener(event)
    }
  }
  return () => {
    const exec = activeExecutions.get(executionId)
    if (exec) exec.listeners.delete(listener)
  }
}

function emitSSE(executionId: string, event: WireSSEEvent): void {
  const execution = activeExecutions.get(executionId)
  if (execution) {
    execution.events.push(event)
    for (const listener of execution.listeners) {
      try { listener(event) } catch { /* swallow listener errors */ }
    }
  }
}

// ── Artifact Extraction ─────────────────────────────────────────────────────

/**
 * Extract artifacts from a super tool result.
 * Looks for known artifact shapes in result data (Drive links, PDFs, etc.).
 */
function extractArtifacts(toolId: string, result: VoltronSuperResult): VoltronArtifact[] {
  const extracted: VoltronArtifact[] = []
  if (!result.data || typeof result.data !== 'object') return extracted

  const data = result.data as Record<string, unknown>

  // Extract Drive file links
  if (typeof data.drive_link === 'string') {
    extracted.push({ type: 'drive_file', link: data.drive_link, label: `${toolId} — Drive file` })
  }
  // Extract PDF links
  if (typeof data.pdf_link === 'string') {
    extracted.push({ type: 'pdf', link: data.pdf_link, label: `${toolId} — PDF` })
  }
  // Extract HTML output links
  if (typeof data.html_link === 'string') {
    extracted.push({ type: 'html', link: data.html_link, label: `${toolId} — HTML` })
  }
  // Extract generic artifact arrays
  if (Array.isArray(data.artifacts)) {
    for (const a of data.artifacts) {
      if (a && typeof a === 'object' && typeof (a as Record<string, unknown>).link === 'string') {
        const artifact = a as Record<string, unknown>
        extracted.push({
          type: typeof artifact.type === 'string' ? artifact.type : 'unknown',
          link: artifact.link as string,
          label: typeof artifact.label === 'string' ? artifact.label : `${toolId} artifact`,
        })
      }
    }
  }

  // Collect per-tool artifacts from tool_results
  if (result.tool_results) {
    for (const tr of result.tool_results) {
      if (tr.data && typeof tr.data === 'object') {
        const trData = tr.data as Record<string, unknown>
        if (typeof trData.drive_link === 'string') {
          extracted.push({ type: 'drive_file', link: trData.drive_link, label: `${tr.metadata?.tool_id ?? toolId} — Drive file` })
        }
        if (typeof trData.pdf_link === 'string') {
          extracted.push({ type: 'pdf', link: trData.pdf_link, label: `${tr.metadata?.tool_id ?? toolId} — PDF` })
        }
      }
    }
  }

  return extracted
}

// ── Audit Document Builder ──────────────────────────────────────────────────

function buildAuditDoc(
  executionId: string,
  wireId: string,
  context: VoltronContext,
  stages: VoltronStageResult[],
  artifacts: VoltronArtifact[],
  status: VoltronWireResult['status'],
  startedAt: string,
  simulation: boolean,
  errorMessage?: string,
): Record<string, unknown> {
  return {
    execution_id: executionId,
    wire_id: wireId,
    user_email: context.user_email,
    client_id: context.client_id,
    user_role: context.user_role,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    stage_results: stages,
    status,
    artifacts,
    entitlement: context.entitlement,
    simulation,
    ...(errorMessage ? { error: errorMessage } : {}),
  }
}

// ── Failure Result Helper ───────────────────────────────────────────────────

function buildFailResult(
  executionId: string,
  wireId: string,
  context: VoltronContext,
  startedAt: string,
  stages: VoltronStageResult[] = [],
  artifacts: VoltronArtifact[] = [],
): VoltronWireResult {
  return {
    execution_id: executionId,
    wire_id: wireId,
    user_email: context.user_email,
    client_id: context.client_id ?? wireId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    stage_results: stages,
    status: 'failed',
    artifacts,
  }
}

// ── Main Execution ──────────────────────────────────────────────────────────

export interface ExecuteWireOptions {
  /** Run in simulation mode — returns execution plan without invoking tools */
  simulate?: boolean
  /** Callback for writing audit trail to wire_executions Firestore collection */
  writeAudit?: (doc: Record<string, unknown>) => Promise<string>
  /** Resume from a specific stage (used after approval gate) */
  resumeFromStage?: string
  /** Prior stage outputs to restore output chaining on resume (keyed by stage ID) */
  priorStageOutputs?: Record<string, unknown>
}

export async function executeVoltronWire(
  wireInput: VoltronWireInput,
  context: VoltronContext,
  options: ExecuteWireOptions = {},
): Promise<VoltronWireResult> {
  const executionId = `vwire_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const startedAt = new Date().toISOString()
  const stages: VoltronStageResult[] = []
  const artifacts: VoltronArtifact[] = []
  const isSimulation = options.simulate === true
  const isResume = typeof options.resumeFromStage === 'string'

  // Register for SSE tracking
  activeExecutions.set(executionId, { events: [], listeners: new Set() })

  try {
    // Pre-execution constraint validation (AEP blackout, etc.)
    const validation = validateWireExecution(wireInput.wire_id)
    if (!validation.valid) {
      const failResult = buildFailResult(executionId, wireInput.wire_id, context, startedAt)

      emitSSE(executionId, {
        type: 'wire_error',
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        result: failResult,
        timestamp: new Date().toISOString(),
      })

      // Write audit for validation failure
      if (options.writeAudit) {
        await options.writeAudit(
          buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, 'failed', startedAt, isSimulation, validation.error),
        )
      }

      return failResult
    }

    // Resolve wire definition
    const wireDef = getVoltronWireById(wireInput.wire_id)
    if (!wireDef) {
      const errorMsg = `Wire definition not found: ${wireInput.wire_id}`
      const failResult = buildFailResult(executionId, wireInput.wire_id, context, startedAt)

      emitSSE(executionId, {
        type: 'wire_error',
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        result: failResult,
        timestamp: new Date().toISOString(),
      })

      // Write audit for missing wire definition
      if (options.writeAudit) {
        await options.writeAudit(
          buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, 'failed', startedAt, isSimulation, errorMsg),
        )
      }

      return failResult
    }

    const totalStages = wireDef.super_tools.length

    // Entitlement check
    const { VOLTRON_ROLE_RANK } = await import('./types.js')
    const requiredRank = VOLTRON_ROLE_RANK[wireDef.entitlement_min]
    if (context.entitlement < requiredRank) {
      const errorMsg = `Insufficient entitlement: role rank ${context.entitlement} < required ${requiredRank} (${wireDef.entitlement_min})`
      const failResult = buildFailResult(executionId, wireInput.wire_id, context, startedAt)

      emitSSE(executionId, {
        type: 'wire_error',
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        result: failResult,
        timestamp: new Date().toISOString(),
      })

      // Write audit for entitlement failure
      if (options.writeAudit) {
        await options.writeAudit(
          buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, 'failed', startedAt, isSimulation, errorMsg),
        )
      }

      return failResult
    }

    // Simulation mode — return plan without executing
    if (isSimulation) {
      const simStages: VoltronStageResult[] = wireDef.super_tools.map((toolId) => ({
        stage: toolId,
        super_tool_id: toolId,
        status: 'pending' as const,
        approval_gate: wireDef.approval_gates?.includes(toolId) || false,
      }))

      const simResult: VoltronWireResult = {
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        user_email: context.user_email,
        client_id: wireInput.client_id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        stage_results: simStages,
        status: 'simulated',
        artifacts: [],
      }

      // Write simulation audit trail
      if (options.writeAudit) {
        await options.writeAudit(
          buildAuditDoc(executionId, wireInput.wire_id, context, simStages, artifacts, 'simulated', startedAt, true),
        )
      }

      emitSSE(executionId, {
        type: 'wire_complete',
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        total_stages: totalStages,
        result: simResult,
        timestamp: new Date().toISOString(),
      })

      return simResult
    }

    // Determine starting point (for resume after approval)
    const superTools = wireDef.super_tools
    let startIdx = 0

    if (options.resumeFromStage) {
      const resumeIdx = superTools.indexOf(options.resumeFromStage)
      if (resumeIdx === -1) {
        const errorMsg = `Resume stage not found in wire: ${options.resumeFromStage}`
        const failResult = buildFailResult(executionId, wireInput.wire_id, context, startedAt)

        emitSSE(executionId, {
          type: 'wire_error',
          execution_id: executionId,
          wire_id: wireInput.wire_id,
          result: failResult,
          timestamp: new Date().toISOString(),
        })

        if (options.writeAudit) {
          await options.writeAudit(
            buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, 'failed', startedAt, false, errorMsg),
          )
        }

        return failResult
      }
      startIdx = resumeIdx
    }

    // Restore previous output for chaining on resume
    // If priorStageOutputs provided, use the output of the stage before startIdx
    let previousOutput: unknown = null
    if (isResume && options.priorStageOutputs && startIdx > 0) {
      const priorStageId = superTools[startIdx - 1]
      previousOutput = options.priorStageOutputs[priorStageId] ?? null
    }

    // Sequential execution with output chaining
    for (let i = startIdx; i < superTools.length; i++) {
      const toolId = superTools[i]
      const executeFn = resolveSuperTool(toolId)

      const stageResult: VoltronStageResult = {
        stage: toolId,
        super_tool_id: toolId,
        status: 'running',
        started_at: new Date().toISOString(),
      }
      stages.push(stageResult)

      // Emit stage_start SSE event
      emitSSE(executionId, {
        type: 'stage_start',
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        stage: { ...stageResult },
        total_stages: totalStages,
        stage_index: i,
        timestamp: new Date().toISOString(),
      })

      if (!executeFn) {
        stageResult.status = 'error'
        stageResult.error = `Super tool not found: ${toolId}`
        stageResult.completed_at = new Date().toISOString()

        emitSSE(executionId, {
          type: 'stage_error',
          execution_id: executionId,
          wire_id: wireInput.wire_id,
          stage: { ...stageResult },
          total_stages: totalStages,
          stage_index: i,
          timestamp: new Date().toISOString(),
        })
        break
      }

      // Check approval gate BEFORE execution
      // Skip the gate if this is the stage being resumed (approval already granted)
      const isApprovalGate = wireDef.approval_gates?.includes(toolId) || false
      const skipGateBecauseResume = isResume && i === startIdx

      if (isApprovalGate && !skipGateBecauseResume) {
        stageResult.status = 'approval_pending'
        stageResult.approval_gate = true
        stageResult.completed_at = new Date().toISOString()

        // Emit approval_required SSE event
        emitSSE(executionId, {
          type: 'approval_required',
          execution_id: executionId,
          wire_id: wireInput.wire_id,
          stage: { ...stageResult },
          total_stages: totalStages,
          stage_index: i,
          timestamp: new Date().toISOString(),
        })

        // Write audit with approval_pending status
        if (options.writeAudit) {
          await options.writeAudit(
            buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, 'approval_pending', startedAt, false),
          )
        }

        return {
          execution_id: executionId,
          wire_id: wireInput.wire_id,
          user_email: context.user_email,
          client_id: wireInput.client_id,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          stage_results: stages,
          status: 'approval_pending',
          artifacts,
        }
      }

      // Execute super tool with output chaining (previous output → next input)
      try {
        const toolInput = {
          client_id: wireInput.client_id,
          params: { ...wireInput.params, _previous_output: previousOutput },
        }

        const result: VoltronSuperResult = await executeFn(toolInput, context)

        stageResult.status = result.success ? 'complete' : 'error'
        stageResult.output = result.data
        stageResult.error = result.error
        stageResult.completed_at = new Date().toISOString()

        // Collect artifacts from successful stages
        if (result.success) {
          const stageArtifacts = extractArtifacts(toolId, result)
          artifacts.push(...stageArtifacts)
        }

        // Emit stage_complete or stage_error SSE event
        emitSSE(executionId, {
          type: result.success ? 'stage_complete' : 'stage_error',
          execution_id: executionId,
          wire_id: wireInput.wire_id,
          stage: { ...stageResult },
          total_stages: totalStages,
          stage_index: i,
          timestamp: new Date().toISOString(),
        })

        if (!result.success) {
          break
        }

        // Chain output to next stage
        previousOutput = result.data
      } catch (err) {
        stageResult.status = 'error'
        stageResult.error = err instanceof Error ? err.message : String(err)
        stageResult.completed_at = new Date().toISOString()

        emitSSE(executionId, {
          type: 'stage_error',
          execution_id: executionId,
          wire_id: wireInput.wire_id,
          stage: { ...stageResult },
          total_stages: totalStages,
          stage_index: i,
          timestamp: new Date().toISOString(),
        })
        break
      }
    }

    // Determine final status
    const hasError = stages.some(s => s.status === 'error')
    const finalStatus = hasError ? 'failed' : 'complete'

    const wireResult: VoltronWireResult = {
      execution_id: executionId,
      wire_id: wireInput.wire_id,
      user_email: context.user_email,
      client_id: wireInput.client_id,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      stage_results: stages,
      status: finalStatus,
      artifacts,
    }

    // Emit terminal wire SSE event
    emitSSE(executionId, {
      type: hasError ? 'wire_error' : 'wire_complete',
      execution_id: executionId,
      wire_id: wireInput.wire_id,
      total_stages: totalStages,
      result: wireResult,
      timestamp: new Date().toISOString(),
    })

    // Write audit trail
    if (options.writeAudit) {
      await options.writeAudit(
        buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, finalStatus, startedAt, false),
      )
    }

    return wireResult
  } finally {
    // Cleanup SSE tracking after a delay (allow late subscribers to catch up)
    setTimeout(() => activeExecutions.delete(executionId), 60_000)
  }
}

// ── Resume After Approval ───────────────────────────────────────────────────

/**
 * Resume wire execution after approval gate.
 * Automatically skips the approval gate for the resumed stage and restores
 * output chaining from prior stage outputs.
 */
export async function resumeVoltronWireAfterApproval(
  executionId: string,
  wireInput: VoltronWireInput,
  context: VoltronContext,
  resumeFromStage: string,
  options: Omit<ExecuteWireOptions, 'simulate' | 'resumeFromStage'> & {
    priorStageOutputs?: Record<string, unknown>
  } = {},
): Promise<VoltronWireResult> {
  return executeVoltronWire(wireInput, context, {
    ...options,
    resumeFromStage,
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Get list of available wire IDs */
export function getAvailableWireIds(): string[] {
  return VOLTRON_WIRE_DEFINITIONS.map(w => w.wire_id)
}

/** Check if a super tool ID is valid */
export function isValidSuperTool(superToolId: string): boolean {
  return superToolId in SUPER_TOOL_MAP
}

/** Get count of registered super tools */
export function getSuperToolCount(): number {
  return Object.keys(SUPER_TOOL_MAP).length
}
