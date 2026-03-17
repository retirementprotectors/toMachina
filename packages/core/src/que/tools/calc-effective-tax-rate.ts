/**
 * calc-effective-tax-rate
 * Combined federal + state effective tax rate.
 *
 * Formula: Effective Rate = (Federal Tax + State Tax) / Gross Income
 * Source: PROV+FEDS+STATE sheet
 */

import type { CalcResult, CalcEffectiveTaxRateInput, CalcEffectiveTaxRateResult } from './types'

export function calcEffectiveTaxRate(input: CalcEffectiveTaxRateInput): CalcResult<CalcEffectiveTaxRateResult> {
  const { federalTax, stateTax, grossIncome } = input

  const totalTax = Math.round((federalTax + stateTax) * 100) / 100
  const effectiveRate = grossIncome > 0
    ? Math.round((totalTax / grossIncome) * 10000) / 10000
    : 0
  const effectivePercent = Math.round(effectiveRate * 10000) / 100

  return {
    value: { effectiveRate, effectivePercent, totalTax },
    breakdown: { federalTax, stateTax, totalTax, grossIncome, effectiveRate },
  }
}
