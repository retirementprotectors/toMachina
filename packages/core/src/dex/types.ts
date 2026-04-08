// ---------------------------------------------------------------------------
// DEX Core Types — Document Efficiency Xelerator
// Ported from DEX GAS engine (DEX_Config.gs, DEX_FieldMappings.gs,
// DEX_Rules.gs, DEX_Taxonomy.gs)
// ---------------------------------------------------------------------------

// ============================================================================
// Enums
// ============================================================================

/** PDF-level field types */
export enum FieldType {
  TEXT = 'text',
  DATE = 'date',
  CHECKBOX = 'checkbox',
  SIGNATURE = 'signature',
  SSN = 'ssn',
  PHONE = 'phone',
  EMAIL = 'email',
  CURRENCY = 'currency',
  PERCENT = 'percent',
}

/** UX rendering types (how the field is presented to users) */
export enum InputType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  DROPDOWN = 'dropdown',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  CHECKBOXES = 'checkboxes',
  DATE = 'date',
  SSN = 'ssn',
  PHONE = 'phone',
  EMAIL = 'email',
  CURRENCY = 'currency',
  PERCENT = 'percent',
  STATE = 'state',
  SIGNATURE = 'signature',
}

/** Field mapping status indicators */
export enum MappingStatus {
  AUTO_FILL = 'AUTO-FILL',
  USER_INPUT = 'USER INPUT',
  PENDING_DATA = 'PENDING DATA',
  UNMAPPED = 'UNMAPPED',
  NA = 'N/A',
}

/** Pipeline status for document packages */
export enum PipelineStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  SIGNED = 'SIGNED',
  SUBMITTED = 'SUBMITTED',
  COMPLETE = 'COMPLETE',
}

/** Form status in the library */
export enum FormStatus {
  ACTIVE = 'ACTIVE',
  TBD = 'TBD',
  NA = 'N/A',
}

/** Delivery methods for document packages */
export enum DeliveryMethod {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  BOTH = 'BOTH',
  DOWNLOAD = 'DOWNLOAD',
}

/** Rule layers (5-layer form selection engine) */
export enum RuleLayer {
  FIRM_CLIENT = 'Firm:Client',
  FIRM_ACCOUNT = 'Firm:Account',
  PRODUCT_CLIENT = 'Product:Client',
  SUPPORTING = 'Supporting',
  DISCLOSURES = 'Disclosure',
}

/** Taxonomy domain for filtering */
export type TaxonomyDomain = 'HEALTH' | 'WEALTH' | 'BOTH' | 'ALL'

/** Carrier types */
export type CarrierType = 'INSURANCE' | 'CUSTODIAN' | 'BD_RIA' | 'IMO'

/** Product categories */
export type ProductCategory = 'MEDICARE' | 'LIFE' | 'ANNUITY' | 'INVESTMENT' | 'ANCILLARY'

// ============================================================================
// Data Source Namespaces
// ============================================================================

/** Supported data source namespace prefixes */
export type DataSourceNamespace = 'client' | 'account' | 'advisor' | 'firm' | 'static' | 'input'

/** A fully qualified data source reference (e.g. "client.first_name") */
export type DataSourceRef = `${DataSourceNamespace}.${string}`

// ============================================================================
// Form
// ============================================================================

export interface DexForm {
  form_id: string
  form_name: string
  source: string
  category: string
  status: FormStatus | string
  document_type: string
  pdf_template_id?: string
  notes?: string
  created_at?: string
  updated_at?: string
  _created_by?: string
  _updated_by?: string
  [key: string]: unknown
}

// ============================================================================
// Field Mapping — 15-column schema
// ============================================================================

