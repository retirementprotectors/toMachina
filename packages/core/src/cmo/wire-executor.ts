/**
 * CMO Wire Executor (MUS-O01)
 *
 * Generic execution engine for CMO wire definitions.
 * Takes a wire definition + typed input, walks each step sequentially,
 * calls the tool runner callback, logs step output, halts on failure.
 *
 * Tool-agnostic via dependency injection — the toolRunner callback
 * handles actual MCP/API calls, making this testable without live services.
 */
import type {
  CmoWireDefinition,
  CmoWireExecutionResult,
  WireStepResult,
  ToolRunner,
} from './types'

/**
 * Execute a CMO wire definition step by step.
 *
 * Each step receives the wire input + accumulated context from previous steps.
 * On step failure: remaining steps are skipped, haltedAt is set, success is false.
 * On full success: success is true, completedAt is set.
 */
export async function executeWire(
  wire: CmoWireDefinition,
  input: Record<string, unknown>,
  toolRunner: ToolRunner,
): Promise<CmoWireExecutionResult> {
  const stepResults: WireStepResult[] = []
  const context: Record<string, unknown> = { ...input }

  for (const step of wire.steps) {
    const startTime = Date.now()
    console.log(`[MUSASHI][${wire.wireId}][${step.stepId}] executing ${step.toolId}...`)

    try {
      const result = await toolRunner(step.toolId, input, context)
      const durationMs = Date.now() - startTime

      if (result.success) {
        const stepResult: WireStepResult = {
          stepId: step.stepId,
          toolId: step.toolId,
          success: true,
          output: result.output,
          durationMs,
        }
        stepResults.push(stepResult)

        // Feed step output into context for next step
        if (result.output && typeof result.output === 'object') {
          Object.assign(context, result.output)
        }
        context[`${step.stepId}_output`] = result.output
      } else {
        // Step failed — halt wire execution
        stepResults.push({
          stepId: step.stepId,
          toolId: step.toolId,
          success: false,
          error: result.error || 'Step execution failed',
          durationMs,
        })

        return {
          wireId: wire.wireId,
          success: false,
          steps: stepResults,
          haltedAt: step.stepId,
          error: result.error || `Wire halted at ${step.stepId}: step execution failed`,
        }
      }
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'

      stepResults.push({
        stepId: step.stepId,
        toolId: step.toolId,
        success: false,
        error: errorMsg,
        durationMs,
      })

      return {
        wireId: wire.wireId,
        success: false,
        steps: stepResults,
        haltedAt: step.stepId,
        error: `Wire halted at ${step.stepId}: ${errorMsg}`,
      }
    }
  }

  return {
    wireId: wire.wireId,
    success: true,
    steps: stepResults,
    completedAt: new Date(),
  }
}
