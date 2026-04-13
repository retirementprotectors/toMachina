/**
 * QUE Generator Types
 *
 * Generators are pure functions that accept analysis results
 * and return HTML strings for PDF rendering.
 * No async, no Firestore — just data in, HTML out.
 */

import type { AnalysisResult, CaseworkType, SuperToolHousehold, SuperToolMember, SuperToolAccount } from '../super-tools/types'

// ---------------------------------------------------------------------------
// Generator input types
// ---------------------------------------------------------------------------

export interface GeneratorInput {
  /** The analysis result to render */
  analysis: AnalysisResult
  /** Household context for headers/footers */
  household: {
    id: string
    clientNames: string
    filingStatus: string
    state: string
    members: Array<{
      name: string
      age: number
    }>
  }
  /** Preparer info */
  preparedBy: string
  /** Date string (e.g., "March 17, 2026") */
  preparedDate: string
}

export interface Ai3GeneratorInput {
  household: SuperToolHousehold
  /** All analyses run on this household */
  analyses: AnalysisResult[]
  preparedBy: string
  preparedDate: string
}

export interface MeetingPrepInput {
  household: SuperToolHousehold
  analyses: AnalysisResult[]
  preparedBy: string
  preparedDate: string
  meetingDate: string
  location: string
}

export interface FactfinderInput {
  household: SuperToolHousehold
  /** Which authorization forms are needed */
  authForms: Array<'life' | 'wealth' | 'its'>
  preparedBy: string
  preparedDate: string
}

// ---------------------------------------------------------------------------
// Template dispatch type
// ---------------------------------------------------------------------------

export type TemplateRenderer = (input: GeneratorInput) => string

// ---------------------------------------------------------------------------
// Design system constants
// ---------------------------------------------------------------------------

export const DESIGN = {
  navy: '#1a3a5c',
  tableHeaderBg: '#e8edf2',
  highlightRow: '#f0f6ff',
  oppGreen: { border: '#2a7d4f', bg: '#f4faf6' },
  oppYellow: { border: '#c49000', bg: '#fef9ee' },
  oppBlue: { border: '#2563b3', bg: '#f0f6ff' },
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  bodySize: '10pt',
  tableSize: '9pt',
  detailSize: '8.5pt',
} as const

/**
 * @deprecated Use `getTaxHarvestingDisclosure()` from `../disclosures` instead.
 * Hardcoded Signal/Gradient language was removed 2026-04-13 when RPI ended
 * its BD affiliation. Access via the hard-gated helper; it throws while no
 * BD is active, preventing client-facing docs with stale affiliation data.
 */
export { getTaxHarvestingDisclosure as TAX_HARVESTING_DISCLOSURE_FN } from './disclosures'
