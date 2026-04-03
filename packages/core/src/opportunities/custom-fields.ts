/**
 * Pipeline-specific custom field schemas.
 * Defines which fields appear on opportunity forms for each pipeline type.
 *
 * Sprint 012 — Team Triage (TRK-S12-007 through TRK-S12-012)
 * Spec by: Nikki Gray
 */

// ============================================================================
// Field Definition Types
// ============================================================================

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'currency'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'file'

export interface CustomFieldDef {
  /** Machine key — stored in custom_fields object */
  key: string
  /** Human-readable label */
  label: string
  /** Field input type */
  type: CustomFieldType
  /** Required for form submission */
  required?: boolean
  /** Dropdown options (only for type: 'dropdown') */
  options?: string[]
  /** Placeholder text */
  placeholder?: string
}

export interface PipelineFieldSchema {
  /** Pipeline key this schema applies to */
  pipeline_key: string
  /** Human-readable pipeline name */
  pipeline_name: string
  /** Ordered list of custom fields */
  fields: CustomFieldDef[]
}

// ============================================================================
// Life Insurance Pipeline — 13 fields
// ============================================================================

export const LIFE_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'NBX_LIFE',
  pipeline_name: 'Life Insurance',
  fields: [
    { key: 'policy_number', label: 'Policy Number', type: 'text' },
    { key: 'product_name', label: 'Product Name', type: 'text', placeholder: 'Carrier product name' },
    { key: 'face_amount', label: 'Face Amount', type: 'currency' },
    { key: 'target_premium', label: 'Target Premium', type: 'currency' },
    { key: 'paramed_date', label: 'Paramed Date', type: 'date' },
    { key: 'premium_mode', label: 'Premium Mode', type: 'dropdown', options: ['Annual', 'Semi-Annual', 'Quarterly', 'Monthly'] },
    { key: 'initial_premium', label: 'Initial Premium', type: 'currency' },
    { key: 'funding_source', label: 'Funding Source', type: 'text' },
    { key: 'underwriting_class', label: 'Underwriting Class', type: 'dropdown', options: ['Preferred Plus', 'Preferred', 'Standard Plus', 'Standard', 'Table Rated'] },
    { key: 'proposed', label: 'Proposed', type: 'date' },
    { key: 'offered', label: 'Offered', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Annuity Pipeline — 8 fields
// ============================================================================

export const ANNUITY_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'NBX_ANNUITY',
  pipeline_name: 'Annuity',
  fields: [
    { key: 'policy_number', label: 'Policy Number', type: 'text' },
    { key: 'product_name', label: 'Product Name', type: 'text' },
    { key: 'initial_premium', label: 'Initial Premium', type: 'currency' },
    { key: 'funding_source', label: 'Funding Source', type: 'text' },
    { key: 'tax_status', label: 'Tax Status', type: 'dropdown', options: ['Qualified', 'Non-Qualified'] },
    { key: 'imo', label: 'IMO', type: 'text', placeholder: 'Signal, Gradient, etc.' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Investments Pipeline — 10 fields
// ============================================================================

export const INVESTMENTS_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'NBX_INVESTMENTS',
  pipeline_name: 'Investments',
  fields: [
    { key: 'account_number', label: 'Account Number', type: 'text' },
    { key: 'task_type', label: 'Task Type', type: 'dropdown', options: ['New Account', 'Transfer', 'Rollover', 'Distribution', 'Rebalance', 'Other'] },
    { key: 'tax_status', label: 'Tax Status', type: 'dropdown', options: ['IRA', 'Roth IRA', 'Joint', 'Trust', 'Individual', 'SEP', '401k', 'Other'] },
    { key: 'vendor', label: 'Vendor', type: 'dropdown', options: ['Schwab', 'RBC', 'Other'] },
    { key: 'submit_date', label: 'Submit Date', type: 'date' },
    { key: 'account_value', label: 'Account Value', type: 'currency' },
    { key: 'funding_source', label: 'Funding Source', type: 'text' },
    { key: 'modal_option', label: 'Modal Option', type: 'dropdown', options: ['Lump Sum', 'Systematic', 'Dollar Cost Averaging'] },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Medicare MAPD/PDP Pipeline — 7 fields
// ============================================================================

export const MEDICARE_MAPD_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'NBX_MEDICARE_MAPD',
  pipeline_name: 'Medicare MAPD / PDP',
  fields: [
    { key: 'product_name', label: 'Product Name', type: 'text' },
    { key: 'plan_id', label: 'Plan ID', type: 'text' },
    { key: 'plan_type', label: 'Plan Type', type: 'dropdown', options: ['MAPD', 'PDP'] },
    { key: 'premium_amount', label: 'Premium Amount', type: 'currency' },
    { key: 'requested_effective_date', label: 'Requested Effective Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Medicare Supplement / Ancillary Pipeline — 7 fields
// ============================================================================

export const MEDICARE_MEDSUP_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'NBX_MEDICARE_MEDSUP',
  pipeline_name: 'Medicare Supplement / Ancillary',
  fields: [
    { key: 'product_name', label: 'Product Name', type: 'text' },
    { key: 'plan_id', label: 'Plan ID', type: 'text' },
    { key: 'plan_type', label: 'Plan Type', type: 'dropdown', options: ['Med Supp', 'Dental', 'Vision', 'Hospital Indemnity', 'Cancer', 'Other'] },
    { key: 'premium_amount', label: 'Premium Amount', type: 'currency' },
    { key: 'requested_effective_date', label: 'Requested Effective Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Reactive Service — Medicare — 5 fields
// ============================================================================

export const REACTIVE_MEDICARE_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'REACTIVE_MEDICARE',
  pipeline_name: 'Reactive Service — Medicare',
  fields: [
    { key: 'plan_id', label: 'Plan ID', type: 'text' },
    { key: 'task_type', label: 'Task Type', type: 'dropdown', options: ['Disenrollment', 'Plan Change', 'Billing Issue', 'Provider Access', 'Prior Auth', 'Other'] },
    { key: 'sent_to_carrier_date', label: 'Sent to Carrier Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Reactive Service — Retirement — 5 fields
// ============================================================================

export const REACTIVE_RETIREMENT_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'REACTIVE_RETIREMENT',
  pipeline_name: 'Reactive Service — Retirement',
  fields: [
    { key: 'policy_number', label: 'Policy Number', type: 'text' },
    { key: 'task_type', label: 'Task Type', type: 'dropdown', options: ['RMD', 'Transfer', 'Beneficiary Change', 'Address Change', 'Surrender', 'Loan', 'Other'] },
    { key: 'sent_to_carrier_date', label: 'Sent to Carrier Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Delivery Pipeline — 5 fields
// ============================================================================

export const DELIVERY_FIELDS: PipelineFieldSchema = {
  pipeline_key: 'DELIVERY',
  pipeline_name: 'Delivery',
  fields: [
    { key: 'policy_number', label: 'Policy Number', type: 'text' },
    { key: 'delivery_method', label: 'Delivery Method', type: 'dropdown', options: ['In-Person', 'Mail', 'Virtual'] },
    { key: 'account_build_date', label: 'Account Build Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'file_upload', label: 'File Upload', type: 'file' },
  ],
}

// ============================================================================
// Registry — pipeline_key → field schema lookup
// ============================================================================

export const PIPELINE_FIELD_SCHEMAS: Record<string, PipelineFieldSchema> = {
  NBX_LIFE: LIFE_FIELDS,
  NBX_ANNUITY: ANNUITY_FIELDS,
  NBX_INVESTMENTS: INVESTMENTS_FIELDS,
  NBX_MEDICARE_MAPD: MEDICARE_MAPD_FIELDS,
  NBX_MEDICARE_MEDSUP: MEDICARE_MEDSUP_FIELDS,
  REACTIVE_MEDICARE: REACTIVE_MEDICARE_FIELDS,
  REACTIVE_RETIREMENT: REACTIVE_RETIREMENT_FIELDS,
  DELIVERY: DELIVERY_FIELDS,
}

/** Get the custom field schema for a pipeline key, or undefined if none defined */
export function getFieldSchema(pipelineKey: string): PipelineFieldSchema | undefined {
  return PIPELINE_FIELD_SCHEMAS[pipelineKey]
}

/** Get all pipeline keys that have custom field schemas */
export function getPipelineKeysWithFields(): string[] {
  return Object.keys(PIPELINE_FIELD_SCHEMAS)
}
