// ---------------------------------------------------------------------------
// DEX Mappings — Option presets, UX config builder, data source resolution
// Ported from DEX_FieldMappings.gs
// ---------------------------------------------------------------------------

import type {
  DexFieldMapping,
  DexFieldUxConfig,
  DexValidationRules,
  DataSourceNamespace,
  OptionPresetName,
} from './types'
import { InputType, FieldType } from './types'
import { FIRM_DATA } from './config'

// ============================================================================
// Option Presets — 10 pre-built option arrays for common fields
// ============================================================================

export const OPTION_PRESETS: Record<OptionPresetName, readonly string[]> = {
  YES_NO: ['Yes', 'No'],
  YES_NO_NA: ['Yes', 'No', 'N/A'],
  GENDER: ['Male', 'Female', 'Other', 'Prefer not to say'],
  MARITAL_STATUS: ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic Partner'],
  EMPLOYMENT_STATUS: ['Employed', 'Self-Employed', 'Retired', 'Unemployed', 'Student'],
  ACCOUNT_TYPE: ['Individual', 'Joint', 'Trust', 'IRA', 'Roth IRA', '401(k)', 'SEP IRA'],
  BENEFICIARY_TYPE: ['Primary', 'Contingent'],
  RELATIONSHIP: [
    'Spouse', 'Child', 'Parent', 'Sibling',
    'Other Family', 'Non-Family', 'Trust', 'Estate', 'Charity',
  ],
  ID_TYPE: ['Driver License', 'State ID', 'Passport', 'Military ID'],
  US_STATES: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
  ],
} as const

// ============================================================================
// UX Config Builder — convert a mapping to frontend-ready config
// ============================================================================

/**
 * Convert a DexFieldMapping into a UX-focused config object
 * suitable for rendering form inputs in the UI.
 */
export function buildUxConfig(mapping: DexFieldMapping): DexFieldUxConfig {
  return {
    mapping_id: mapping.mapping_id,
    field_name: mapping.field_name,
    label: mapping.label || humanizeFieldName(mapping.field_name),
    input_type: mapping.input_type || inferInputType(mapping.field_type),
    field_type: mapping.field_type,
    data_source: mapping.data_source,
    required: mapping.required,
    default_value: mapping.default_value,
    options: mapping.options || [],
    help_text: mapping.help_text || '',
    validation: mapping.validation || {},
  }
}

/**
 * Build UX configs for an array of mappings.
 */
export function buildUxConfigs(mappings: DexFieldMapping[]): DexFieldUxConfig[] {
  return mappings.map(buildUxConfig)
}

// ============================================================================
// Data Source Resolution
// ============================================================================

/**
 * Parse a data source reference into namespace + field.
 * Returns null if the reference is malformed.
 */
export function parseDataSource(source: string): { namespace: DataSourceNamespace; field: string } | null {
  if (!source || !source.includes('.')) return null
  const dotIndex = source.indexOf('.')
  const namespace = source.substring(0, dotIndex) as DataSourceNamespace
  const field = source.substring(dotIndex + 1)
  if (!field) return null
  const validNamespaces: DataSourceNamespace[] = ['client', 'account', 'advisor', 'firm', 'static', 'input']
  if (!validNamespaces.includes(namespace)) return null
  return { namespace, field }
}

/**
 * Resolve a data source reference to a concrete value.
 *
 * @param source     - Fully qualified source (e.g. "client.first_name")
 * @param clientData - Client record fields
 * @param accountData - Account record fields
 * @param inputData  - User-provided input at generation time
 * @param advisorData - Advisor record fields
 * @param defaultValue - Fallback if no resolution found
 */
