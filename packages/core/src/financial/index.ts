export { roundCurrency, normalizeRate } from './helpers'
// Note: normalizeAmount from helpers is distinct from normalizers/index.ts normalizeAmount
// This one validates numbers (non-negative), the normalizer one parses strings/currency
export { normalizeAmount as normalizeFinancialAmount } from './helpers'

export { calculateFYC, calculateRenewal, calculateOverride } from './fyc'
export { calculateNPV, calculateIRR } from './npv'
export { calculateDCF, calculateBookValue } from './dcf'
export {
  calculateAnnualRevenue,
  calculateMonthlyRevenue,
  projectRevenue,
  projectCashFlow,
} from './revenue'
export {
  calculateRmd,
  generateRmdSchedule,
  getDistributionPeriod,
  getRmdStartAge,
  isRmdEligible,
  type RmdInput,
  type RmdResult,
  type RmdScheduleRow,
} from './rmd'
