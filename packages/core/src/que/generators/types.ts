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

export const TAX_HARVESTING_DISCLOSURE = `This analysis is provided for informational purposes only and does not constitute tax, legal, or investment advice. Tax lot selection and liquidation strategies should be reviewed with a qualified tax advisor. Securities offered through Signal Advisors Wealth, member FINRA/SIPC. Advisory services offered through Signal Advisors Wealth, a registered investment advisor. Retirement Protectors, Inc. and Signal Advisors Wealth are not affiliated entities. Past performance is not indicative of future results.`
