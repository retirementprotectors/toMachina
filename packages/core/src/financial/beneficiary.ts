// ---------------------------------------------------------------------------
// Beneficiary Analysis Engine
// Identifies missing, incomplete, or outdated beneficiary designations
// ---------------------------------------------------------------------------

/**
 * Beneficiary designation info for a single beneficiary entry.
 */
export interface BeneficiaryInfo {
  name: string
  type: 'primary' | 'contingent'
  percentage: number
  relationship?: string
  trustName?: string
  isTrust?: boolean
}

/**
 * Result of analyzing a single account's beneficiary status.
 */
export interface BeneficiaryAnalysis {
  accountId: string
  clientId: string
  clientName: string
  accountType: string
  carrierName: string
  productName: string
  primaryBeneficiaries: BeneficiaryInfo[]
  contingentBeneficiaries: BeneficiaryInfo[]
  totalPrimaryPct: number
  totalContingentPct: number
  issueType: BeneficiaryIssueType
  issueLabel: string
  issueDetail: string
  recommendedAction: string
}

/**
 * Summary across all analyzed accounts.
 */
export interface BeneficiaryStatusSummary {
  total: number
  complete: number
  empty: number
  partial: number
  underAllocated: number
  conflict: number
  needsReview: number
  completenessRate: number
  issuesByCarrier: Record<string, number>
}

export type BeneficiaryIssueType =
  | 'ok'
  | 'empty'
  | 'partial'
  | 'under'
  | 'conflict'
  | 'reactive'

/**
 * Input data for beneficiary analysis of a single account.
 */
export interface BeneficiaryAccountInput {
  accountId: string
  accountType: string
  carrierName: string
  productName: string
  primaryBeneficiary: string
  primaryBeneficiaryPct: number
  contingentBeneficiary: string
  contingentBeneficiaryPct: number
  /** Raw beneficiaries JSON string (some accounts store structured data) */
  beneficiariesJson?: string
}

export interface BeneficiaryClientContext {
  clientId: string
  clientName: string
  spouseName: string
  maritalStatus: string
}

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Parse the beneficiaries JSON field into structured entries.
 * Some accounts store beneficiaries as a JSON array string in Firestore.
 */
function parseBeneficiariesJson(raw: string): BeneficiaryInfo[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((b: Record<string, unknown>) => ({
      name: String(b.name || b.beneficiary_name || ''),
      type: (String(b.type || 'primary').toLowerCase() === 'contingent' ? 'contingent' : 'primary') as 'primary' | 'contingent',
      percentage: parseFloat(String(b.percentage || b.pct || 0)) || 0,
      relationship: b.relationship ? String(b.relationship) : undefined,
      trustName: b.trust_name ? String(b.trust_name) : undefined,
      isTrust: Boolean(b.is_trust),
    }))
  } catch {
    return []
  }
}

/**
 * Analyze the beneficiary status of a single account.
 */
