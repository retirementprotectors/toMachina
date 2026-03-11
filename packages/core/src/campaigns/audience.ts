// Audience Builder — filter clients for campaign targeting

import type { AudienceFilter, AudienceResult } from './types'

interface ClientRecord {
  client_id?: string
  _id?: string
  client_status?: string
  product_types?: string[]
  account_types?: string[]
  state?: string
  zip?: string
  dob?: string
  source?: string
  tags?: string | string[]
  book_of_business?: string
  dnd_all?: string | boolean
  dnd_email?: string | boolean
  dnd_sms?: string | boolean
  [key: string]: unknown
}

/**
 * Build a campaign audience from a list of clients and filters.
 * Pure function — works on any client array (Firestore results passed in).
 */
export function buildAudience(
  clients: ClientRecord[],
  filter: AudienceFilter,
  channel: 'email' | 'sms' | 'both' = 'email'
): AudienceResult {
  let dndFiltered = 0

  const eligible = clients.filter((client) => {
    // Status filter
    if (filter.client_status && filter.client_status.length > 0) {
      const status = (client.client_status || '').toLowerCase()
      if (!filter.client_status.some((s) => s.toLowerCase() === status)) return false
    }

    // Product type filter
    if (filter.product_types && filter.product_types.length > 0) {
      const clientProducts = getClientProducts(client)
      if (!filter.product_types.some((p) => clientProducts.includes(p.toLowerCase()))) return false
    }

    // State filter
    if (filter.states && filter.states.length > 0) {
      const state = (client.state || '').toUpperCase()
      if (!filter.states.some((s) => s.toUpperCase() === state)) return false
    }

    // ZIP range
    if (filter.zip_range) {
      const zip = client.zip || ''
      if (zip < filter.zip_range.min || zip > filter.zip_range.max) return false
    }

    // Age range
    if (filter.age_range) {
      const age = calculateAge(client.dob)
      if (age === null) return false
      if (filter.age_range.min && age < filter.age_range.min) return false
      if (filter.age_range.max && age > filter.age_range.max) return false
    }

    // Source filter
    if (filter.sources && filter.sources.length > 0) {
      const source = (client.source || '').toLowerCase()
      if (!filter.sources.some((s) => s.toLowerCase() === source)) return false
    }

    // Tags filter (include)
    if (filter.tags && filter.tags.length > 0) {
      const clientTags = getClientTags(client)
      if (!filter.tags.some((t) => clientTags.includes(t.toLowerCase()))) return false
    }

    // Tags filter (exclude)
    if (filter.exclude_tags && filter.exclude_tags.length > 0) {
      const clientTags = getClientTags(client)
      if (filter.exclude_tags.some((t) => clientTags.includes(t.toLowerCase()))) return false
    }

    // Book of business
    if (filter.book_of_business) {
      if ((client.book_of_business || '').toLowerCase() !== filter.book_of_business.toLowerCase()) return false
    }

    // DND filters — ALWAYS applied
    if (isTruthy(client.dnd_all)) {
      dndFiltered++
      return false
    }
    if ((channel === 'email' || channel === 'both') && isTruthy(client.dnd_email)) {
      dndFiltered++
      return false
    }
    if ((channel === 'sms' || channel === 'both') && isTruthy(client.dnd_sms)) {
      dndFiltered++
      return false
    }

    return true
  })

  return {
    total_eligible: eligible.length,
    filtered_by_dnd: dndFiltered,
    audience: eligible.map((c) => c.client_id || c._id || '').filter(Boolean),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTruthy(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  return String(val || '').toLowerCase() === 'true'
}

function calculateAge(dob?: string): number | null {
  if (!dob) return null
  try {
    const birth = new Date(dob)
    if (isNaN(birth.getTime())) return null
    const now = Date.now()
    return Math.floor((now - birth.getTime()) / (365.25 * 86400000))
  } catch {
    return null
  }
}

function getClientProducts(client: ClientRecord): string[] {
  const products: string[] = []
  if (Array.isArray(client.product_types)) {
    products.push(...client.product_types.map((p) => p.toLowerCase()))
  }
  if (Array.isArray(client.account_types)) {
    products.push(...client.account_types.map((p) => p.toLowerCase()))
  }
  return products
}

function getClientTags(client: ClientRecord): string[] {
  if (Array.isArray(client.tags)) return client.tags.map((t) => t.toLowerCase())
  if (typeof client.tags === 'string') {
    return client.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  }
  return []
}
