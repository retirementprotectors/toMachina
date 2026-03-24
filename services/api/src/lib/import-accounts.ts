/**
 * import-accounts.ts
 * Account import orchestration — ported from GAS IMPORT_Account.gs (IK-002)
 *
 * Replaces:
 *   - parseAccountsFromCRM()
 *   - parseAccountsFromBoB()
 *   - validateAccountData()
 *   - normalizeAccountStatus()
 *   - importAccount()
 *   - importAccounts()
 *   - findOrCreateClient()
 *   - findExistingAccount()
 *   - buildAccountUpdates()
 *   - CRM field mappings + BoB carrier mappings
 *   - Account status map
 *
 * Firestore-native. No RAPID_CORE dependency.
 * Uses @tomachina/core normalizers + matching.
 */

import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import {
  normalizeCarrierName,
  normalizeProductType,
  normalizeDate,
  normalizeAmount,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseFullName,
  phoneDigits,
} from '@tomachina/core'
import { matchClient, matchAccount } from '@tomachina/core'
import { inferAccountType } from './account-type-inference.js'

// ============================================================================
// TYPES
// ============================================================================

export interface AccountParseOptions {
  /** CRM type for field mapping. Auto-detected if omitted. */
  crmType?: string
  /** Carrier name for BoB imports. Required for BoB source. */
  carrier?: string
  /** Source tag written to import_source field */
  source?: string
}

export interface ParsedAccount {
  client_id?: string
  client_name?: string
  client_first_name?: string
  client_last_name?: string
  client_dob?: string
  client_email?: string
  client_phone?: string
  product_type: string
  carrier_name: string
  carrier_id?: string
  policy_number: string
  effective_date: string
  status: string
  premium: number
  agent_name?: string
  account_category?: string
  _source: string
  _raw: Record<string, unknown>
  [key: string]: unknown
}

export interface ParseResult {
  parsed: ParsedAccount[]
  errors: Array<{
    row: number
    data: Record<string, unknown>
    errors: Array<{ field: string; message: string }>
  }>
  source: string
  crmType?: string
  carrier?: string
  totalRows: number
  parsedCount: number
  errorCount: number
}

export interface AccountValidation {
  valid: boolean
  errors: Array<{ field: string; message: string }>
  warnings: Array<{ field: string; message: string }>
}

export interface SingleImportResult {
  account_id: string
  client_id: string
  action: 'created' | 'updated' | 'skipped'
  reason?: string
  match_method?: string
  match_score?: number
  collection: string
}

export interface BatchImportResult {
  imported: number
  updated: number
  skipped: number
  errors: Array<{ index: number; error: string; details?: unknown }>
  summary: {
    total: number
    importedCount: number
    updatedCount: number
    skippedCount: number
    errorCount: number
    durationMs: number
  }
}

// ============================================================================
// STATUS NORMALIZATION — ported from IMPORT_Account.gs normalizeAccountStatus()
// ============================================================================

const VALID_ACCOUNT_STATUSES = [
  'active', 'pending', 'terminated', 'cancelled', 'lapsed', 'paid_up',
  'claim', 'surrendered', 'annuitized', 'closed', 'transferred',
  'enrolled', 'termed', 'disenrolled',
]

const ACCOUNT_STATUS_MAP: Record<string, string> = {
  'active': 'active',
  'in force': 'active',
  'inforce': 'active',
  'current': 'active',
  'pending': 'pending',
  'submitted': 'pending',
  'in progress': 'pending',
  'terminated': 'terminated',
  'term': 'terminated',
  'inactive': 'terminated',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'lapsed': 'lapsed',
  'lapse': 'lapsed',
  'claim': 'claim',
  'death claim': 'claim',
  'death_claim': 'claim',
  'claim paid': 'claim',
  'claim_paid': 'claim',
  'paid_up': 'paid_up',
  'paid up': 'paid_up',
  'paidup': 'paid_up',
  'surrendered': 'surrendered',
  'surrender': 'surrendered',
  'annuitized': 'annuitized',
  'closed': 'closed',
  'transferred': 'transferred',
  'enrolled': 'enrolled',
  'termed': 'termed',
  'disenrolled': 'disenrolled',
}

const DEFAULT_STATUS = 'active'

