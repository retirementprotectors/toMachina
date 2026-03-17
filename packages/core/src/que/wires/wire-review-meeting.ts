/**
 * WIRE_REVIEW_MEETING (TRK-13401)
 * Trigger: Scheduled review meeting
 * Sequence: ANALYZE_MGE → generate-meeting-prep → (file-to-acf handled by DEX)
 */

import type { WireInput, ReviewMeetingWireResult } from './types'
import { analyzeMge } from '../super-tools/analyze-mge'
import { generateMeetingPrep } from '../generators/generate-meeting-prep'

export interface ReviewMeetingInput extends WireInput {
  meetingDate: string
  location: string
}

export function wireReviewMeeting(input: ReviewMeetingInput): ReviewMeetingWireResult {
  const { household, preparedBy, preparedDate, meetingDate, location } = input

  const mgeAnalysis = analyzeMge(household)

  const meetingPrepHtml = generateMeetingPrep({
    household,
    analyses: mgeAnalysis.analyses,
    preparedBy,
    preparedDate,
    meetingDate,
    location,
  })

  // The MGE analysis produces a summary result for the meeting prep
  const summaryResult = {
    type: 'mge_detailed' as const,
    applicable: true,
    summary: `Full household review prepared for ${meetingDate}. ${mgeAnalysis.applicableTypes.length} opportunity types identified.`,
    findings: mgeAnalysis.analyses.filter((a) => a.applicable).map((a) => a.summary),
    recommendation: 'Present opportunities in priority order using the talk tracks on Page 2.',
    metrics: mgeAnalysis.householdSummary as Record<string, number | string | boolean>,
    details: {},
    warnings: [],
  }

  return {
    success: true,
    wire: 'WIRE_REVIEW_MEETING',
    meetingPrepHtml,
    analysis: summaryResult,
    notes: [`Meeting date: ${meetingDate}`, `Location: ${location}`, `Applicable types: ${mgeAnalysis.applicableTypes.join(', ')}`],
  }
}
