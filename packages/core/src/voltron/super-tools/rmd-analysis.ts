// ─── RMD_ANALYSIS Super Tool ────────────────────────────────────────────────
// Chain: get_accounts → calculate_rmd → generate_recommendations
// Output: RMD amounts per account + withdrawal strategy recommendations
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
  balance: number
  [key: string]: unknown
}

interface RmdCalculation {
  account_id: string
  account_type: string
  carrier: string
  balance: number
  distribution_period: number
  rmd_amount: number
}

interface WithdrawalStrategy {
  account_id: string
  account_type: string
  recommended_amount: number
  recommended_timing: string
  rationale: string
}

interface RmdAnalysisResult {
  client_id: string
  tax_year: number
  rmd_calculations: RmdCalculation[]
  total_rmd: number
  withdrawal_strategy: WithdrawalStrategy[]
  qualified_account_count: number
  total_qualified_balance: number
  prepared_by: string
  prepared_at: string
}

export const definition: VoltronSuperToolDefinition = {
  super_tool_id: 'RMD_ANALYSIS',
  name: 'RMD Analysis',
  description: 'Tax planning analysis for required minimum distributions with withdrawal strategy.',
  tools: ['get_accounts', 'calculate_rmd', 'generate_recommendations'],
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

// ── IRS Uniform Lifetime Table (simplified for common ages) ─────────────────

const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
}

function getDistributionPeriod(age: number): number {
  if (age < 72) return 0 // No RMD required
  if (age > 95) return 8.9
  return UNIFORM_LIFETIME_TABLE[age] ?? 20.0
}

// ── RMD Qualified Account Types ─────────────────────────────────────────────

const QUALIFIED_TYPES = new Set([
  'traditional_ira',
  'ira',
  'sep_ira',
  'simple_ira',
  '401k',
  '403b',
  '457b',
  'inherited_ira',
])

function isQualifiedAccount(account: Account): boolean {
  const type = (account.account_type || '').toLowerCase().replace(/[\s-]/g, '_')
  const category = (account.account_type_category || '').toLowerCase()
  return QUALIFIED_TYPES.has(type) || category === 'qualified' || category === 'retirement'
}

// ── Execute ─────────────────────────────────────────────────────────────────

export async function execute(
  input: { client_id: string; params: Record<string, unknown> },
  context: VoltronContext,
): Promise<VoltronSuperResult<RmdAnalysisResult>> {
  const start = Date.now()
  const toolResults: VoltronToolResult[] = []
  const taxYear = (input.params.tax_year as number) || new Date().getFullYear()
  const clientAge = (input.params.client_age as number) || 73 // Default if not provided

  try {
    // ── Stage 1: Get accounts ─────────────────────────────────────────
    const accountsResult = await callApi<Account[]>(
      `/api/clients/${encodeURIComponent(input.client_id)}/accounts`,
      'get_accounts',
      start,
    )
    toolResults.push(accountsResult)
    const allAccounts = accountsResult.data ?? []
    const qualifiedAccounts = allAccounts.filter(isQualifiedAccount)

    // ── Stage 2: Calculate RMD per account ────────────────────────────
    const distributionPeriod = getDistributionPeriod(clientAge)
    const rmdCalculations: RmdCalculation[] = qualifiedAccounts.map(account => {
      const balance = account.balance || account.face_amount || 0
      const rmdAmount = distributionPeriod > 0 ? Math.round((balance / distributionPeriod) * 100) / 100 : 0

      return {
        account_id: account.account_id,
        account_type: account.account_type,
        carrier: account.carrier,
        balance,
        distribution_period: distributionPeriod,
        rmd_amount: rmdAmount,
      }
    })

    const totalRmd = rmdCalculations.reduce((sum, calc) => sum + calc.rmd_amount, 0)
    const totalQualifiedBalance = qualifiedAccounts.reduce(
      (sum, a) => sum + (a.balance || a.face_amount || 0),
      0,
    )

    toolResults.push({
      success: true,
      data: {
        client_id: input.client_id,
        tax_year: taxYear,
        client_age: clientAge,
        distribution_period: distributionPeriod,
        rmd_calculations: rmdCalculations,
        total_rmd: totalRmd,
      },
      metadata: { duration_ms: Date.now() - start, tool_id: 'calculate_rmd' },
    })

    // ── Stage 3: Generate withdrawal strategy ─────────────────────────
    const withdrawalStrategy: WithdrawalStrategy[] = rmdCalculations
      .filter(calc => calc.rmd_amount > 0)
      .map(calc => ({
        account_id: calc.account_id,
        account_type: calc.account_type,
        recommended_amount: calc.rmd_amount,
        recommended_timing: taxYear === new Date().getFullYear()
          ? 'Before December 31'
          : `Before April 1 (if first RMD year), otherwise December 31, ${taxYear}`,
        rationale: calc.rmd_amount > 10000
          ? 'Consider quarterly distributions to manage tax withholding'
          : 'Single annual distribution recommended for simplicity',
      }))

    const result: RmdAnalysisResult = {
      client_id: input.client_id,
      tax_year: taxYear,
      rmd_calculations: rmdCalculations,
      total_rmd: Math.round(totalRmd * 100) / 100,
      withdrawal_strategy: withdrawalStrategy,
      qualified_account_count: qualifiedAccounts.length,
      total_qualified_balance: totalQualifiedBalance,
      prepared_by: context.user_email,
      prepared_at: new Date().toISOString(),
    }

    toolResults.push({
      success: true,
      data: result,
      metadata: { duration_ms: Date.now() - start, tool_id: 'generate_recommendations' },
    })

    return {
      success: true,
      data: result,
      tool_results: toolResults,
      duration_ms: Date.now() - start,
      stats: {
        stages_completed: 3,
        stages_total: 3,
        qualified_accounts: qualifiedAccounts.length,
        total_rmd: totalRmd,
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
