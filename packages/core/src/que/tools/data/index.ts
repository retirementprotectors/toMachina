/**
 * QUE Tool Data — Re-exports
 */

export { IRS_UNIFORM_LIFETIME_TABLE } from './irs-uniform-lifetime'
export {
  STANDARD_DEDUCTIONS_2025,
  FEDERAL_BRACKETS_2025,
  STATE_TAX_RATES,
  CONFIG_KEY_TAX_BRACKETS,
  DEFAULT_TAX_BRACKETS_CONFIG,
} from './tax-brackets-2025'
export {
  IRMAA_BRACKETS_2024,
  IRMAA_BRACKETS_2025,
  getIrmaaBrackets,
  CONFIG_KEY_IRMAA_BRACKETS,
  DEFAULT_IRMAA_BRACKETS_CONFIG,
} from './irmaa-brackets'
export {
  CARRIER_PRODUCTS,
  findCarrierProducts,
  CONFIG_KEY_CARRIER_PRODUCTS,
  DEFAULT_CARRIER_PRODUCTS_CONFIG,
} from './carrier-products'
export { FYC_RATES, findFycRate } from './fyc-rates'
export { INDEX_RATES, findIndexRates } from './index-rates'
export { SURRENDER_SCHEDULES, findSurrenderSchedule } from './surrender-schedules'
export {
  COMMUNITY_PROPERTY_STATES,
  COMMUNITY_PROPERTY_STATE_NAMES,
  isCommunityPropertyState,
} from './community-property-states'
