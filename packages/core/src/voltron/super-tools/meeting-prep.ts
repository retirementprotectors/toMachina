// ─── MEETING_PREP Super Tool ────────────────────────────────────────────────
// Chain: REVIEW_PREP → PULL_DOCUMENTS → generate_agenda
// Output: Complete meeting packet (review + docs + agenda)
// Composes two super tools (REVIEW_PREP + PULL_DOCUMENTS) then generates agenda
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'
import { execute as executeReviewPrep } from './review-prep'
import { execute as executePullDocuments } from './pull-documents'

// ── Result Types ────────────────────────────────────────────────────────────

interface AgendaItem {
  order: number
  topic: string
  duration_minutes: number
  notes: string
}

interface MeetingPrepResult {
  client_id: string
  meeting_date: string
  review: unknown
  documents: unknown
  agenda: {
    items: AgendaItem[]
    estimated_duration_minutes: number
    meeting_type: string
  }
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'MEETING_PREP',
  name: 'Meeting Prep',
  description: 'Full preparation materials for client appointments: review packet, documents, and agenda.',
  tools: ['REVIEW_PREP', 'PULL_DOCUMENTS', 'generate_agenda'],
  entitlement_min: 'SPECIALIST',
}

// ── Agenda Generation ───────────────────────────────────────────────────────

function generateAgenda(
  reviewData: Record<string, unknown> | undefined,
  docsData: Record<string, unknown> | undefined,
  meetingType: string,
): AgendaItem[] {
  const accountCount = (reviewData?.account_count as number) || 0
  const totalPremium = (reviewData?.total_premium as number) || 0
  const pipelineOpps = (reviewData?.pipeline_opportunities as unknown[]) || []
  const totalDocs = (docsData?.total_files as number) || 0

  const items: AgendaItem[] = [
    {
      order: 1,
      topic: 'Welcome & Relationship Check-in',
      duration_minutes: 5,
      notes: 'Personal update, life changes, family milestones',
    },
    {
      order: 2,
      topic: 'Portfolio Review',
      duration_minutes: 15,
      notes: `${accountCount} account(s) | $${totalPremium.toLocaleString()} total premium`,
    },
  ]

  if (accountCount > 0) {
    items.push({
      order: 3,
      topic: 'Account-by-Account Summary',
      duration_minutes: 10,
      notes: 'Performance review, beneficiary verification, address any concerns',
    })
  }

  if (pipelineOpps.length > 0) {
    items.push({
      order: items.length + 1,
      topic: 'Active Opportunities',
      duration_minutes: 10,
      notes: `${pipelineOpps.length} pipeline opportunity(s) to discuss`,
    })
  }

  if (meetingType === 'annual_review' || meetingType === 'aep') {
    items.push({
      order: items.length + 1,
      topic: 'Coverage Gap Analysis',
      duration_minutes: 10,
      notes: 'Review existing protections, identify any gaps or changes needed',
    })
  }

  if (totalDocs > 0) {
    items.push({
      order: items.length + 1,
      topic: 'Document Review',
      duration_minutes: 5,
      notes: `${totalDocs} document(s) in file — verify completeness`,
    })
  }

  items.push({
    order: items.length + 1,
    topic: 'Action Items & Next Steps',
    duration_minutes: 5,
    notes: 'Assign follow-ups, schedule next meeting, confirm preferred contact method',
  })

  return items
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<MeetingPrepResult>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const meetingDate = (input.params.meeting_date as string) || new Date().toISOString()
  const meetingType = (input.params.meeting_type as string) || 'annual_review'

  try {
    // ── Stage 1: Run REVIEW_PREP ──────────────────────────────────────
    const reviewResult = await executeReviewPrep(input, context)
    toolResults.push({
      success: reviewResult.success,
      data: reviewResult.data,
      error: reviewResult.error,
      metadata: {
        duration_ms: reviewResult.duration_ms,
        tool_id: 'REVIEW_PREP',
      },
    })
    // Also include the sub-tool results for full audit trail
    if (reviewResult.tool_results) {
      for (const subResult of reviewResult.tool_results) {
        toolResults.push(subResult)
      }
    }
    if (!reviewResult.success) {
      return {
        success: false,
        error: reviewResult.error,
        tool_results: toolResults,
        duration_ms: Date.now() - start,
      }
    }

    // ── Stage 2: Run PULL_DOCUMENTS ───────────────────────────────────
    const docsResult = await executePullDocuments(input, context)
    toolResults.push({
      success: docsResult.success,
      data: docsResult.data,
      error: docsResult.error,
      metadata: {
        duration_ms: docsResult.duration_ms,
        tool_id: 'PULL_DOCUMENTS',
      },
    })
    if (docsResult.tool_results) {
      for (const subResult of docsResult.tool_results) {
        toolResults.push(subResult)
      }
    }
    if (!docsResult.success) {
      return {
        success: false,
        error: docsResult.error,
        tool_results: toolResults,
        duration_ms: Date.now() - start,
      }
    }

    // ── Stage 3: Generate agenda ──────────────────────────────────────
    const reviewData = reviewResult.data as Record<string, unknown> | undefined
    const docsData = docsResult.data as Record<string, unknown> | undefined
    const agendaItems = generateAgenda(reviewData, docsData, meetingType)
    const totalDuration = agendaItems.reduce((sum, item) => sum + item.duration_minutes, 0)

    const result: MeetingPrepResult = {
      client_id: input.client_id,
      meeting_date: meetingDate,
      review: reviewResult.data,
      documents: docsResult.data,
      agenda: {
        items: agendaItems,
        estimated_duration_minutes: totalDuration,
        meeting_type: meetingType,
      },
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    toolResults.push({
      success: true,
      data: { agenda_items: agendaItems.length, estimated_duration_minutes: totalDuration },
      metadata: { duration_ms: Date.now() - start, tool_id: 'generate_agenda' },
    })

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: {
        stages_completed: 3,
        stages_total: 3,
        agenda_items: agendaItems.length,
        estimated_duration_minutes: totalDuration,
      },
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
