// ---------------------------------------------------------------------------
// CLIENT360 formatting utilities
// ---------------------------------------------------------------------------

/**
 * Format a 10-digit phone string as (XXX) XXX-XXXX.
 * Passes through non-conforming values unchanged.
 */
export function formatPhone(raw: unknown): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return String(raw)
}

/**
 * Compute age from a DOB string (YYYY-MM-DD or ISO).
 * Returns null if unparseable.
 */
export function getAge(dob: unknown): number | null {
  if (!dob) return null
  const d = new Date(String(dob))
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - d.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < d.getUTCDate())) {
    age--
  }
  return age >= 0 ? age : null
}

/**
 * Get initials from a full name (up to 2 chars).
 */
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Deterministic avatar color from a name string.
 * Returns an HSL color with fixed saturation/lightness.
 */
export function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 45%)`
}

/**
 * Format a date string as human-readable (e.g., "Jan 15, 1955").
 * Generic fallback date format.
 */
export function formatDate(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Medicare date format: MM-DD-YYYY (dashes).
 */
export function formatMedicareDate(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${mm}-${dd}-${yyyy}`
}

/**
 * License/DL date format: MM/DD/YYYY (slashes).
 */
export function formatLicenseDate(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Birthday format: Month Day, Year (full month name).
 * e.g., "January 15, 1955"
 */
export function formatBirthday(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Account date format: standard short date (e.g., "Jan 15, 2024").
 */
export function formatAccountDate(raw: unknown): string {
  return formatDate(raw)
}

/**
 * Format a number as USD currency ($X,XXX.XX).
 */
export function formatCurrency(raw: unknown): string {
  if (raw == null || raw === '') return ''
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  if (isNaN(num)) return String(raw)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Mask an SSN — always show only last 4 digits.
 * Input can be full 9 digits, formatted, or partial.
 */
export function maskSSN(raw: unknown): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length >= 4) {
    return `***-**-${digits.slice(-4)}`
  }
  return '***-**-****'
}

/**
 * Safely read a string field from the client's dynamic fields.
 */
export function str(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

/**
 * Convert a boolean-ish value to a display string.
 */
export function yesNo(val: unknown): 'Yes' | 'No' | '' {
  if (val == null || val === '') return ''
  if (val === true || val === 'true' || val === 'yes' || val === 'Yes' || val === 'TRUE' || val === 1) return 'Yes'
  if (val === false || val === 'false' || val === 'no' || val === 'No' || val === 'FALSE' || val === 0) return 'No'
  return ''
}
