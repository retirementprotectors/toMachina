// ─── MEETING_PREP Super Tool ────────────────────────────────────────────────
// Chain: REVIEW_PREP → PULL_DOCUMENTS → generate_agenda
// Output: Complete meeting packet (review + docs + agenda)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'
import { execute as executeReviewPrep } from './review-prep'
import { execute as executePullDocuments } from './pull-documents'

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'MEETING_PREP',
  name: 'Meeting Prep',
  description: 'Full preparation materials for client appointments: review packet, documents, and agenda.',
  tools: ['REVIEW_PREP', 'PULL_DOCUMENTS', 'generate_agenda'],
  entitlement_min: 'SPECIALIST',
}

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const meetingDate = (input.params.meeting_date as string) || new Date().toISOString()

  try {
    // Stage 1: Run REVIEW_PREP
    const reviewResult = await executeReviewPrep(input, context)
    toolResults.push({
      success: reviewResult.success,
      data: reviewResult.data,
      error: reviewResult.error,
      metadata: { duration_ms: reviewResult.duration_ms, tool_id: 'REVIEW_PREP' },
    })
    if (!reviewResult.success) {
      return { success: false, error: reviewResult.error, tool_results: toolResults, duration_ms: Date.now() - start }
    }

    // Stage 2: Run PULL_DOCUMENTS
    const docsResult = await executePullDocuments(input, context)
    toolResults.push({
      success: docsResult.success,
      data: docsResult.data,
      error: docsResult.error,
      metadata: { duration_ms: docsResult.duration_ms, tool_id: 'PULL_DOCUMENTS' },
    })
    if (!docsResult.success) {
      return { success: false, error: docsResult.error, tool_results: toolResults, duration_ms: Date.now() - start }
    }

    // Stage 3: Generate agenda
    const result = {
      client_id: input.client_id,
      meeting_date: meetingDate,
      review: reviewResult.data,
      documents: docsResult.data,
      agenda: {
        items: [
          'Review portfolio summary',
          'Discuss account changes',
          'Address coverage gaps',
          'Next steps and action items',
        ],
        estimated_duration: '60 minutes',
      },
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    toolResults.push({
      success: true,
      data: result,
      metadata: { duration_ms: Date.now() - start, tool_id: 'generate_agenda' },
    })

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: { stages_completed: 3, stages_total: 3 },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      tool_results: toolResults,
      duration_ms: Date.now() - start,
    }
  }
}