export function normalizeAccountStatus(status: string | undefined | null): string {
  if (!status) return DEFAULT_STATUS
  const lower = String(status).trim().toLowerCase()
  return ACCOUNT_STATUS_MAP[lower] || (VALID_ACCOUNT_STATUSES.includes(lower) ? lower : DEFAULT_STATUS)
}

// ============================================================================
// CRM FIELD MAPPINGS — ported from IMPORT_Account.gs getCRMFieldMapping()
// ============================================================================

const CRM_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  agencybloc: {
    client_name: 'Client Name',
    product_type: 'Policy Type',
    carrier: 'Insurance Company',
    policy_number: 'Policy Number',
    effective_date: 'Effective Date',
    status: 'Status',
    premium: 'Premium',
    agent_name: 'Agent',
  },
  hawksoft: {
    client_name: 'Insured Name',
    product_type: 'Line of Business',
    carrier: 'Company',
    policy_number: 'Policy #',
    effective_date: 'Eff Date',
    status: 'Policy Status',
    premium: 'Written Premium',
    agent_name: 'Producer',
  },
  radiusbob: {
    client_name: 'clientName',
    product_type: 'productType',
    carrier: 'carrier',
    policy_number: 'policyNumber',
    effective_date: 'effectiveDate',
    status: 'status',
    premium: 'premium',
    agent_name: 'agent',
  },
  generic: {
    client_name: 'client_name',
    product_type: 'product_type',
    carrier: 'carrier',
    policy_number: 'policy_number',
    effective_date: 'effective_date',
    status: 'status',
    premium: 'premium',
    agent_name: 'agent',
  },
}

// ============================================================================
// BOB CARRIER FIELD MAPPINGS — ported from IMPORT_Account.gs getBoBFieldMapping()
// ============================================================================

const BOB_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  'UnitedHealthcare': {
    client_first: 'Member First Name',
    client_last: 'Member Last Name',
    product_type: 'Plan Type',
    policy_number: 'Member ID',
    effective_date: 'Effective Date',
    status: 'Status',
    premium: 'Premium',
    dob: 'DOB',
  },
  'Aetna': {
    client_first: 'First Name',
    client_last: 'Last Name',
    product_type: 'Product',
    policy_number: 'Policy Number',
    effective_date: 'Eff Date',
    status: 'Policy Status',
    premium: 'Monthly Premium',
    dob: 'Date of Birth',
  },
  'Humana': {
    client_first: 'FirstName',
    client_last: 'LastName',
    product_type: 'ProductType',
    policy_number: 'PolicyNumber',
    effective_date: 'EffectiveDate',
    status: 'Status',
    premium: 'Premium',
    dob: 'BirthDate',
  },
}

const DEFAULT_BOB_MAPPING: Record<string, string> = {
  client_first: 'first_name',
  client_last: 'last_name',
  product_type: 'product_type',
  policy_number: 'policy_number',
  effective_date: 'effective_date',
  status: 'status',
  premium: 'premium',
  dob: 'dob',
}

// ============================================================================
// ACCOUNT CATEGORY ROUTING
// ============================================================================

const ACCOUNT_CATEGORY_MAP: Record<string, string> = {
  annuity: 'accounts_annuity',
  life: 'accounts_life',
  medicare: 'accounts_medicare',
  investments: 'accounts_investments',
  investment: 'accounts_investments',
  bdria: 'accounts_investments',
  bd_ria: 'accounts_investments',
}

// ============================================================================
// CRM TYPE DETECTION — ported from IMPORT_Account.gs detectAccountCRMType_()
// ============================================================================

function detectCRMType(sampleRow: Record<string, unknown>): string {
  const keys = Object.keys(sampleRow).map(k => k.toLowerCase())

  if (keys.some(k => k.includes('agencybloc') || k.includes('ab_'))) return 'agencybloc'
  if (keys.some(k => k.includes('hawksoft') || k.includes('hs_'))) return 'hawksoft'
  if (keys.some(k => k.includes('radius') || k.includes('rb_'))) return 'radiusbob'

  return 'generic'
}

// ============================================================================
// ROW MAPPING HELPERS
// ============================================================================

/** Case-insensitive row value lookup */
function getRowValue(row: Record<string, unknown>, sourceKey: string | undefined): unknown {
  if (!sourceKey) return null
  if (row[sourceKey] !== undefined) return row[sourceKey]

  const lower = sourceKey.toLowerCase()
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower) return row[k]
  }
  return null
}