export function analyzeBeneficiary(
  account: BeneficiaryAccountInput,
  context: BeneficiaryClientContext,
): BeneficiaryAnalysis {
  let primaryBeneficiaries: BeneficiaryInfo[] = []
  let contingentBeneficiaries: BeneficiaryInfo[] = []

  // Try JSON-structured beneficiaries first
  if (account.beneficiariesJson) {
    const parsed = parseBeneficiariesJson(account.beneficiariesJson)
    primaryBeneficiaries = parsed.filter((b) => b.type === 'primary')
    contingentBeneficiaries = parsed.filter((b) => b.type === 'contingent')
  }

  // Fall back to flat fields if no JSON data
  if (primaryBeneficiaries.length === 0 && account.primaryBeneficiary) {
    primaryBeneficiaries = [{
      name: account.primaryBeneficiary.trim(),
      type: 'primary',
      percentage: isNaN(account.primaryBeneficiaryPct) ? 100 : account.primaryBeneficiaryPct || 100,
    }]
  }
  if (contingentBeneficiaries.length === 0 && account.contingentBeneficiary) {
    contingentBeneficiaries = [{
      name: account.contingentBeneficiary.trim(),
      type: 'contingent',
      percentage: isNaN(account.contingentBeneficiaryPct) ? 100 : account.contingentBeneficiaryPct || 100,
    }]
  }

  const totalPrimaryPct = primaryBeneficiaries.reduce((sum, b) => sum + b.percentage, 0)
  const totalContingentPct = contingentBeneficiaries.reduce((sum, b) => sum + b.percentage, 0)

  const hasPrimary = primaryBeneficiaries.length > 0 && primaryBeneficiaries.some((b) => b.name.length > 0)
  const hasContingent = contingentBeneficiaries.length > 0 && contingentBeneficiaries.some((b) => b.name.length > 0)
  const spouseNameLower = context.spouseName.toLowerCase()

  let issueType: BeneficiaryIssueType = 'ok'
  let issueLabel = 'Complete'
  let issueDetail = 'Primary and contingent designated'

  if (!hasPrimary) {
    issueType = 'empty'
    issueLabel = 'No Beneficiary'
    issueDetail = 'No beneficiary designation on file'
  } else if (totalPrimaryPct > 0 && totalPrimaryPct < 100) {
    issueType = 'under'
    issueLabel = 'Under 100%'
    issueDetail = `Primary allocation is ${totalPrimaryPct}%`
  } else if (!hasContingent) {
    issueType = 'partial'
    issueLabel = 'No Contingent'
    issueDetail = 'Has primary, missing contingent beneficiary'
  } else if (
    spouseNameLower &&
    primaryBeneficiaries.some((b) => b.name.toLowerCase().includes(spouseNameLower)) &&
    (context.maritalStatus === 'divorced' || context.maritalStatus === 'widowed')
  ) {
    issueType = 'reactive'
    issueLabel = 'Needs Review'
    issueDetail = `Primary is ${context.maritalStatus === 'divorced' ? 'ex-' : 'deceased '}spouse`
  }

  return {
    accountId: account.accountId,
    clientId: context.clientId,
    clientName: context.clientName,
    accountType: account.accountType,
    carrierName: account.carrierName,
    productName: account.productName,
    primaryBeneficiaries,
    contingentBeneficiaries,
    totalPrimaryPct,
    totalContingentPct,
    issueType,
    issueLabel,
    issueDetail,
    recommendedAction: getRecommendedAction(issueType, context.maritalStatus),
  }
}

/**
 * Get the recommended remediation action for a given issue type.
 */
export function getRecommendedAction(
  issueType: BeneficiaryIssueType,
  maritalStatus?: string,
): string {
  switch (issueType) {
    case 'empty':
      return 'Contact client to establish beneficiary designation. Schedule appointment for carrier-specific change form.'
    case 'partial':
      return 'Contact client to add contingent beneficiary. This protects against simultaneous death scenarios.'
    case 'under':
      return 'Verify allocation with client. Primary beneficiary percentages should total 100%. May require carrier form submission.'
    case 'conflict':
      return 'Review trust documents or divorce decree. Beneficiary may conflict with estate plan. Schedule with estate attorney.'
    case 'reactive':
      if (maritalStatus === 'divorced') {
        return 'Ex-spouse is listed as primary beneficiary. Contact client immediately to update designation. Check state ERISA rules.'
      }
      if (maritalStatus === 'widowed') {
        return 'Deceased spouse is listed as primary beneficiary. Contact client to update designation to living beneficiary or trust.'
      }
      return 'Life event detected that may require beneficiary update. Schedule client review.'
    case 'ok':
      return 'No action required. Beneficiary designations appear complete and current.'
  }
}

/**
 * Summarize beneficiary status across a set of analyzed accounts.
 */
export function summarizeBeneficiaryStatus(
  analyses: BeneficiaryAnalysis[],
): BeneficiaryStatusSummary {
  const summary: BeneficiaryStatusSummary = {
    total: analyses.length,
    complete: 0,
    empty: 0,
    partial: 0,
    underAllocated: 0,
    conflict: 0,
    needsReview: 0,
    completenessRate: 0,
    issuesByCarrier: {},
  }

  for (const a of analyses) {
    switch (a.issueType) {
      case 'ok': summary.complete++; break
      case 'empty': summary.empty++; break
      case 'partial': summary.partial++; break
      case 'under': summary.underAllocated++; break
      case 'conflict': summary.conflict++; break
      case 'reactive': summary.needsReview++; break
    }

    // Track issues by carrier
    if (a.issueType !== 'ok') {
      const carrier = a.carrierName || 'Unknown'
      summary.issuesByCarrier[carrier] = (summary.issuesByCarrier[carrier] || 0) + 1
    }
  }

  summary.completenessRate = summary.total > 0
    ? Math.round((summary.complete / summary.total) * 100)
    : 0

  return summary
}
