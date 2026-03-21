// ---------------------------------------------------------------------------
// Wire Executor — THE orchestrator that makes wire definitions executable.
// Loads a wire definition, iterates through super_tools sequentially,
// tracks stage status, and writes audit trail to Firestore.
// ---------------------------------------------------------------------------

import { getWiresV2 } from './wires'
import type { SuperToolContext } from './types'

/* ─── Types ─── */

export interface WireInput {
  file_id?: string
  file_ids?: string[]
  data?: unknown
  mode: 'document' | 'csv' | 'commission'
}

export interface WireContext {
  wire_id: string
  user_email: string
  source_file_ids: string[]
  dry_run: boolean
  approval_required: boolean
}

export interface StageResult {
  stage: string
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped'
  started_at?: string
  completed_at?: string
  output?: unknown
  error?: string
}

export interface WireResult {
  success: boolean
  wire_id: string
  execution_id: string
  stages: StageResult[]
  created_records: Array<{ collection: string; id: string }>
  execution_time_ms: number
  status: 'complete' | 'awaiting_approval' | 'error'
  approval_batch_id?: string
}

/* ─── SuperTool Registry ─── */

type SuperToolExecuteFn = (input: unknown, context: SuperToolContext) => Promise<{ success: boolean; data?: unknown; error?: string }>

/**
 * Dynamically resolve a SuperTool's execute function by ID.
 * Maps super_tool IDs to their module paths.
 */
// Static imports — avoids dynamic import resolution conflicts between
// Next.js bundler (no .js) and Node16 moduleResolution (requires .js)
import { execute as executePrepare } from './super-tools/prepare.js'
import { execute as executeClassify } from './super-tools/classify.js'
import { execute as executeExtract } from './super-tools/extract.js'
import { execute as executeValidate } from './super-tools/validate.js'
import { execute as executeNormalize } from './super-tools/normalize.js'
import { execute as executeMatch } from './super-tools/match.js'
import { execute as executeWrite } from './super-tools/write.js'
import { execute as executeFinalize } from './super-tools/acf-finalize.js'

const SUPER_TOOL_MAP: Record<string, SuperToolExecuteFn> = {
  SUPER_PREPARE: executePrepare as SuperToolExecuteFn,
  SUPER_CLASSIFY: executeClassify as SuperToolExecuteFn,
  SUPER_EXTRACT: executeExtract as SuperToolExecuteFn,
  SUPER_VALIDATE: executeValidate as SuperToolExecuteFn,
  SUPER_NORMALIZE: executeNormalize as SuperToolExecuteFn,
  SUPER_MATCH: executeMatch as SuperToolExecuteFn,
  SUPER_WRITE: executeWrite as SuperToolExecuteFn,
  ACF_FINALIZE: executeFinalize as SuperToolExecuteFn,
}

function resolveSuperTool(superToolId: string): SuperToolExecuteFn | null {
  return SUPER_TOOL_MAP[superToolId] || null
}

/* ─── Main Executor ─── */

/**
 * Execute a wire definition end-to-end.
 *
 * 1. Load wire definition by wireId
 * 2. Iterate through super_tools sequentially
 * 3. Pass output of stage N as input to stage N+1
 * 4. Track status per stage
 * 5. If approval_required: pause at SUPER_WRITE, return awaiting_approval
 * 6. Write wire_execution audit doc to Firestore
 *
 * @param wireId - Wire definition ID (e.g., 'WIRE_INCOMING_CORRESPONDENCE')
 * @param input - Wire input (file IDs, data, mode)
 * @param context - Execution context (user, dry_run, approval settings)
 * @param writeAudit - Optional callback to persist audit trail (avoids direct Firestore dep in core)
 */