function mapCRMRowToAccount(
  row: Record<string, unknown>,
  fieldMap: Record<string, string>,
): ParsedAccount {
  const getVal = (key: string) => getRowValue(row, fieldMap[key])

  return {
    client_name: getVal('client_name') ? String(getVal('client_name')) : undefined,
    product_type: normalizeProductType(String(getVal('product_type') ?? '')),
    carrier_name: normalizeCarrierName(String(getVal('carrier') ?? '')),
    policy_number: getVal('policy_number') ? String(getVal('policy_number')).trim() : '',
    effective_date: normalizeDate(getVal('effective_date')),
    status: normalizeAccountStatus(getVal('status') ? String(getVal('status')) : null),
    premium: normalizeAmount(getVal('premium')),
    agent_name: getVal('agent_name') ? String(getVal('agent_name')) : undefined,
    _source: 'CRM',
    _raw: row,
  }
}

function mapBoBRowToAccount(
  row: Record<string, unknown>,
  fieldMap: Record<string, string>,
  carrierName: string,
): ParsedAccount {
  const getVal = (key: string) => getRowValue(row, fieldMap[key])

  return {
    client_first_name: getVal('client_first') ? String(getVal('client_first')) : undefined,
    client_last_name: getVal('client_last') ? String(getVal('client_last')) : undefined,
    client_dob: normalizeDate(getVal('dob')),
    product_type: normalizeProductType(String(getVal('product_type') ?? '')),
    carrier_name: carrierName,
    policy_number: getVal('policy_number') ? String(getVal('policy_number')).trim() : '',
    effective_date: normalizeDate(getVal('effective_date')),
    status: normalizeAccountStatus(getVal('status') ? String(getVal('status')) : null),
    premium: normalizeAmount(getVal('premium')),
    _source: 'BoB',
    _raw: row,
  }
}

// ============================================================================
// VALIDATION — ported from IMPORT_Account.gs validateAccountData()
// ============================================================================

