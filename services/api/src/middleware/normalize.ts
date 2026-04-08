import { type Request, type Response, type NextFunction } from 'express'
import {
  normalizeName,
  normalizePhone,
  normalizeEmail,
  normalizeZip,
  normalizeState,
  normalizeDate,
  normalizeAmount,
} from '@tomachina/core'

/**
 * Field-to-normalizer mapping.
 * Mirrors RAPID_CORE FIELD_NORMALIZERS — maps field name patterns
 * to the normalizer function that should run on write operations.
 */
const NAME_FIELDS = [
  'first_name', 'last_name', 'middle_name', 'suffix', 'prefix',
  'spouse_first_name', 'spouse_last_name',
  'beneficiary_name', 'owner_name', 'agent_name',
  'carrier', 'product_name', 'plan_name',
  'city', 'employer_name', 'company_name',
]

const PHONE_FIELDS = [
  'phone', 'phone_home', 'phone_work', 'phone_mobile', 'phone_fax',
  'spouse_phone', 'emergency_phone',
]

const EMAIL_FIELDS = [
  'email', 'personal_email', 'spouse_email', 'agent_email',
  'manager_email', 'secondary_email',
]

const ZIP_FIELDS = ['zip', 'mailing_zip', 'billing_zip']

const STATE_FIELDS = ['state', 'mailing_state', 'billing_state']

const DATE_FIELDS = [
  'dob', 'spouse_dob', 'effective_date', 'issue_date', 'expiry_date',
  'termination_date', 'maturity_date', 'application_date',
  'created_at', 'updated_at', 'hire_date', 'start_date', 'end_date',
]

const AMOUNT_FIELDS = [
  'premium', 'face_amount', 'account_value', 'cash_value',
  'death_benefit', 'annual_premium', 'monthly_premium',
  'commission_amount', 'amount', 'value', 'target_premium',
  'excess_premium', 'loan_amount', 'withdrawal_amount',
  'total_assets', 'annual_income', 'net_worth',
]

/**
 * Normalize request body fields on write operations (POST, PATCH, PUT).
 * Runs the appropriate normalizer for each recognized field name.
 *
 * Usage: app.use('/api/clients', requireAuth, normalizeBody, clientRoutes)
 * Or applied selectively to write-only routes.
 */
export function normalizeBody(req: Request, _res: Response, next: NextFunction) {
  // Only normalize on write methods
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
    next()
    return
  }

  const body = req.body
  if (!body || typeof body !== 'object') {
    next()
    return
  }

  for (const [key, value] of Object.entries(body)) {
    if (value == null || value === '') continue

    if (NAME_FIELDS.includes(key) && typeof value === 'string') {
      body[key] = normalizeName(value)
    } else if (PHONE_FIELDS.includes(key) && typeof value === 'string') {
      body[key] = normalizePhone(value)
    } else if (EMAIL_FIELDS.includes(key) && typeof value === 'string') {
      body[key] = normalizeEmail(value)
    } else if (ZIP_FIELDS.includes(key)) {
      body[key] = normalizeZip(value as string | number)
    } else if (STATE_FIELDS.includes(key) && typeof value === 'string') {
      body[key] = normalizeState(value)
    } else if (DATE_FIELDS.includes(key)) {
      body[key] = normalizeDate(value as string | Date)
    } else if (AMOUNT_FIELDS.includes(key)) {
      body[key] = normalizeAmount(value as string | number)
    }
  }

  next()
}
