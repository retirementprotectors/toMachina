// ---------------------------------------------------------------------------
// Atomic Tool: validate-record
// Qualification gate — record must have (name + contact method) OR has account
// Ported from CLIENT_IMPORT_TOOL_CHAIN validate-client-qualification step
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition, AtomicToolResult } from '../types'

export const definition: AtomicToolDefinition = {
  tool_id: 'validate-record',
  name: 'Validate Record Qualification',
  description:
    'Filter gate: record must have (first_name + last_name + at least one contact method) OR an existing account reference. Records failing this check are filtered out.',
  used_by: ['SUPER_VALIDATE'],
}

/**
 * Contact methods considered valid for qualification.
 * A record qualifies if it has a name AND at least one of these.
 */
const CONTACT_FIELDS = ['phone', 'cell_phone', 'email', 'address', 'alternate_phone'] as const

/**
 * Account reference fields — if any is present, the record qualifies
 * even without a contact method (it can be matched to an existing client).
 */
const ACCOUNT_REF_FIELDS = ['policy_number', 'account_id', 'client_id', 'ghl_contact_id', 'medicare_id'] as const

export interface ValidateRecordInput {
  records: Record<string, unknown>[]
}

export interface ValidateRecordOutput {
  qualified: Record<string, unknown>[]
  disqualified: Array<{ record: Record<string, unknown>; reason: string }>
}

/**
 * Validate records against qualification rules.
 * Pure function — no Firestore or API dependencies.
 */
export function execute(
  input: ValidateRecordInput
): AtomicToolResult<ValidateRecordOutput> {
  const { records } = input

  if (!records || !Array.isArray(records)) {
    return { success: false, error: 'Input records must be an array' }
  }

  const qualified: Record<string, unknown>[] = []
  const disqualified: ValidateRecordOutput['disqualified'] = []

  for (const record of records) {
    const result = qualifyRecord(record)
    if (result.qualified) {
      qualified.push(record)
    } else {
      disqualified.push({ record, reason: result.reason })
    }
  }

  return {
    success: true,
    data: { qualified, disqualified },
    processed: records.length,
    passed: qualified.length,
    failed: disqualified.length,
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function qualifyRecord(record: Record<string, unknown>): { qualified: boolean; reason: string } {
  // Path 1: Has account reference — qualifies regardless
  const hasAccountRef = ACCOUNT_REF_FIELDS.some(
    (f) => record[f] != null && String(record[f]).trim() !== ''
  )
  if (hasAccountRef) {
    return { qualified: true, reason: '' }
  }

  // Path 2: Must have name + contact method
  const firstName = String(record.first_name || '').trim()
  const lastName = String(record.last_name || '').trim()

  if (!firstName && !lastName) {
    return { qualified: false, reason: 'Missing both first_name and last_name' }
  }

  if (!firstName) {
    return { qualified: false, reason: 'Missing first_name' }
  }

  if (!lastName) {
    return { qualified: false, reason: 'Missing last_name' }
  }

  const hasContact = CONTACT_FIELDS.some(
    (f) => record[f] != null && String(record[f]).trim() !== ''
  )

  if (!hasContact) {
    return { qualified: false, reason: 'Has name but no contact method (phone, email, or address)' }
  }

  return { qualified: true, reason: '' }
}
