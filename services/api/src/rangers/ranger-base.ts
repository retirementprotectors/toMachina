// ---------------------------------------------------------------------------
// Ranger Base — Factory + Executor (ZRD-O01)
// ---------------------------------------------------------------------------
// Creates a callable Ranger from a RangerConfig. The executor:
// 1. Writes initial run doc to Firestore
// 2. Iterates super tools in order
// 3. Updates Firestore after each step
// 4. Halts on failure (no silent continuation)
// 5. Returns full execution result
// ---------------------------------------------------------------------------

import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import type {
  RangerConfig,
  RangerDispatchInput,
  RangerExecutionResult,
  RangerStepResult,
  RangerRunDoc,
  RangerOutput,
  RangerStatus,
} from './types.js'

type ExecuteWireFn = (
  wireId: string,
  input: { file_id?: string; file_ids?: string[]; data?: unknown; mode: string },
  context: Record<string, unknown>
) => Promise<{
  success: boolean
  wire_id: string
  execution_id: string
  stages: Array<{ stage: string; status: string; error?: string; output?: unknown }>
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  status: string
}>

/** Lazy-load the wire executor to avoid pulling server-only imports at module load */
let _executeWire: ExecuteWireFn | null = null
async function loadExecuteWire(): Promise<ExecuteWireFn> {
  if (!_executeWire) {
    const mod = await import('@tomachina/core/atlas/wire-executor')
    _executeWire = mod.executeWire as ExecuteWireFn
  }
  return _executeWire
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type RangerExecutor = (
  input: RangerDispatchInput,
  triggeredBy: string
) => Promise<RangerExecutionResult>

/**
 * Create a Ranger executor from config.
 * Returns a callable function that dispatches the wire and tracks progress.
 */
export function createRanger(config: RangerConfig): RangerExecutor {
  return async (input: RangerDispatchInput, triggeredBy: string): Promise<RangerExecutionResult> => {
    const db = getFirestore()
    const runId = `${config.rangerId}-${randomUUID().slice(0, 8)}`
    const startedAt = new Date().toISOString()

    // Build initial step entries from config
    const steps: RangerStepResult[] = config.superTools.map((st, i) => ({
      stepId: `step-${i}`,
      superToolId: st,
      status: 'pending' as const,
      startedAt: null,
      completedAt: null,
      duration_ms: 0,
      attempt: 0,
      output: null,
      error: null,
    }))

    // Write initial run doc
    const runDoc: RangerRunDoc = {
      runId,
      rangerId: config.rangerId,
      wireId: config.wireId,
      status: 'running',
      steps,
      startedAt,
      completedAt: null,
      triggeredBy,
      input,
      output: null,
      error: null,
      created_at: startedAt,
      updated_at: startedAt,
    }

    const runRef = db.collection('ranger_runs').doc(runId)
    await runRef.set(runDoc)

    try {
      // Execute the wire — the wire executor handles super tool sequencing
      const executeWire = await loadExecuteWire()
      const wireInput = {
        file_id: input.fileId,
        file_ids: input.fileIds,
        data: input.params,
        mode: input.mode || 'csv',
      }
      const wireContext: Record<string, unknown> = {
        wire_id: config.wireId,
        user_email: triggeredBy,
        source_file_ids: input.fileIds || (input.fileId ? [input.fileId] : []),
        dry_run: false,
        approval_required: true,
        client_id: input.clientId,
        target_category: input.targetCategory,
      }

      const wireResult = await executeWire(config.wireId, wireInput, wireContext)

      // Map wire stages back to ranger steps
      const completedSteps: RangerStepResult[] = config.superTools.map((st, i) => {
        const wireStage = wireResult.stages.find((s) => s.stage === st)
        const stepStarted = wireStage ? startedAt : null
        const stepCompleted = wireStage ? new Date().toISOString() : null
        return {
          stepId: `step-${i}`,
          superToolId: st,
          status: wireStage
            ? wireStage.status === 'complete'
              ? ('completed' as const)
              : wireStage.status === 'error'
                ? ('failed' as const)
                : wireStage.status === 'skipped'
                  ? ('skipped' as const)
                  : ('completed' as const)
            : ('pending' as const),
          startedAt: stepStarted,
          completedAt: stepCompleted,
          duration_ms: 0,
          attempt: 1,
          output: wireStage?.output ?? null,
          error: wireStage?.error ?? null,
        }
      })

      // Build output summary
      const createdCount = wireResult.created_records?.length || 0
      const output: RangerOutput = {
        records_processed: createdCount,
        records_created: createdCount,
        records_updated: 0,
        records_skipped: 0,
        records_failed: completedSteps.filter((s) => s.status === 'failed').length,
        execution_time_ms: wireResult.execution_time_ms,
        step_summary: completedSteps.map((s) => ({
          superToolId: s.superToolId,
          status: s.status,
          duration_ms: s.duration_ms,
        })),
      }

      const finalStatus: RangerStatus = wireResult.success ? 'completed' : 'failed'
      const completedAt = new Date().toISOString()

      // Update Firestore
      await runRef.update({
        status: finalStatus,
        steps: completedSteps,
        completedAt,
        output,
        updated_at: completedAt,
      })

      return {
        runId,
        rangerId: config.rangerId,
        wireId: config.wireId,
        status: finalStatus,
        startedAt,
        completedAt,
        steps: completedSteps,
        triggeredBy,
        input,
        output,
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const completedAt = new Date().toISOString()

      // Mark all pending steps as failed
      const failedSteps = steps.map((s) =>
        s.status === 'pending' ? { ...s, status: 'failed' as const, error: errorMsg } : s
      )

      await runRef.update({
        status: 'failed',
        steps: failedSteps,
        completedAt,
        error: errorMsg,
        updated_at: completedAt,
      })

      return {
        runId,
        rangerId: config.rangerId,
        wireId: config.wireId,
        status: 'failed',
        startedAt,
        completedAt,
        steps: failedSteps,
        triggeredBy,
        input,
        error: errorMsg,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cancel — check between steps
// ---------------------------------------------------------------------------

/**
 * Check if a run has been cancelled. Rangers should call this between steps.
 */
export async function isRunCancelled(runId: string): Promise<boolean> {
  const db = getFirestore()
  const doc = await db.collection('ranger_runs').doc(runId).get()
  if (!doc.exists) return true
  const data = doc.data()
  return data?.status === 'cancelled'
}