export async function executeWire(
  wireId: string,
  input: WireInput,
  context: WireContext,
  writeAudit?: (executionDoc: Record<string, unknown>) => Promise<string>
): Promise<WireResult> {
  const startTime = Date.now()
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Load wire definition
  const wires = getWiresV2()
  const wire = wires.find((w) => w.wire_id === wireId)

  if (!wire) {
    return {
      success: false,
      wire_id: wireId,
      execution_id: executionId,
      stages: [],
      created_records: [],
      execution_time_ms: Date.now() - startTime,
      status: 'error',
    }
  }

  const stages: StageResult[] = wire.super_tools.map((st) => ({
    stage: st,
    status: 'pending' as const,
  }))

  const createdRecords: Array<{ collection: string; id: string }> = []
  let approvalBatchId: string | undefined
  let currentOutput: unknown = input

  // Build SuperTool context from wire context
  const superToolContext: SuperToolContext = {
    triggered_by: context.user_email,
    target_collection: undefined,
    target_category: undefined,
  }

  // Execute each SuperTool sequentially
  try {
  for (let i = 0; i < wire.super_tools.length; i++) {
    const superToolId = wire.super_tools[i]
    const stageRecord = stages[i]

    // Check if this is SUPER_WRITE and approval is required
    if (superToolId === 'SUPER_WRITE' && context.approval_required && !context.dry_run) {
      stageRecord.status = 'skipped'
      stageRecord.completed_at = new Date().toISOString()

      // Mark remaining stages as pending
      for (let j = i + 1; j < stages.length; j++) {
        stages[j].status = 'pending'
      }

      // Write audit trail
      const executionDoc = buildAuditDoc(executionId, wireId, context, stages, createdRecords, startTime, 'awaiting_approval', approvalBatchId)
      if (writeAudit) {
        await writeAudit(executionDoc).catch(() => {})
      }

      return {
        success: true,
        wire_id: wireId,
        execution_id: executionId,
        stages,
        created_records: createdRecords,
        execution_time_ms: Date.now() - startTime,
        status: 'awaiting_approval',
        approval_batch_id: approvalBatchId,
      }
    }

    // Execute the SuperTool
    stageRecord.status = 'running'
    stageRecord.started_at = new Date().toISOString()

    const executeFn = await resolveSuperTool(superToolId)
    if (!executeFn) {
      stageRecord.status = 'error'
      stageRecord.error = `SuperTool ${superToolId} not found or failed to load`
      stageRecord.completed_at = new Date().toISOString()
      break
    }

    try {
      const result = await executeFn(currentOutput, superToolContext)

      stageRecord.completed_at = new Date().toISOString()

      if (!result.success) {
        stageRecord.status = 'error'
        stageRecord.error = result.error || `${superToolId} failed`
        break
      }

      stageRecord.status = 'complete'
      stageRecord.output = context.dry_run ? result.data : undefined
      currentOutput = result.data

      // Track created records from SUPER_WRITE
      if (superToolId === 'SUPER_WRITE' && result.data) {
        const writeData = result.data as { records?: Array<{ collection: string; id: string }> }
        if (writeData.records) {
          createdRecords.push(...writeData.records)
        }
      }

      // Capture approval_batch_id if SUPER_MATCH produced one
      if (superToolId === 'SUPER_MATCH' && result.data) {
        const matchData = result.data as { approval_batch_id?: string }
        if (matchData.approval_batch_id) {
          approvalBatchId = matchData.approval_batch_id
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown execution error'
      stageRecord.status = 'error'
      stageRecord.error = message
      stageRecord.completed_at = new Date().toISOString()
      break
    }
  }
  } finally {
    // Clean up temp files from SUPER_PREPARE
    try {
      const fs = await import('fs')
      const dirsToClean: string[] = []
      if (superToolContext.tmp_dir) {
        dirsToClean.push(superToolContext.tmp_dir)
      }
      for (const dir of dirsToClean) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true })
        }
      }
    } catch { /* ignore cleanup errors */ }
  }

  // Determine final status
  const hasError = stages.some((s) => s.status === 'error')
  const finalStatus = hasError ? 'error' : 'complete'

  // Write audit trail
  const executionDoc = buildAuditDoc(executionId, wireId, context, stages, createdRecords, startTime, finalStatus, approvalBatchId)
  if (writeAudit) {
    await writeAudit(executionDoc).catch(() => {})
  }

  // Post-completion integrations (non-blocking)
  if (finalStatus === 'complete' && !context.dry_run) {
    // Notification creation is handled by the caller (API route or Cloud Function)
    // to keep core package free of Firestore write dependencies
  }

  return {
    success: !hasError,
    wire_id: wireId,
    execution_id: executionId,
    stages,
    created_records: createdRecords,
    execution_time_ms: Date.now() - startTime,
    status: finalStatus,
    approval_batch_id: approvalBatchId,
  }
}

