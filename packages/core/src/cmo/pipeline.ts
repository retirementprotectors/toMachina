/**
 * Content Pipeline Orchestrator (MUS-O07)
 *
 * Takes a creative brief, evaluates which Artisans to activate,
 * dispatches to wire executors (parallel where possible),
 * runs brand compliance on each output, returns unified result.
 *
 * Internal state only — no Firestore writes in this file.
 * The API route handles persistence.
 */
import { randomUUID } from 'crypto'
import type {
  CmoBrief,
  CmoPipelineResult,
  CmoPipelineJob,
  CmoChannel,
  CmoWireExecutionResult,
  ToolRunner,
} from './types'
import { getArtisanByChannel } from './artisans'
import { getCmoWire } from './registry'
import { executeWire } from './wire-executor'
import { checkBrandCompliance } from './compliance'

/** Default tool runner — stub that reports unimplemented tools. Callers override per-wire. */
const defaultToolRunner: ToolRunner = async (toolId) => ({
  success: false,
  error: `No tool runner configured for: ${toolId}`,
})

/**
 * Process a creative brief through the content pipeline.
 *
 * For each channel in brief.channels:
 * 1. Look up the artisan via getArtisanByChannel
 * 2. Load the wire definition
 * 3. Execute the wire
 * 4. Run brand compliance check
 * 5. Collect results
 *
 * Independent channels run in parallel (Promise.allSettled).
 * Never throws — returns CmoPipelineResult with all job outcomes.
 */
export async function processBrief(
  brief: CmoBrief,
  toolRunners?: Partial<Record<CmoChannel, ToolRunner>>,
): Promise<CmoPipelineResult> {
  const jobs: CmoPipelineJob[] = []

  const channelPromises = brief.channels.map(async (channel): Promise<CmoPipelineJob> => {
    const job: CmoPipelineJob = {
      jobId: randomUUID(),
      briefId: brief.id,
      artisanId: '',
      wireId: '',
      status: 'queued',
    }

    // Look up artisan
    const artisan = getArtisanByChannel(channel)
    if (!artisan) {
      job.status = 'failed'
      job.result = {
        wireId: `unknown-${channel}`,
        success: false,
        steps: [],
        error: `No artisan configured for channel: ${channel}`,
      }
      return job
    }

    job.artisanId = artisan.id
    job.wireId = artisan.wireId

    // Load wire definition
    const wire = getCmoWire(artisan.wireId)
    if (!wire) {
      job.status = 'failed'
      job.result = {
        wireId: artisan.wireId,
        success: false,
        steps: [],
        error: `Wire definition not found: ${artisan.wireId}`,
      }
      return job
    }

    // Determine input for this channel
    const channelInputMap: Record<string, unknown> = {
      print: brief.inputs.print,
      digital: brief.inputs.digital,
      web: brief.inputs.web,
    }
    const wireInput = (channelInputMap[channel] || {}) as Record<string, unknown>

    // Execute wire
    job.status = 'running'
    job.startedAt = new Date()

    const runner = toolRunners?.[channel] || defaultToolRunner
    let result: CmoWireExecutionResult

    try {
      result = await executeWire(wire, wireInput, runner)
    } catch (err) {
      job.status = 'failed'
      job.completedAt = new Date()
      job.result = {
        wireId: artisan.wireId,
        success: false,
        steps: [],
        error: err instanceof Error ? err.message : 'Unknown execution error',
      }
      return job
    }

    // Run brand compliance check on successful wire output
    if (result.success) {
      const compliance = checkBrandCompliance(wire.wireId, result)
      if (!compliance.passed) {
        // Compliance failure — mark job as failed but keep wire result
        job.status = 'failed'
        job.completedAt = new Date()
        job.result = {
          ...result,
          success: false,
          error: `Brand compliance failed: ${compliance.violations.filter(v => v.severity === 'error').map(v => v.description).join('; ')}`,
        }
        return job
      }
    }

    job.status = result.success ? 'complete' : 'failed'
    job.completedAt = new Date()
    job.result = result
    return job
  })

  // Run all channel jobs in parallel
  const settled = await Promise.allSettled(channelPromises)

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      jobs.push(s.value)
    } else {
      // Shouldn't happen (we never throw), but handle gracefully
      jobs.push({
        jobId: randomUUID(),
        briefId: brief.id,
        artisanId: 'unknown',
        wireId: 'unknown',
        status: 'failed',
        result: {
          wireId: 'unknown',
          success: false,
          steps: [],
          error: s.reason instanceof Error ? s.reason.message : 'Unknown error',
        },
      })
    }
  }

  // Determine overall status
  const completedCount = jobs.filter((j) => j.status === 'complete').length
  const failedCount = jobs.filter((j) => j.status === 'failed').length
  let overallStatus: 'complete' | 'partial' | 'failed' = 'complete'
  if (failedCount === jobs.length) {
    overallStatus = 'failed'
  } else if (failedCount > 0) {
    overallStatus = 'partial'
  }

  return {
    briefId: brief.id,
    jobs,
    overallStatus,
    completedAt: new Date(),
  }
}
