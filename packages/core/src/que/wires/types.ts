/**
 * QUE Wire Types
 *
 * Wires chain super tools in sequence.
 * Each wire takes a household and returns the complete output.
 */

import type { SuperToolHousehold, AnalysisResult } from '../super-tools/types'
import type { CaseworkOutput } from '../super-tools/generate-casework'
import type { AssembledDocument } from '../super-tools/assemble-output'

export interface WireInput {
  household: SuperToolHousehold
  preparedBy: string
  preparedDate: string
}

export interface WireResult {
  success: boolean
  wire: string
  trigger: string
  analysis: AnalysisResult
  casework?: CaseworkOutput
  notes?: string[]
}

export interface ReviewMeetingWireResult {
  success: boolean
  wire: 'WIRE_REVIEW_MEETING'
  meetingPrepHtml: string
  analysis: AnalysisResult
  notes?: string[]
}

export interface AssembleB4WireResult {
  success: boolean
  wire: 'WIRE_ASSEMBLE_B4'
  documents: AssembledDocument[]
  summary: {
    output1_ai3: boolean
    output2_reports: boolean
    output3_illustrations: boolean
    output4_casework: number
    output5_factfinder: boolean
    totalDocuments: number
  }
  notes?: string[]
}
