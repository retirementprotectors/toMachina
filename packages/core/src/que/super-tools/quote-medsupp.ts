/**
 * QUOTE_MEDSUPP — Super Tool (TRK-EPIC-07)
 *
 * Normalizes raw CSG MedSupp quote results into a ranked, casework-ready list.
 * PURE: no HTTP, no Firestore, no async. Wire layer fetches via
 * POST /api/medicare-quote/quotes; this super tool processes the raw response.
 *
 * Input contract matches CSG `/v1/med_supp/quotes.json` response shape
 * (top-level array of quote objects with `company_base`, `rate`, etc.).
 */

export interface QuoteMedsuppInput {
  zip: string
  age: number
  gender: 'M' | 'F'
  tobacco: boolean
  planLetter: string
  effectiveDate: string
}

export interface RawCsgQuote {
  company_base?: {
    naic?: string
    name?: string
    name_full?: string
    ambest_rating?: string
  }
  plan: string
  rate: { month: number; annual: number; quarter?: number; semi_annual?: number }
  rate_type: string
  effective_date: string
  discounts?: Array<{ name?: string; type?: string; value?: number }>
}

export interface NormalizedQuote {
  carrier: string
  naic: string | null
  amBestRating: string | null
  planLetter: string
  monthlyPremium: number
  annualPremium: number
  rateType: string
  effectiveDate: string
  hasEftDiscount: boolean
}

export interface QuoteMedsuppResult {
  success: boolean
  input: QuoteMedsuppInput
  quoteCount: number
  quotes: NormalizedQuote[]
  cheapest?: NormalizedQuote
  error?: string
}

const VALID_PLANS = new Set(['A', 'B', 'C', 'D', 'F', 'G', 'K', 'L', 'M', 'N'])

export function quoteMedsupp(
  input: QuoteMedsuppInput,
  rawQuotes: RawCsgQuote[],
): QuoteMedsuppResult {
  if (input.age < 64) {
    return {
      success: false,
      input,
      quoteCount: 0,
      quotes: [],
      error: 'Client must be at least 64 years old for Medicare Supplement quoting.',
    }
  }

  const planLetterUpper = (input.planLetter || '').toUpperCase()
  if (!VALID_PLANS.has(planLetterUpper)) {
    return {
      success: false,
      input,
      quoteCount: 0,
      quotes: [],
      error: `Invalid plan letter: ${input.planLetter}. Must be one of A, B, C, D, F, G, K, L, M, N.`,
    }
  }

  const normalized: NormalizedQuote[] = (rawQuotes || []).map((q) => {
    const cb = q.company_base ?? {}
    const ambest = cb.ambest_rating && cb.ambest_rating !== 'n/a' ? cb.ambest_rating : null
    const hasEft = (q.discounts ?? []).some(
      (d) => typeof d.name === 'string' && d.name.toLowerCase().includes('eft'),
    )
    const effDate =
      typeof q.effective_date === 'string' ? q.effective_date.slice(0, 10) : q.effective_date

    return {
      carrier: cb.name_full || cb.name || 'Unknown',
      naic: cb.naic ?? null,
      amBestRating: ambest,
      planLetter: q.plan,
      monthlyPremium: q.rate.month / 100,
      annualPremium: q.rate.annual / 100,
      rateType: q.rate_type,
      effectiveDate: effDate,
      hasEftDiscount: hasEft,
    }
  })

  normalized.sort((a, b) => a.monthlyPremium - b.monthlyPremium)

  return {
    success: true,
    input,
    quoteCount: normalized.length,
    quotes: normalized,
    cheapest: normalized[0],
  }
}