export function validateAccountData(account: Partial<ParsedAccount>): AccountValidation {
  const errors: Array<{ field: string; message: string }> = []
  const warnings: Array<{ field: string; message: string }> = []

  // Client linkage capability
  if (
    !account.client_id &&
    !account.client_name &&
    (!account.client_first_name || !account.client_last_name)
  ) {
    errors.push({ field: 'client', message: 'Must have client_id or client name for matching' })
  }

  // Product type required
  if (!account.product_type && !account.account_category) {
    errors.push({ field: 'product_type', message: 'Product type or account category is required' })
  }

  // Carrier required
  if (!account.carrier_name && !account.carrier_id) {
    errors.push({ field: 'carrier', message: 'Carrier name or carrier_id is required' })
  }

  // Status validation
  if (account.status && !VALID_ACCOUNT_STATUSES.includes(account.status)) {
    warnings.push({ field: 'status', message: `Unknown status "${account.status}", defaulting to active` })
  }

  // Premium validation
  if (account.premium !== undefined && account.premium !== null && account.premium < 0) {
    warnings.push({ field: 'premium', message: 'Premium is negative' })
  }

  // Date validation
  if (account.effective_date) {
    const date = new Date(account.effective_date)
    if (isNaN(date.getTime())) {
      warnings.push({ field: 'effective_date', message: 'Could not parse effective date' })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ============================================================================
// PARSING — ported from parseAccountsFromCRM() + parseAccountsFromBoB()
// ============================================================================

/**
 * Parse raw row data into normalized account records.
 * Supports CRM exports (AgencyBloc, HawkSoft, RadiusBob, generic)
 * and carrier BoB files (UHC, Aetna, Humana, generic).
 */
export function parseAccounts(
  data: Record<string, unknown>[],
  options: AccountParseOptions = {},
): ParseResult {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      parsed: [],
      errors: [],
      source: options.carrier ? 'BoB' : 'CRM',
      totalRows: 0,
      parsedCount: 0,
      errorCount: 0,
    }
  }

  const parsed: ParsedAccount[] = []
  const errors: ParseResult['errors'] = []

  if (options.carrier) {
    // BoB flow
    const carrierName = normalizeCarrierName(options.carrier)
    const fieldMap = BOB_FIELD_MAPPINGS[carrierName] || DEFAULT_BOB_MAPPING

    for (let i = 0; i < data.length; i++) {
      try {
        const account = mapBoBRowToAccount(data[i], fieldMap, carrierName)
        const validation = validateAccountData(account)
        if (!validation.valid) {
          errors.push({ row: i + 1, data: data[i], errors: validation.errors })
          continue
        }
        parsed.push(account)
      } catch (e) {
        errors.push({
          row: i + 1,
          data: data[i],
          errors: [{ field: 'parse', message: (e as Error).message }],
        })
      }
    }

    return {
      parsed,
      errors,
      source: 'BoB',
      carrier: carrierName,
      totalRows: data.length,
      parsedCount: parsed.length,
      errorCount: errors.length,
    }
  }

  // CRM flow
  const crmType = options.crmType || detectCRMType(data[0])
  const fieldMap = CRM_FIELD_MAPPINGS[crmType] || CRM_FIELD_MAPPINGS.generic

  for (let i = 0; i < data.length; i++) {
    try {
      const account = mapCRMRowToAccount(data[i], fieldMap)
      const validation = validateAccountData(account)
      if (!validation.valid) {
        errors.push({ row: i + 1, data: data[i], errors: validation.errors })
        continue
      }
      parsed.push(account)
    } catch (e) {
      errors.push({
        row: i + 1,
        data: data[i],
        errors: [{ field: 'parse', message: (e as Error).message }],
      })
    }
  }

  return {
    parsed,
    errors,
    source: 'CRM',
    crmType,
    totalRows: data.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
  }
}

// ============================================================================
// CLIENT RESOLUTION — ported from findOrCreateClient()
// ============================================================================

interface ClientResolution {
  clientId: string
  isNew: boolean
  matchScore?: number
  matchMethod?: string
}

/**
 * Resolve a client from account data — search Firestore by name/email/phone/DOB.
 * Returns existing client_id or creates a new client if `createClient` is true.
 */
export async function resolveClient(
  accountData: ParsedAccount,
  createClient: boolean,
): Promise<{ success: true; data: ClientResolution } | { success: false; error: string }> {
  const db = getFirestore()

  // If client_id already provided, verify it exists
  if (accountData.client_id) {
    const doc = await db.collection('clients').doc(accountData.client_id).get()
    if (doc.exists) {
      return { success: true, data: { clientId: accountData.client_id, isNew: false } }
    }
    return { success: false, error: `Client not found: ${accountData.client_id}` }
  }

  // Build name criteria
  let firstName = ''
  let lastName = ''

  if (accountData.client_name) {
    const parsed = parseFullName(accountData.client_name)
    firstName = parsed.firstName
    lastName = parsed.lastName
  } else {
    firstName = accountData.client_first_name || ''
    lastName = accountData.client_last_name || ''
  }

  if (!firstName && !lastName) {
    return { success: false, error: 'No client name available for matching' }
  }

  // Normalize for Firestore case-sensitive queries
  const normalizedFirst = normalizeName(firstName)
  const normalizedLast = normalizeName(lastName)

  // Query Firestore for candidates — last_name primary key
  const candidateSnap = await db
    .collection('clients')
    .where('last_name', '==', normalizedLast)
    .limit(50)
    .get()

  if (!candidateSnap.empty) {
    const candidates = candidateSnap.docs.map(d => ({ ...d.data(), client_id: d.id }) as Record<string, unknown> & { client_id: string })

    // Use core matchClient
    const result = matchClient(
      {
        firstName: normalizedFirst,
        lastName: normalizedLast,
        dob: accountData.client_dob || undefined,
        email: accountData.client_email || undefined,
        phone: accountData.client_phone || undefined,
      },
      candidates as Array<{ first_name?: string; last_name?: string; dob?: string; phone?: string; email?: string; ssn_last4?: string; status?: string; [key: string]: unknown }>,
      {
        normalizeName,
        normalizeDate,
        phoneDigits,
        normalizeEmail,
      },
    )

    if (result.match && result.score >= 75) {
      const matched = result.match as Record<string, unknown> & { client_id: string }
      return {
        success: true,
        data: {
          clientId: matched.client_id,
          isNew: false,
          matchScore: result.score,
          matchMethod: result.method,
        },
      }
    }
  }

  // No match found
  if (!createClient) {
    return { success: false, error: 'No matching client found and createClient is disabled' }
  }

  // Create new client
  const clientId = randomUUID()
  const now = new Date().toISOString()
  const newClient: Record<string, unknown> = {
    client_id: clientId,
    first_name: normalizedFirst,
    last_name: normalizedLast,
    status: 'active',
    import_source: 'ACCOUNT_IMPORT',
    created_at: now,
    updated_at: now,
  }
  if (accountData.client_dob) newClient.dob = accountData.client_dob
  if (accountData.client_email) newClient.email = normalizeEmail(accountData.client_email)
  if (accountData.client_phone) newClient.phone = normalizePhone(accountData.client_phone)

  await db.collection('clients').doc(clientId).set(newClient)

  return { success: true, data: { clientId, isNew: true } }
}

// ============================================================================
// DUPLICATE DETECTION — ported from findExistingAccount()
// ============================================================================

interface AccountDedupResult {
  isDuplicate: boolean
  existingId?: string
  matchMethod?: string
  matchScore?: number
}

/**
 * Check if an account already exists under this client.
 * Match by policy_number + carrier_name, or by effective_date + product_type.
 */
export async function checkAccountDuplicate(
  clientId: string,
  account: ParsedAccount,
): Promise<AccountDedupResult> {
  const db = getFirestore()
  const accountsSnap = await db
    .collection('clients')
    .doc(clientId)
    .collection('accounts')
    .get()

  if (accountsSnap.empty) {
    return { isDuplicate: false }
  }

  const policyNum = account.policy_number?.trim().toUpperCase()
  const carrierNorm = normalizeCarrierName(account.carrier_name || '')
  const effectiveDateNorm = normalizeDate(account.effective_date)

  for (const doc of accountsSnap.docs) {
    const existing = doc.data()
    if (existing.status === 'deleted') continue

    // Priority 1: exact policy_number + carrier match
    if (
      policyNum &&
      String(existing.policy_number || '').trim().toUpperCase() === policyNum &&
      normalizeCarrierName(existing.carrier_name || '') === carrierNorm
    ) {
      return {
        isDuplicate: true,
        existingId: doc.id,
        matchMethod: 'policy_carrier',
        matchScore: 100,
      }
    }

    // Priority 2: same carrier + same effective_date + same product_type
    if (
      carrierNorm &&
      normalizeCarrierName(existing.carrier_name || '') === carrierNorm &&
      effectiveDateNorm &&
      normalizeDate(existing.effective_date) === effectiveDateNorm &&
      normalizeProductType(existing.product_type || '') === normalizeProductType(account.product_type || '')
    ) {
      return {
        isDuplicate: true,
        existingId: doc.id,
        matchMethod: 'carrier_date_product',
        matchScore: 90,
      }
    }
  }

  return { isDuplicate: false }
}

// ============================================================================
// UPDATE BUILDER — ported from buildAccountUpdates()
// ============================================================================

const UPDATABLE_FIELDS = [
  'product_type', 'carrier_name', 'carrier_id', 'policy_number',
  'effective_date', 'status', 'premium', 'account_value',
  'agent_name', 'product_name', 'plan_name',
]

function buildAccountUpdates(
  newData: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  for (const field of UPDATABLE_FIELDS) {
    if (newData[field] !== undefined && newData[field] !== existing[field]) {
      updates[field] = newData[field]
    }
  }
  return updates
}

// ============================================================================
// SINGLE ACCOUNT IMPORT — ported from importAccount()
// ============================================================================

export interface ImportAccountOptions {
  /** Auto-create client if no match found. Default: true */
  createClient?: boolean
  /** Skip if duplicate found. Default: true */
  skipDuplicates?: boolean
  /** Import source tag. Default: 'ACCOUNT_IMPORT' */
  source?: string
  /** Triggering user email */
  triggeredBy?: string
}

/**
 * Import a single account — resolve client, dedup, then create or update.
 */
export async function importSingleAccount(
  accountData: ParsedAccount,
  options: ImportAccountOptions = {},
): Promise<{ success: true; data: SingleImportResult } | { success: false; error: string; details?: unknown }> {
  const db = getFirestore()
  const opts: Required<ImportAccountOptions> = {
    createClient: options.createClient !== false,
    skipDuplicates: options.skipDuplicates !== false,
    source: options.source || 'ACCOUNT_IMPORT',
    triggeredBy: options.triggeredBy || 'api',
  }

  // 1. Validate
  const validation = validateAccountData(accountData)
  if (!validation.valid) {
    return { success: false, error: 'Validation failed', details: validation.errors }
  }

  // 2. Resolve client
  const clientResult = await resolveClient(accountData, opts.createClient)
  if (!clientResult.success) {
    return { success: false, error: clientResult.error }
  }
  const { clientId } = clientResult.data

  // 3. Dedup check
  const dedupResult = await checkAccountDuplicate(clientId, accountData)

  if (dedupResult.isDuplicate && dedupResult.existingId) {
    if (opts.skipDuplicates) {
      return {
        success: true,
        data: {
          account_id: dedupResult.existingId,
          client_id: clientId,
          action: 'skipped',
          reason: 'duplicate',
          match_method: dedupResult.matchMethod,
          match_score: dedupResult.matchScore,
          collection: 'accounts',
        },
      }
    }

    // Update existing account
    const existingDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('accounts')
      .doc(dedupResult.existingId)
      .get()

    const existingData = existingDoc.data() || {}
    const updates = buildAccountUpdates(accountData as unknown as Record<string, unknown>, existingData)

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await db
        .collection('clients')
        .doc(clientId)
        .collection('accounts')
        .doc(dedupResult.existingId)
        .update(updates)

      return {
        success: true,
        data: {
          account_id: dedupResult.existingId,
          client_id: clientId,
          action: 'updated',
          match_method: dedupResult.matchMethod,
          match_score: dedupResult.matchScore,
          collection: 'accounts',
        },
      }
    }

    // Nothing to update
    return {
      success: true,
      data: {
        account_id: dedupResult.existingId,
        client_id: clientId,
        action: 'skipped',
        reason: 'no_changes',
        collection: 'accounts',
      },
    }
  }

  // 4. Infer account category
  const category = accountData.account_category
    || inferAccountType(accountData as unknown as Record<string, unknown>)
    || 'unknown'

  // 5. Create new account
  const accountId = randomUUID()
  const now = new Date().toISOString()
  const newAccount: Record<string, unknown> = {
    account_id: accountId,
    client_id: clientId,
    product_type: accountData.product_type,
    carrier_name: accountData.carrier_name,
    carrier_id: accountData.carrier_id || undefined,
    policy_number: accountData.policy_number || '',
    effective_date: accountData.effective_date || '',
    status: accountData.status || DEFAULT_STATUS,
    premium: accountData.premium || 0,
    account_category: category,
    import_source: opts.source,
    created_at: now,
    updated_at: now,
  }

  // Copy optional fields
  if (accountData.agent_name) newAccount.agent_name = accountData.agent_name
  if (accountData.account_category) newAccount.account_category = accountData.account_category

  // Strip undefined values
  for (const key of Object.keys(newAccount)) {
    if (newAccount[key] === undefined) delete newAccount[key]
  }

  // Write to subcollection
  await db.collection('clients').doc(clientId).collection('accounts').doc(accountId).set(newAccount)

  return {
    success: true,
    data: {
      account_id: accountId,
      client_id: clientId,
      action: 'created',
      collection: 'accounts',
    },
  }
}