/**
 * Resume a wire execution after approval.
 * Picks up from SUPER_WRITE stage onward.
 */
export async function resumeWireAfterApproval(
  wireId: string,
  executionId: string,
  approvedData: unknown,
  context: WireContext,
  writeAudit?: (executionDoc: Record<string, unknown>) => Promise<string>
): Promise<WireResult> {
  const startTime = Date.now()

  const wires = getWiresV2()
  const wire = wires.find((w) => w.wire_id === wireId)

  if (!wire) {
    return {
      success: false,
      wire_id: wireId,
      execution_id: executionId,
      stages: [],
      created_records: [],
      execution_time_ms: Date.now() - startTime,
      status: 'error',
    }
  }

  // Find SUPER_WRITE index and resume from there
  const writeIndex = wire.super_tools.indexOf('SUPER_WRITE')
  if (writeIndex === -1) {
    return {
      success: false,
      wire_id: wireId,
      execution_id: executionId,
      stages: [],
      created_records: [],
      execution_time_ms: Date.now() - startTime,
      status: 'error',
    }
  }

  const remainingTools = wire.super_tools.slice(writeIndex)
  const stages: StageResult[] = remainingTools.map((st) => ({
    stage: st,
    status: 'pending' as const,
  }))

  const createdRecords: Array<{ collection: string; id: string }> = []
  let currentOutput: unknown = approvedData

  const superToolContext: SuperToolContext = {
    triggered_by: context.user_email,
  }

  for (let i = 0; i < remainingTools.length; i++) {
    const superToolId = remainingTools[i]
    const stageRecord = stages[i]

    stageRecord.status = 'running'
    stageRecord.started_at = new Date().toISOString()

    const executeFn = await resolveSuperTool(superToolId)
    if (!executeFn) {
      stageRecord.status = 'error'
      stageRecord.error = `SuperTool ${superToolId} not found`
      stageRecord.completed_at = new Date().toISOString()
      break
    }

    try {
      const result = await executeFn(currentOutput, superToolContext)
      stageRecord.completed_at = new Date().toISOString()

      if (!result.success) {
        stageRecord.status = 'error'
        stageRecord.error = result.error || `${superToolId} failed`
        break
      }

      stageRecord.status = 'complete'
      currentOutput = result.data

      if (superToolId === 'SUPER_WRITE' && result.data) {
        const writeData = result.data as { records?: Array<{ collection: string; id: string }> }
        if (writeData.records) createdRecords.push(...writeData.records)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      stageRecord.status = 'error'
      stageRecord.error = message
      stageRecord.completed_at = new Date().toISOString()
      break
    }
  }

  const hasError = stages.some((s) => s.status === 'error')
  const finalStatus = hasError ? 'error' : 'complete'

  const executionDoc = buildAuditDoc(executionId, wireId, context, stages, createdRecords, startTime, finalStatus)
  if (writeAudit) {
    await writeAudit(executionDoc).catch(() => {})
  }

  return {
    success: !hasError,
    wire_id: wireId,
    execution_id: executionId,
    stages,
    created_records: createdRecords,
    execution_time_ms: Date.now() - startTime,
    status: finalStatus,
  }
}

/* ─── Audit Doc Builder ─── */

function buildAuditDoc(
  executionId: string,
  wireId: string,
  context: WireContext,
  stages: StageResult[],
  createdRecords: Array<{ collection: string; id: string }>,
  startTime: number,
  status: string,
  approvalBatchId?: string
): Record<string, unknown> {
  return {
    execution_id: executionId,
    wire_id: wireId,
    user_email: context.user_email,
    source_file_ids: context.source_file_ids,
    dry_run: context.dry_run,
    approval_required: context.approval_required,
    stages: stages.map((s) => ({
      stage: s.stage,
      status: s.status,
      started_at: s.started_at,
      completed_at: s.completed_at,
      error: s.error,
    })),
    created_records: createdRecords,
    status,
    approval_batch_id: approvalBatchId,
    execution_time_ms: Date.now() - startTime,
    created_at: new Date().toISOString(),
  }
}
