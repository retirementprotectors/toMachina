// Ported from RAPID_CORE CORE_Database.gs FIELD_NORMALIZERS
// 90+ fields, 16 normalizer types

export function normalizeName(raw: string): string {
  if (!raw) return ''
  return raw.trim().replace(/\s+/g, ' ').split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')
}

export function normalizePhone(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1)
  return digits
}

export function normalizeEmail(raw: string): string {
  if (!raw) return ''
  return raw.trim().toLowerCase()
}

export function normalizeZip(raw: string | number): string {
  if (raw == null) return ''
  return String(raw).padStart(5, '0')
}

export function normalizeState(raw: string): string {
  if (!raw) return ''
  return raw.trim().toUpperCase().slice(0, 2)
}

export function normalizeDate(raw: string | Date): string {
  if (!raw) return ''
  if (typeof raw === 'string') {
    const match = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear()
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0')
    const d = String(raw.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(raw)
}

export function normalizeAmount(raw: string | number): number {
  if (raw == null) return 0
  if (typeof raw === 'number') return raw
  const cleaned = raw.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
