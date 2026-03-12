// ---------------------------------------------------------------------------
// DEX Config — Constants ported from DEX_Config.gs
// ---------------------------------------------------------------------------

import {
  PipelineStatus,
  DeliveryMethod,
  MappingStatus,
  FormStatus,
  FieldType,
  InputType,
} from './types'

// ============================================================================
// Pipeline statuses
// ============================================================================

export const PIPELINE_STATUSES: readonly string[] = Object.values(PipelineStatus)

// ============================================================================
// Delivery methods
// ============================================================================

export const DELIVERY_METHODS: readonly string[] = Object.values(DeliveryMethod)

// ============================================================================
// Mapping statuses
// ============================================================================

export const MAPPING_STATUSES: readonly string[] = Object.values(MappingStatus)

// ============================================================================
// Form statuses
// ============================================================================

export const FORM_STATUSES: readonly string[] = Object.values(FormStatus)

// ============================================================================
// Form sources
// ============================================================================

export const SOURCES = {
  GS: 'GS',
  GWM: 'GWM',
  GI: 'GI',
  SCHWAB: 'Schwab',
  RBC: 'RBC',
  CARRIER: 'Carrier',
  CLIENT: 'Client',
  ADVISOR: 'Advisor',
} as const

export type Source = (typeof SOURCES)[keyof typeof SOURCES]

// ============================================================================
// Form categories
// ============================================================================

export const CATEGORIES = {
  FIRM_CLIENT: 'Firm:Client',
  FIRM_ACCOUNT: 'Firm:Account',
  PRODUCT_GI: 'Product:GI',
  PRODUCT_SCHWAB: 'Product:Schwab',
  PRODUCT_RBC: 'Product:RBC',
  PRODUCT_CARRIER: 'Product:Carrier',
  DISCLOSURE: 'Disclosure',
  SUPPORTING: 'Supporting',
} as const

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES]

export const CATEGORY_LIST: readonly string[] = Object.values(CATEGORIES)

// ============================================================================
// Product platforms for Kit Builder
// ============================================================================

export const PLATFORMS = [
  'GWM (Schwab)',
  'RBC Brokerage',
  'VA (Direct)',
  'FIA (Direct)',
  'VUL (Direct)',
  'MF (Direct)',
  'REIT',
  '401k',
  'Financial Planning',
  'Estate Guru',
  'Medicare Advantage',
  'Medicare Supplement',
  'Part D',
] as const

export type Platform = (typeof PLATFORMS)[number]

// ============================================================================
// Registration types
// ============================================================================

export const REGISTRATION_TYPES = [
  'Traditional IRA',
  'Roth IRA',
  'Individual (NQ)',
  'Joint WROS',
  'Trust',
  '401k/ERISA',
  'Legal Entity',
] as const

export type RegistrationType = (typeof REGISTRATION_TYPES)[number]

// ============================================================================
// Account actions
// ============================================================================

export const ACCOUNT_ACTIONS = [
  'New Account',
  'LPOA/Transfer',
  'ACAT Transfer',
  'Add Money ($10K+)',
] as const

export type AccountAction = (typeof ACCOUNT_ACTIONS)[number]

// ============================================================================
// Field types (PDF-level)
// ============================================================================

export const FIELD_TYPES: readonly string[] = Object.values(FieldType)

// ============================================================================
// Input types (UX rendering)
// ============================================================================

export const INPUT_TYPES: readonly string[] = Object.values(InputType)

// ============================================================================
// Firestore collection names
// ============================================================================

export const COLLECTIONS = {
  FORMS: 'dex_forms',
  FIELD_MAPPINGS: 'dex_field_mappings',
  RULES: 'dex_rules',
  KITS: 'dex_kits',
  PACKAGES: 'dex_packages',
  TAXONOMY_CARRIERS: 'taxonomy_carriers',
  TAXONOMY_PRODUCTS: 'taxonomy_products',
  TAXONOMY_ACCOUNT_TYPES: 'taxonomy_account_types',
  TAXONOMY_TRANSACTIONS: 'taxonomy_transactions',
} as const

// ============================================================================
// Firm data (static, for form pre-fill)
// ============================================================================

export const FIRM_DATA: Record<string, string> = {
  name: 'Gradient Securities',
  name_gwm: 'Gradient Wealth Management',
  name_gi: 'Gradient Investments',
  address: '11550 Ash St Suite 200',
  city: 'Leawood',
  state: 'KS',
  zip: '66211',
  phone: '(855) 855-4772',
  crd_gs: '159174',
  crd_gwm: '159258',
}