export function resolveDataSource(
  source: string,
  clientData: Record<string, unknown> = {},
  accountData: Record<string, unknown> = {},
  inputData: Record<string, unknown> = {},
  advisorData: Record<string, unknown> = {},
  defaultValue = '',
): string {
  const parsed = parseDataSource(source)
  if (!parsed) return defaultValue

  const { namespace, field } = parsed
  let value: unknown = ''

  switch (namespace) {
    case 'client':
      value = clientData[field]
      break
    case 'account':
      value = accountData[field]
      break
    case 'input':
      value = inputData[field]
      break
    case 'firm':
      value = FIRM_DATA[field]
      break
    case 'advisor':
      value = advisorData[field]
      break
    case 'static':
      // For static sources, the field name IS the value
      value = field
      break
  }

  const result = value != null && value !== '' ? String(value) : ''
  return result || defaultValue
}

// ============================================================================
// Mapping Validation
// ============================================================================

/** Errors found during mapping validation */
export interface MappingValidationError {
  mapping_id: string
  field: string
  message: string
}

/**
 * Validate an array of field mappings for common issues:
 * - Missing mapping_id
 * - Missing form_id
 * - Missing field_name
 * - Invalid data source format
 * - Dropdown/radio without options
 */
export function validateMappings(mappings: DexFieldMapping[]): MappingValidationError[] {
  const errors: MappingValidationError[] = []

  for (const m of mappings) {
    if (!m.mapping_id) {
      errors.push({ mapping_id: m.mapping_id || '(empty)', field: 'mapping_id', message: 'Missing mapping_id' })
    }
    if (!m.form_id) {
      errors.push({ mapping_id: m.mapping_id, field: 'form_id', message: 'Missing form_id' })
    }
    if (!m.field_name) {
      errors.push({ mapping_id: m.mapping_id, field: 'field_name', message: 'Missing field_name' })
    }
    if (m.data_source && !parseDataSource(m.data_source)) {
      errors.push({ mapping_id: m.mapping_id, field: 'data_source', message: `Invalid data source format: "${m.data_source}". Expected namespace.field` })
    }
    const inputType = m.input_type || ''
    if ((inputType === InputType.DROPDOWN || inputType === InputType.RADIO) && (!m.options || m.options.length === 0)) {
      errors.push({ mapping_id: m.mapping_id, field: 'options', message: `${inputType} field "${m.field_name}" has no options defined` })
    }
  }

  return errors
}

// ============================================================================
// Format helpers
// ============================================================================

/**
 * Format a resolved value based on its field type.
 */
export function formatFieldValue(value: string, fieldType: FieldType | string): string {
  if (!value) return ''

  switch (fieldType) {
    case FieldType.DATE: {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
      }
      return value
    }
    case FieldType.PHONE: {
      const digits = value.replace(/\D/g, '')
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      }
      return value
    }
    case FieldType.SSN:
      // Pass-through; masking is a display concern
      return value
    case FieldType.CURRENCY: {
      const num = parseFloat(value)
      if (!isNaN(num)) {
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      return value
    }
    case FieldType.PERCENT: {
      const pct = parseFloat(value)
      if (!isNaN(pct)) {
        return `${pct.toFixed(2)}%`
      }
      return value
    }
    default:
      return value
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Infer an InputType from a FieldType when no explicit input_type is set.
 */
function inferInputType(fieldType: FieldType | string): InputType | string {
  switch (fieldType) {
    case FieldType.DATE: return InputType.DATE
    case FieldType.CHECKBOX: return InputType.CHECKBOX
    case FieldType.SIGNATURE: return InputType.SIGNATURE
    case FieldType.SSN: return InputType.SSN
    case FieldType.PHONE: return InputType.PHONE
    case FieldType.EMAIL: return InputType.EMAIL
    case FieldType.CURRENCY: return InputType.CURRENCY
    case FieldType.PERCENT: return InputType.PERCENT
    default: return InputType.TEXT
  }
}

/**
 * Convert a snake_case or dot-notation field name into a human-readable label.
 */
function humanizeFieldName(name: string): string {
  if (!name) return ''
  // Strip namespace prefix (e.g. client.first_name -> first_name)
  const field = name.includes('.') ? name.split('.').pop() || name : name
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
