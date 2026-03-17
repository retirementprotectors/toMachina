/**
 * calc-federal-tax
 * Federal income tax using 2025 marginal brackets.
 *
 * Formula: Apply standard deduction, then run through brackets:
 *   10% ($0-$23,850), 12% ($23,851-$96,950), 22% ($96,951-$206,700),
 *   24% ($206,701-$394,600), 32% ($394,601-$501,050), 35% ($501,051-$751,600),
 *   37% ($751,601+) — all MFJ
 *
 * Source: PROV+FEDS+STATE sheet
 */

import type { CalcResult, CalcFederalTaxInput, CalcFederalTaxResult, FilingStatus } from './types'
import { FEDERAL_BRACKETS_2025, STANDARD_DEDUCTIONS_2025 } from './data/tax-brackets-2025'

export function calcFederalTax(input: CalcFederalTaxInput): CalcResult<CalcFederalTaxResult> {
  const { grossIncome, filingStatus = 'mfj' } = input
  const standardDeduction = input.standardDeduction ?? STANDARD_DEDUCTIONS_2025[filingStatus] ?? STANDARD_DEDUCTIONS_2025.mfj
  const brackets = FEDERAL_BRACKETS_2025[filingStatus] || FEDERAL_BRACKETS_2025.mfj

  const taxableIncome = Math.max(0, grossIncome - standardDeduction)
  let federalTax = 0
  let marginalRate = 0

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break

    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min
    if (taxableInBracket > 0) {
      federalTax += taxableInBracket * bracket.rate
      marginalRate = bracket.rate
    }
  }

  federalTax = Math.round(federalTax * 100) / 100
  const effectiveRate = taxableIncome > 0
    ? Math.round((federalTax / taxableIncome) * 10000) / 10000
    : 0

  return {
    value: { taxableIncome, federalTax, effectiveRate, marginalRate, standardDeduction },
    breakdown: {
      grossIncome,
      standardDeduction,
      taxableIncome,
      federalTax,
    },
  }
}
