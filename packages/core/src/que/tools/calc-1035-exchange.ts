/** calc-1035-exchange — Tax-free insurance policy transfer */
import type { CalcResult, Calc1035ExchangeInput, Calc1035ExchangeResult } from './types'

export function calc1035Exchange(input: Calc1035ExchangeInput): CalcResult<Calc1035ExchangeResult> {
  const { oldCashSurrenderValue, surrenderCharge = 0, oldBasis, newProductPremium } = input
  const transferAmount = oldCashSurrenderValue - surrenderCharge
  const basisCarryover = Math.min(oldBasis, transferAmount)
  const netGain = transferAmount - basisCarryover
  const taxSaved = Math.round(netGain * 0.25 * 100) / 100 // estimated 25% marginal rate
  return {
    value: { transferAmount, basisCarryover, netGain, taxSaved, newProductPremium },
    breakdown: { oldCashSurrenderValue, surrenderCharge, oldBasis, transferAmount, basisCarryover, netGain, taxSaved, newProductPremium },
  }
}