// ============================================================================
// BATCH ACCOUNT IMPORT — ported from importAccounts()
// ============================================================================

/**
 * Import multiple accounts in sequence with per-record dedup + client resolution.
 * Unlike the simple batch in import.ts, this orchestrates the full GAS pipeline:
 * parse → validate → resolve client → dedup → create/update.
 */
export async function importAccountsBatch(
  accounts: ParsedAccount[],
  options: ImportAccountOptions = {},
): Promise<BatchImportResult> {
  const startTime = Date.now()
  const result: BatchImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    summary: {
      total: accounts.length,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      durationMs: 0,
    },
  }

  for (let i = 0; i < accounts.length; i++) {
    try {
      const importResult = await importSingleAccount(accounts[i], options)

      if (!importResult.success) {
        result.errors.push({ index: i, error: importResult.error, details: importResult.details })
        continue
      }

      switch (importResult.data.action) {
        case 'created':
          result.imported++
          break
        case 'updated':
          result.updated++
          break
        case 'skipped':
          result.skipped++
          break
      }
    } catch (e) {
      result.errors.push({ index: i, error: (e as Error).message })
    }
  }

  const durationMs = Date.now() - startTime
  result.summary = {
    total: accounts.length,
    importedCount: result.imported,
    updatedCount: result.updated,
    skippedCount: result.skipped,
    errorCount: result.errors.length,
    durationMs,
  }

  return result
}
