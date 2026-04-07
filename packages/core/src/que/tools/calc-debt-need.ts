/** calc-debt-need — Sum all outstanding debts */
import type { CalcResult, CalcDebtNeedInput, CalcDebtNeedResult } from './types'

export function calcDebtNeed(input: CalcDebtNeedInput): CalcResult<CalcDebtNeedResult> {
  const { mortgage = 0, autoLoans = 0, studentLoans = 0, creditCards = 0, otherDebt = 0 } = input
  const totalDebt = mortgage + autoLoans + studentLoans + creditCards + otherDebt
  return {
    value: { totalDebt },
    breakdown: { mortgage, autoLoans, studentLoans, creditCards, otherDebt, totalDebt },
  }
}
