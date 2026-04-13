/**
 * Securities disclosure hard-gate.
 *
 * RPI is between BD affiliations as of 2026-04-13 — Gradient Securities
 * relationship terminated, new firm TBD. Any client-facing generator that
 * needs a Securities disclosure MUST call these helpers. The gate throws
 * until ACTIVE_BD_AFFILIATION is populated with the new firm's details.
 *
 * This prevents the platform from producing client-facing docs that cite
 * a BD we're no longer affiliated with. Compliance-critical.
 *
 * To lift the gate when a new BD is selected:
 *   1. Set ACTIVE_BD_AFFILIATION to the new firm's object (name, type, etc.)
 *   2. Update SECURITIES_DISCLOSURE_TEMPLATE with the firm's required language
 *   3. Update TAX_HARVESTING_DISCLOSURE_TEMPLATE similarly
 *   4. Ship the PR. Affected templates immediately resume working.
 */

export interface BDAffiliation {
  /** Broker-dealer legal name (e.g., "Gradient Securities, LLC"). */
  bd_name: string
  /** Registered Investment Advisor legal name, if separate. */
  ria_name?: string
  /** Member registrations (e.g., "FINRA/SIPC"). */
  member_of: string
  /** Are RPI and this BD affiliated entities? */
  is_affiliated_with_rpi: boolean
  /** Effective date of affiliation. */
  effective_date: string
}

/**
 * Active BD affiliation. Null = no active securities relationship.
 * When null, all Securities-disclosure generators throw at runtime.
 */
export const ACTIVE_BD_AFFILIATION: BDAffiliation | null = null

/**
 * Securities disclosure (life insurance / broad use).
 * Throws if no active BD affiliation. Call this instead of hardcoding.
 */
export function getSecuritiesDisclosure(): string {
  if (!ACTIVE_BD_AFFILIATION) {
    throw new Error(
      'SECURITIES_DISCLOSURE_GATE: No active BD affiliation. ' +
        'RPI is between securities firms as of 2026-04-13 (Gradient relationship ended). ' +
        'Do not generate client-facing docs that require a Securities disclosure until a new BD is selected. ' +
        'To lift this gate: update ACTIVE_BD_AFFILIATION in packages/core/src/que/generators/disclosures.ts.'
    )
  }
  const bd = ACTIVE_BD_AFFILIATION
  return `This presentation is for educational and planning purposes only. Life insurance illustrations are not projections or guarantees. Premium quotes are estimates pending underwriting. Products may not be available in all states. Retirement Protectors, Inc. and its agents are licensed life insurance producers. Securities offered through ${bd.bd_name}, member ${bd.member_of}. This is not a solicitation where prohibited by law.`
}

/**
 * Tax harvesting disclosure.
 * Throws if no active BD affiliation. Call this instead of hardcoding.
 */
export function getTaxHarvestingDisclosure(): string {
  if (!ACTIVE_BD_AFFILIATION) {
    throw new Error(
      'SECURITIES_DISCLOSURE_GATE: No active BD affiliation. ' +
        'RPI is between securities firms as of 2026-04-13 (Gradient relationship ended). ' +
        'Tax-harvesting docs cannot be generated until a new BD is selected. ' +
        'To lift this gate: update ACTIVE_BD_AFFILIATION in packages/core/src/que/generators/disclosures.ts.'
    )
  }
  const bd = ACTIVE_BD_AFFILIATION
  const riaLine = bd.ria_name
    ? `Advisory services offered through ${bd.ria_name}, a registered investment advisor. `
    : ''
  const affilLine = bd.is_affiliated_with_rpi
    ? ''
    : `Retirement Protectors, Inc. and ${bd.ria_name ?? bd.bd_name} are not affiliated entities. `
  return `This analysis is provided for informational purposes only and does not constitute tax, legal, or investment advice. Tax lot selection and liquidation strategies should be reviewed with a qualified tax advisor. Securities offered through ${bd.bd_name}, member ${bd.member_of}. ${riaLine}${affilLine}Past performance is not indicative of future results.`
}

/**
 * Portfolio insights / advisory disclosure.
 * Throws if no active BD affiliation. Call this instead of hardcoding.
 */
export function getPortfolioAdvisoryDisclosure(): string {
  if (!ACTIVE_BD_AFFILIATION) {
    throw new Error(
      'SECURITIES_DISCLOSURE_GATE: No active BD affiliation. ' +
        'RPI is between securities firms as of 2026-04-13 (Gradient relationship ended). ' +
        'Portfolio advisory docs cannot be generated until a new BD is selected. ' +
        'To lift this gate: update ACTIVE_BD_AFFILIATION in packages/core/src/que/generators/disclosures.ts.'
    )
  }
  const bd = ACTIVE_BD_AFFILIATION
  const riaLine = bd.ria_name
    ? ` and ${bd.ria_name}`
    : ''
  return `This document is for educational purposes only. All portfolio analysis is based on individual suitability assessment. Not all clients will be suitable for all strategies described. Investment advisory services offered through ${bd.bd_name} (Member ${bd.member_of})${riaLine}. Past performance does not guarantee future results. This material is for informational purposes only.`
}