export interface DexFieldMapping {
  /** Unique mapping ID (e.g. MAP_001_001) */
  mapping_id: string
  /** Links to _FORM_LIBRARY */
  form_id: string
  /** Form name (for readability) */
  form_name: string
  /** PDF field name or placeholder */
  field_name: string
  /** PDF-level field type */
  field_type: FieldType | string
  /** Fully qualified data source (e.g. client.first_name) */
  data_source: string
  /** Whether the field is required */
  required: boolean
  /** Default value when no data available */
  default_value: string
  /** Additional notes */
  notes: string
  /** Mapping status */
  status: MappingStatus | string
  // --- UX Configuration (columns 11-15) ---
  /** How to render the input */
  input_type: InputType | string
  /** Options for dropdown/radio (JSON array) */
  options: string[]
  /** Friendly display label */
  label: string
  /** Guidance text for user */
  help_text: string
  /** Validation rules */
  validation: DexValidationRules
}

/** Validation rules attached to a field mapping */
export interface DexValidationRules {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  message?: string
  [key: string]: unknown
}

// ============================================================================
// Rules
// ============================================================================

/** Parameters passed into the rule engine to determine required forms */
export interface DexRuleParams {
  platform: string
  registrationType: string
  accountAction: string
  isTrust?: boolean
  isLShare?: boolean
  carrierId?: string
  productId?: string
}

/** Result of evaluating rules — forms organized by layer */
export interface DexRuleResult {
  layers: DexRuleLayers
  allForms: DexRuleFormEntry[]
  formCount: number
}

export interface DexRuleLayers {
  firmClient: DexRuleFormEntry[]
  firmAccount: DexRuleFormEntry[]
  productClient: DexRuleFormEntry[]
  supporting: DexRuleFormEntry[]
  disclosures: DexRuleFormEntry[]
}

/** A form entry with its assigned rule layer */
export interface DexRuleFormEntry {
  form_id: string
  form_name: string
  source?: string
  category?: string
  layer: RuleLayer | string
  [key: string]: unknown
}

// ============================================================================
// Kit & Package
// ============================================================================

export interface DexKit {
  kit_id: string
  client_id: string
  client_name: string
  product_type: string
  registration_type: string
  action: string
  rule_id?: string
  form_ids: string[]
  form_count: number
  status: string
  created_by: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface DexPackage {
  package_id: string
  kit_id: string
  client_id: string
  delivery_method: DeliveryMethod | string
  status: PipelineStatus | string
  sent_at?: string
  viewed_at?: string
  signed_at?: string
  submitted_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// ============================================================================
// Taxonomy
// ============================================================================

export interface TaxonomyCarrier {
  carrier_id: string
  carrier: string
  carrier_type: CarrierType | string
  domain: TaxonomyDomain | string
  [key: string]: unknown
}

export interface TaxonomyProduct {
  product_id: string
  product_name: string
  category: ProductCategory | string
  domain: TaxonomyDomain | string
  [key: string]: unknown
}

export interface TaxonomyAccountType {
  account_type_id: string
  account_type_name: string
  domain: TaxonomyDomain | string
  [key: string]: unknown
}

export interface TaxonomyTransaction {
  transaction_type_id: string
  transaction_type_name: string
  domain: TaxonomyDomain | string
  [key: string]: unknown
}

// ============================================================================
// UX Config (derived from a mapping for frontend consumption)
// ============================================================================

export interface DexFieldUxConfig {
  mapping_id: string
  field_name: string
  label: string
  input_type: InputType | string
  field_type: FieldType | string
  data_source: string
  required: boolean
  default_value: string
  options: string[]
  help_text: string
  validation: DexValidationRules
}

// ============================================================================
// Option Preset name type
// ============================================================================

export type OptionPresetName =
  | 'YES_NO'
  | 'YES_NO_NA'
  | 'GENDER'
  | 'MARITAL_STATUS'
  | 'EMPLOYMENT_STATUS'
  | 'ACCOUNT_TYPE'
  | 'BENEFICIARY_TYPE'
  | 'RELATIONSHIP'
  | 'ID_TYPE'
  | 'US_STATES'
