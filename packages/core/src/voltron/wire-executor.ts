// ─── VOLTRON Wire Executor ──────────────────────────────────────────────────
// Sequential super tool execution with output chaining, approval gates,
// audit trail, simulation mode, and SSE status tracking.
// Mirrors ATLAS wire-executor.ts pattern with VOLTRON-specific divergences.
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
import { VOLTRON_WIRE_DEFINITIONS, getVoltronWireById } from './wires.js'

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

// ── Status Tracking (for SSE consumers) ─────────────────────────────────────

export type WireStatusListener = (stage: VoltronStageResult) => void

const activeExecutions = new Map<string, {
  stages: VoltronStageResult[]
  listeners: Set<WireStatusListener>
}>()

export function subscribeToWire(executionId: string, listener: WireStatusListener): () => void {
  const execution = activeExecutions.get(executionId)
  if (execution) {
    execution.listeners.add(listener)
    // Send current state
    for (const stage of execution.stages) {
      listener(stage)
    }
  }
  return () => {
    const exec = activeExecutions.get(executionId)
    if (exec) exec.listeners.delete(listener)
  }
}

function emitStageUpdate(executionId: string, stage: VoltronStageResult): void {
  const execution = activeExecutions.get(executionId)
  if (execution) {
    for (const listener of execution.listeners) {
      try { listener(stage) } catch { /* swallow listener errors */ }
    }
  }
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
  }
}

// ── Main Execution ──────────────────────────────────────────────────────────

export interface ExecuteWireOptions {
  simulate?: boolean
  writeAudit?: (doc: Record<string, unknown>) => Promise<string>
  resumeFromStage?: string
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

  // Register for SSE tracking
  activeExecutions.set(executionId, { stages, listeners: new Set() })

  try {
    // Resolve wire definition
    const wireDef = getVoltronWireById(wireInput.wire_id)
    if (!wireDef) {
      return {
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        user_email: context.user_email,
        client_id: wireInput.client_id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        stage_results: [],
        status: 'failed',
        artifacts: [],
      }
    }

    // Entitlement check
    const { VOLTRON_ROLE_RANK } = await import('./types.js')
    const requiredRank = VOLTRON_ROLE_RANK[wireDef.entitlement_min]
    if (context.entitlement < requiredRank) {
      return {
        execution_id: executionId,
        wire_id: wireInput.wire_id,
        user_email: context.user_email,
        client_id: wireInput.client_id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        stage_results: [],
        status: 'failed',
        artifacts: [],
      }
    }

    // Simulation mode — return plan without executing
    if (options.simulate) {
      const simStages: VoltronStageResult[] = wireDef.super_tools.map(toolId => ({
        stage: toolId,
        super_tool_id: toolId,
        status: 'pending' as const,
      }))

      return {
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
    }

    // Determine starting point (for resume after approval)
    const superTools = wireDef.super_tools
    const startIdx = options.resumeFromStage
      ? superTools.indexOf(options.resumeFromStage)
      : 0

    let previousOutput: unknown = null

    // Sequential execution
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
      emitStageUpdate(executionId, stageResult)

      if (!executeFn) {
        stageResult.status = 'error'
        stageResult.error = `Super tool not found: ${toolId}`
        stageResult.completed_at = new Date().toISOString()
        emitStageUpdate(executionId, stageResult)
        break
      }

      // Check approval gate before execution
      if (wireDef.approval_gates?.includes(toolId)) {
        stageResult.status = 'approval_pending'
        stageResult.completed_at = new Date().toISOString()
        emitStageUpdate(executionId, stageResult)

        // Write audit with approval_pending status
        if (options.writeAudit) {
          await options.writeAudit(
            buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, 'approval_pending', startedAt),
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

      // Execute super tool
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
        emitStageUpdate(executionId, stageResult)

        if (!result.success) {
          break
        }

        // Chain output to next stage
        previousOutput = result.data
      } catch (err) {
        stageResult.status = 'error'
        stageResult.error = err instanceof Error ? err.message : String(err)
        stageResult.completed_at = new Date().toISOString()
        emitStageUpdate(executionId, stageResult)
        break
      }
    }

    // Determine final status
    const hasError = stages.some(s => s.status === 'error')
    const finalStatus = hasError ? 'failed' : 'complete'

    // Write audit trail
    if (options.writeAudit) {
      await options.writeAudit(
        buildAuditDoc(executionId, wireInput.wire_id, context, stages, artifacts, finalStatus, startedAt),
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
      status: finalStatus,
      artifacts,
    }
  } finally {
    // Cleanup SSE tracking after a delay
    setTimeout(() => activeExecutions.delete(executionId), 60_000)
  }
}

// ── Resume After Approval ───────────────────────────────────────────────────

export async function resumeVoltronWireAfterApproval(
  executionId: string,
  wireInput: VoltronWireInput,
  context: VoltronContext,
  resumeFromStage: string,
  options: Omit<ExecuteWireOptions, 'simulate' | 'resumeFromStage'> = {},
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
