// ─── COVERAGE_GAP Super Tool ────────────────────────────────────────────────
// Chain: get_accounts → analyze_life_coverage → analyze_health_coverage → identify_gaps
// Output: Gap analysis report with priority ranking
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VoltronSuperToolDefinition,
  VoltronSuperResult,
  VoltronToolResult,
  VoltronContext,
} from '../types'

// ── Result Types ────────────────────────────────────────────────────────────

interface Account {
  account_id: string
  account_type: string
  account_type_category: string
  carrier: string
  policy_number: string
  status: string
  premium: number
  face_amount: number
  [key: string]: unknown
}

interface CoverageGapItem {
  gap_type: 'life' | 'health' | 'supplemental'
  severity: 'critical' | 'moderate' | 'low'
  description: string
  recommendation: string
  estimated_premium_range: string
}

interface CoverageAnalysis {
  category: string
  policies: Account[]
  total_coverage: number
  total_premium: number
  adequacy: 'adequate' | 'insufficient' | 'none'
}

interface CoverageGapResult {
  client_id: string
  life_analysis: CoverageAnalysis
  health_analysis: CoverageAnalysis
  gaps: CoverageGapItem[]
  priority_ranking: CoverageGapItem[]
  total_existing_coverage: number
  total_existing_premium: number
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'COVERAGE_GAP',
  name: 'Coverage Gap Analysis',
  description: 'Identifies insurance protection deficiencies across life and health coverage.',
  tools: ['get_accounts', 'analyze_life_coverage', 'analyze_health_coverage', 'identify_gaps'],
  entitlement_min: 'SPECIALIST',
}

// ── TM API Helper ───────────────────────────────────────────────────────────

