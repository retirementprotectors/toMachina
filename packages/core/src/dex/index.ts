// ---------------------------------------------------------------------------
// DEX Core — barrel export
// ---------------------------------------------------------------------------

export * from './types'
export * from './config'
export {
  OPTION_PRESETS,
  buildUxConfig,
  buildUxConfigs,
  parseDataSource,
  resolveDataSource,
  validateMappings,
  formatFieldValue,
  type MappingValidationError,
} from './mappings'
export {
  filterByDomain,
  getCarriers,
  getCarriersByType,
  getCarrierById,
  getProducts,
  getProductsByCategory,
  getProductById,
  getAccountTypes,
  getAccountTypeById,
  getTransactions,
  getTransactionById,
  getTaxonomySummary,
  type TaxonomySummary,
} from './taxonomy'
export {
  TAF_MAP,
  evaluateRules,
  addSchwabForms,
  addRBCForms,
  addDisclosures,
  checkConditions,
} from './rules'
