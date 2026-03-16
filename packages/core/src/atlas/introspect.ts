// ---------------------------------------------------------------------------
// ATLAS Introspection Engine — column profiling + format matching
// Pure functions, no Express or Firestore dependencies.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto'
import type { AtlasFormat, ColumnMapping, FieldProfile } from './types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hash CSV headers into a fingerprint for format library lookup.
 * Sort headers, lowercase, trim, join with '|', SHA-256 hash.
 */
export function hashHeaderFingerprint(headers: string[]): string {
  const normalized = headers.map(h => h.trim().toLowerCase()).sort().join('|')
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Profile CSV columns from headers + sample rows.
 * For each column: count distinct values, detect dominant type, compute null rate, collect samples.
 */
export function profileCsvColumns(
  headers: string[],
  rows: Record<string, unknown>[]
): Record<string, FieldProfile> {
  const profiles: Record<string, FieldProfile> = {}

  for (const header of headers) {
    const values: unknown[] = []
    let nullCount = 0

    for (const row of rows) {
      const val = row[header]
      if (val === null || val === undefined || val === '') {
        nullCount++
      } else {
        values.push(val)
      }
    }

    profiles[header] = buildFieldProfile(values, nullCount, rows.length)
  }

  return profiles
}

/**
 * Profile a Firestore collection from sampled doc snapshots.
 * Same output shape as profileCsvColumns but from Firestore field values.
 */
export function profileCollection(
  docs: Record<string, unknown>[]
): Record<string, FieldProfile> {
  // Gather all unique field names across all docs
  const fieldNames = new Set<string>()
  for (const doc of docs) {
    for (const key of Object.keys(doc)) {
      fieldNames.add(key)
    }
  }

  const profiles: Record<string, FieldProfile> = {}

  for (const field of fieldNames) {
    const values: unknown[] = []
    let nullCount = 0

    for (const doc of docs) {
      const val = doc[field]
      if (val === null || val === undefined || val === '') {
        nullCount++
      } else {
        values.push(val)
      }
    }

    profiles[field] = buildFieldProfile(values, nullCount, docs.length)
  }

  return profiles
}

/**
 * Match CSV column profiles against collection field profiles.
 * Scoring:
 *   - Exact field name match: 100
 *   - In any carrier-format column_map: 95
 *   - Fuzzy name match (Levenshtein < 3): 80
 *   - Type overlap bonus: +60
 *   - Value intersection (>30% shared): +40
 * Normalize to 0-100. Auto-map >= 90, suggest 50-89, skip < 50.
 */
export function matchProfiles(
  csvProfiles: Record<string, FieldProfile>,
  collectionProfiles: Record<string, FieldProfile>,
  carrierColumnMaps: Record<string, string>[]
): ColumnMapping[] {
  const collectionFields = Object.keys(collectionProfiles)
  const mappings: ColumnMapping[] = []

  // Build a reverse lookup from all carrier column maps: csv_header -> firestore_field
  const carrierLookup = new Map<string, string>()
  for (const colMap of carrierColumnMaps) {
    for (const [rawHeader, canonField] of Object.entries(colMap)) {
      carrierLookup.set(rawHeader.toLowerCase(), canonField)
    }
  }

  for (const csvHeader of Object.keys(csvProfiles)) {
    const csvProfile = csvProfiles[csvHeader]
    const csvHeaderLower = csvHeader.toLowerCase().trim()

    // Score each collection field
    const candidates: { field: string; score: number }[] = []

    for (const collField of collectionFields) {
      const collProfile = collectionProfiles[collField]
      const collFieldLower = collField.toLowerCase().trim()
      let score = 0

      // 1. Exact name match
      if (csvHeaderLower === collFieldLower) {
        score = 100
      } else {
        // 2. Carrier column map match
        const mappedField = carrierLookup.get(csvHeaderLower)
        if (mappedField && mappedField.toLowerCase() === collFieldLower) {
          score = 95
        } else {
          // 3. Fuzzy name match
          const dist = levenshtein(csvHeaderLower, collFieldLower)
          if (dist < 3) {
            score = 80
          }
        }
      }

      // Type overlap bonus (only if we already have a base score)
      if (score > 0 && csvProfile.dominant_type === collProfile.dominant_type) {
        score = Math.min(100, score + 10)
      }

      // Value intersection bonus (only if we have samples to compare)
      if (score > 0) {
        const intersection = computeValueIntersection(csvProfile.sample_values, collProfile.sample_values)
        if (intersection > 0.3) {
          score = Math.min(100, score + 10)
        }
      }

      if (score > 0) {
        candidates.push({ field: collField, score })
      }
    }

    // Also check carrier maps for fields not in the collection yet
    const mappedField = carrierLookup.get(csvHeaderLower)
    if (mappedField) {
      const alreadyHas = candidates.some(c => c.field.toLowerCase() === mappedField.toLowerCase())
      if (!alreadyHas) {
        candidates.push({ field: mappedField, score: 90 })
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score)

    const best = candidates[0]
    const alternatives = candidates.slice(1, 4).map(c => ({
      field: c.field,
      confidence: c.score,
    }))

    if (best && best.score >= 90) {
      mappings.push({
        csv_header: csvHeader,
        firestore_field: best.field,
        confidence: best.score,
        status: 'auto',
        alternatives,
      })
    } else if (best && best.score >= 50) {
      mappings.push({
        csv_header: csvHeader,
        firestore_field: best.field,
        confidence: best.score,
        status: 'suggested',
        alternatives,
      })
    } else {
      mappings.push({
        csv_header: csvHeader,
        firestore_field: '',
        confidence: 0,
        status: 'unmapped',
        alternatives,
      })
    }
  }

  return mappings
}

/**
 * Match a header fingerprint against saved formats.
 * Exact match: return format + 100% confidence.
 * Partial (>80% header overlap): return format + overlap% confidence.
 * No match: return null.
 */
export function matchFingerprint(
  fingerprint: string,
  headers: string[],
  formats: AtlasFormat[]
): { format: AtlasFormat; confidence: number } | null {
  // 1. Check exact fingerprint match
  for (const fmt of formats) {
    if (fmt.header_fingerprint === fingerprint) {
      return { format: fmt, confidence: 100 }
    }
  }

  // 2. Check header overlap percentage
  const normalizedHeaders = new Set(headers.map(h => h.trim().toLowerCase()))

  let bestFormat: AtlasFormat | null = null
  let bestOverlap = 0

  for (const fmt of formats) {
    const fmtHeaders = Object.keys(fmt.column_map)
    if (fmtHeaders.length === 0) continue

    const fmtNormalized = new Set(fmtHeaders.map(h => h.trim().toLowerCase()))

    // Count how many of our headers exist in the format's column_map
    let matchCount = 0
    for (const h of normalizedHeaders) {
      if (fmtNormalized.has(h)) matchCount++
    }

    // Overlap = matched / max(our headers, format headers) for a fair measure
    const maxHeaders = Math.max(normalizedHeaders.size, fmtNormalized.size)
    const overlap = maxHeaders > 0 ? matchCount / maxHeaders : 0

    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestFormat = fmt
    }
  }

  // Require >80% overlap for a partial match
  if (bestFormat && bestOverlap > 0.8) {
    return { format: bestFormat, confidence: Math.round(bestOverlap * 100) }
  }

  return null
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Build a FieldProfile from collected non-null values.
 */
function buildFieldProfile(values: unknown[], nullCount: number, totalRows: number): FieldProfile {
  const distinct = new Set(values.map(v => String(v)))
  const nullRate = totalRows > 0 ? nullCount / totalRows : 0

  // Detect dominant type
  let dateCount = 0
  let numberCount = 0
  let currencyCount = 0
  let boolCount = 0
  let stringCount = 0

  for (const val of values) {
    const s = String(val).trim()
    if (isBooleanLike(s)) {
      boolCount++
    } else if (isCurrencyLike(s)) {
      currencyCount++
    } else if (isNumberLike(s)) {
      numberCount++
    } else if (isDateLike(s)) {
      dateCount++
    } else {
      stringCount++
    }
  }

  const counts: [string, number][] = [
    ['date', dateCount],
    ['number', numberCount],
    ['currency', currencyCount],
    ['boolean', boolCount],
    ['string', stringCount],
  ]
  counts.sort((a, b) => b[1] - a[1])

  const total = values.length
  const dominantEntry = counts[0]
  let dominant_type: FieldProfile['dominant_type'] = 'string'
  if (dominantEntry && total > 0) {
    // If the top type has >40% of values, use it. Otherwise 'mixed'.
    if (dominantEntry[1] / total >= 0.4) {
      dominant_type = dominantEntry[0] as FieldProfile['dominant_type']
    } else {
      dominant_type = 'mixed'
    }
  }

  // String lengths
  const lengths = values.map(v => String(v).length)
  const min_length = lengths.length > 0 ? Math.min(...lengths) : undefined
  const max_length = lengths.length > 0 ? Math.max(...lengths) : undefined

  // Collect up to 5 sample values
  const sample_values = values.slice(0, 5)

  return {
    distinct_count: distinct.size,
    sample_values,
    dominant_type,
    null_rate: Math.round(nullRate * 100) / 100,
    min_length,
    max_length,
  }
}

/**
 * Check if a string looks like a date.
 * Try Date.parse — if valid and within reasonable year range (1900-2100), it's a date.
 */
function isDateLike(val: string): boolean {
  // Skip pure numbers (they'd parse as timestamps)
  if (/^\d+(\.\d+)?$/.test(val)) return false

  const parsed = Date.parse(val)
  if (isNaN(parsed)) return false

  const year = new Date(parsed).getFullYear()
  return year >= 1900 && year <= 2100
}

/**
 * Check if a string looks like a number (after stripping formatting).
 */
function isNumberLike(val: string): boolean {
  const stripped = val.replace(/[,$%\s]/g, '')
  return stripped !== '' && !isNaN(parseFloat(stripped)) && isFinite(Number(stripped))
}

/**
 * Check if a string looks like a currency value (has $ or ends with %).
 */
function isCurrencyLike(val: string): boolean {
  return /^\s*\$/.test(val) || /^\s*-?\$/.test(val)
}

/**
 * Check if a string looks like a boolean.
 */
function isBooleanLike(val: string): boolean {
  const lower = val.toLowerCase()
  return lower === 'true' || lower === 'false' || lower === 'yes' || lower === 'no' || lower === 'y' || lower === 'n'
}

/**
 * Compute the intersection ratio of two sample value arrays.
 * Returns 0-1 representing how many values overlap.
 */
function computeValueIntersection(samplesA: unknown[], samplesB: unknown[]): number {
  if (samplesA.length === 0 || samplesB.length === 0) return 0

  const setB = new Set(samplesB.map(v => String(v).toLowerCase().trim()))
  let matchCount = 0

  for (const v of samplesA) {
    if (setB.has(String(v).toLowerCase().trim())) {
      matchCount++
    }
  }

  return matchCount / samplesA.length
}

/**
 * Levenshtein distance between two strings.
 * Used for fuzzy column name matching.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length

  if (m === 0) return n
  if (n === 0) return m

  // Use two rows instead of full matrix for memory efficiency
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)

  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      )
    }
    // Swap rows
    const tmp = prev
    prev = curr
    curr = tmp
  }

  return prev[n]
}