async function callApi<T>(
  path: string,
  toolId: string,
  start: number,
): Promise<VoltronToolResult<T>> {
  const apiBase = process.env.TOMACHINA_API_URL ?? ''
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `API ${path} returned ${response.status}: ${response.statusText}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    const result = (await response.json()) as { success: boolean; data?: T; error?: string }
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? `API error on ${path}`,
        metadata: { duration_ms: Date.now() - start, tool_id: toolId },
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: { duration_ms: Date.now() - start, tool_id: toolId },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : `Failed to call ${path}`,
      metadata: { duration_ms: Date.now() - start, tool_id: toolId },
    }
  }
}

// ── Coverage Classification ─────────────────────────────────────────────────

const LIFE_TYPES = new Set(['life', 'term_life', 'whole_life', 'universal_life', 'variable_life', 'final_expense'])
const HEALTH_TYPES = new Set([
  'health', 'medicare', 'medicare_supplement', 'medigap', 'medicare_advantage',
  'dental', 'vision', 'hospital_indemnity', 'cancer', 'accident', 'critical_illness',
  'long_term_care', 'disability',
])

function isLifePolicy(account: Account): boolean {
  const type = (account.account_type || '').toLowerCase().replace(/[\s-]/g, '_')
  const category = (account.account_type_category || '').toLowerCase()
  return LIFE_TYPES.has(type) || category === 'life'
}

function isHealthPolicy(account: Account): boolean {
  const type = (account.account_type || '').toLowerCase().replace(/[\s-]/g, '_')
  const category = (account.account_type_category || '').toLowerCase()
  return HEALTH_TYPES.has(type) || category === 'health' || category === 'medicare'
}

function analyzeAdequacy(totalCoverage: number, policyCount: number): 'adequate' | 'insufficient' | 'none' {
  if (policyCount === 0) return 'none'
  if (totalCoverage < 50000) return 'insufficient'
  return 'adequate'
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<CoverageGapResult>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []

  try {
    // ── Stage 1: Get all accounts ─────────────────────────────────────
    const accountsResult = await callApi<Account[]>(
      `/api/clients/${encodeURIComponent(input.client_id)}/accounts`,
      'get_accounts',
      start,
    )
    toolResults.push(accountsResult)
    const allAccounts = accountsResult.data ?? []

    // ── Stage 2: Analyze life coverage ────────────────────────────────
    const lifePolicies = allAccounts.filter(isLifePolicy)
    const lifeCoverage = lifePolicies.reduce((sum, a) => sum + (a.face_amount || 0), 0)
    const lifePremium = lifePolicies.reduce((sum, a) => sum + (a.premium || 0), 0)
    const lifeAnalysis: CoverageAnalysis = {
      category: 'Life Insurance',
      policies: lifePolicies,
      total_coverage: lifeCoverage,
      total_premium: lifePremium,
      adequacy: analyzeAdequacy(lifeCoverage, lifePolicies.length),
    }

    toolResults.push({
      success: true,
      data: {
        client_id: input.client_id,
        life_policies: lifePolicies.length,
        total_coverage: lifeCoverage,
        adequacy: lifeAnalysis.adequacy,
      },
      metadata: { duration_ms: Date.now() - start, tool_id: 'analyze_life_coverage' },
    })

    // ── Stage 3: Analyze health coverage ──────────────────────────────
    const healthPolicies = allAccounts.filter(isHealthPolicy)
    const healthCoverage = healthPolicies.reduce((sum, a) => sum + (a.face_amount || 0), 0)
    const healthPremium = healthPolicies.reduce((sum, a) => sum + (a.premium || 0), 0)
    const healthAnalysis: CoverageAnalysis = {
      category: 'Health/Medicare Insurance',
      policies: healthPolicies,
      total_coverage: healthCoverage,
      total_premium: healthPremium,
      adequacy: analyzeAdequacy(healthCoverage, healthPolicies.length),
    }

    toolResults.push({
      success: true,
      data: {
        client_id: input.client_id,
        health_policies: healthPolicies.length,
        total_coverage: healthCoverage,
        adequacy: healthAnalysis.adequacy,
      },
      metadata: { duration_ms: Date.now() - start, tool_id: 'analyze_health_coverage' },
    })

    // ── Stage 4: Identify gaps and prioritize ─────────────────────────
    const gaps: CoverageGapItem[] = []

    if (lifeAnalysis.adequacy === 'none') {
      gaps.push({
        gap_type: 'life',
        severity: 'critical',
        description: 'No life insurance coverage on file',
        recommendation: 'Evaluate term or whole life options based on income replacement needs',
        estimated_premium_range: '$50-$300/month depending on age and health',
      })
    } else if (lifeAnalysis.adequacy === 'insufficient') {
      gaps.push({
        gap_type: 'life',
        severity: 'moderate',
        description: `Life coverage ($${lifeCoverage.toLocaleString()}) may be insufficient`,
        recommendation: 'Review coverage against 10x income replacement guideline',
        estimated_premium_range: '$25-$150/month for supplemental coverage',
      })
    }

    if (healthAnalysis.adequacy === 'none') {
      gaps.push({
        gap_type: 'health',
        severity: 'critical',
        description: 'No health/Medicare coverage on file',
        recommendation: 'Evaluate Medicare Supplement or Medicare Advantage plans',
        estimated_premium_range: '$100-$400/month depending on plan type',
      })
    }

    // Check for supplemental coverage gaps
    const hasHospitalIndemnity = allAccounts.some(
      a => (a.account_type || '').toLowerCase().includes('hospital'),
    )
    const hasDental = allAccounts.some(
      a => (a.account_type || '').toLowerCase().includes('dental'),
    )

    if (!hasHospitalIndemnity && healthPolicies.length > 0) {
      gaps.push({
        gap_type: 'supplemental',
        severity: 'low',
        description: 'No hospital indemnity coverage',
        recommendation: 'Consider hospital indemnity plan to cover out-of-pocket costs',
        estimated_premium_range: '$20-$80/month',
      })
    }

    if (!hasDental) {
      gaps.push({
        gap_type: 'supplemental',
        severity: 'low',
        description: 'No dental coverage on file',
        recommendation: 'Evaluate standalone dental plan options',
        estimated_premium_range: '$20-$60/month',
      })
    }

    // Priority ranking: critical first, then moderate, then low
    const severityOrder: Record<string, number> = { critical: 0, moderate: 1, low: 2 }
    const priorityRanking = [...gaps].sort(
      (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
    )

    const result: CoverageGapResult = {
      client_id: input.client_id,
      life_analysis: lifeAnalysis,
      health_analysis: healthAnalysis,
      gaps,
      priority_ranking: priorityRanking,
      total_existing_coverage: lifeCoverage + healthCoverage,
      total_existing_premium: lifePremium + healthPremium,
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    toolResults.push({
      success: true,
      data: result,
      metadata: { duration_ms: Date.now() - start, tool_id: 'identify_gaps' },
    })

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: {
        stages_completed: 4,
        stages_total: 4,
        total_gaps: gaps.length,
        critical_gaps: gaps.filter(g => g.severity === 'critical').length,
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
