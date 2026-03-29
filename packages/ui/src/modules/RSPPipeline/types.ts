/**
 * RSP Pipeline — Module Types
 *
 * Type definitions for the RSP (Retirement Service Pipeline) UI module.
 * Covers Yellow-stage QUE hook integration and account-type mapping.
 *
 * Pure types only — no runtime code.
 */

/** Mirrors QueProductLine from @tomachina/core/que — local copy to avoid deep import. */
export type QueProductLine = 'LIFE' | 'ANNUITY' | 'MEDICARE' | 'INVESTMENT'

// ============================================================================
// ACCOUNT → QUE PRODUCT LINE MAPPING
// ============================================================================

/**
 * Maps an account_type string (from the Account entity) to the corresponding
 * QueProductLine used by the QUE engine. This drives which "Open QUE-*" links
 * appear in the Yellow stage card.
 */
export const ACCOUNT_TYPE_TO_QUE: Record<string, QueProductLine> = {
  // Life
  'Life': 'LIFE',
  'Term Life': 'LIFE',
  'Whole Life': 'LIFE',
  'Universal Life': 'LIFE',
  'IUL': 'LIFE',
  'VUL': 'LIFE',
  // Annuity
  'Annuity': 'ANNUITY',
  'FIA': 'ANNUITY',
  'MYGA': 'ANNUITY',
  'VA': 'ANNUITY',
  'SPIA': 'ANNUITY',
  'DIA': 'ANNUITY',
  // Medicare
  'Medicare': 'MEDICARE',
  'Medicare Supplement': 'MEDICARE',
  'Medicare Advantage': 'MEDICARE',
  'Part D': 'MEDICARE',
  // Investment
  'Investment': 'INVESTMENT',
  'IRA': 'INVESTMENT',
  'Roth IRA': 'INVESTMENT',
  'Advisory': 'INVESTMENT',
  '401k': 'INVESTMENT',
  'Brokerage': 'INVESTMENT',
}

// ============================================================================
// QUE HOOK DISPLAY METADATA
// ============================================================================

export interface QueHookMeta {
  productLine: QueProductLine
  label: string
  /** Label shown on the stub link button */
  linkLabel: string
  /** Material icon name */
  icon: string
}

export const QUE_HOOK_META: Record<QueProductLine, QueHookMeta> = {
  LIFE: {
    productLine: 'LIFE',
    label: 'Life Insurance',
    linkLabel: 'Open QUE-Life',
    icon: 'health_and_safety',
  },
  ANNUITY: {
    productLine: 'ANNUITY',
    label: 'Annuity',
    linkLabel: 'Open QUE-Annuity',
    icon: 'savings',
  },
  MEDICARE: {
    productLine: 'MEDICARE',
    label: 'Medicare',
    linkLabel: 'Open QUE-Medicare',
    icon: 'local_hospital',
  },
  INVESTMENT: {
    productLine: 'INVESTMENT',
    label: 'Investment',
    linkLabel: 'Open QUE-Investment',
    icon: 'trending_up',
  },
}

// ============================================================================
// RSP ACCOUNT (subset used by Yellow QUE hooks)
// ============================================================================

/** Lightweight account shape consumed by the Yellow QUE hook component. */
export interface RSPAccount {
  account_id: string
  account_type: string
  carrier: string
  policy_number: string
  face_amount?: number
  premium?: number
  status?: string
}

// ============================================================================
// TRANSITION TYPES (TRK-14131)
// ============================================================================

/** Configuration for an RSP pipeline stage transition. */
export interface RSPTransitionConfig {
  type: 'meeting'
  meeting_name: string
  target_stage: string
}

/** A+R transition configuration constant. */
export const AR_TRANSITION_CONFIG: RSPTransitionConfig = {
  type: 'meeting',
  meeting_name: 'A+R Meeting',
  target_stage: 'red',
}
