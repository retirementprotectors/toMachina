import { Router, type Request, type Response } from 'express'
import { successResponse, errorResponse } from '../lib/helpers.js'
import type { MedicareQuoteData, MedicareCompaniesData, MedicarePlanLettersData, MedicareQuoteStatusData } from '@tomachina/core'

export const medicareQuoteRoutes = Router()

const CSG_API_BASE = 'https://api.csgactuarial.com'
const TOKEN_TTL_MS = 7 * 60 * 60 * 1000 // 7 hours (safe margin under 8hr TTL)

// In-memory caches
let cachedToken: { value: string; expiresAt: number } | null = null
let cachedCompanies: { data: CsgCompany[]; fetchedAt: number } | null = null
const COMPANY_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CsgCompany {
  id: number
  name: string
  naic_code?: string
  am_best_rating?: string
}

interface CsgQuoteResult {
  company_id: number
  company_name: string
  plan_letter: string
  monthly_rate: number // in pennies
  annual_rate: number  // in pennies
  rate_type: string
  effective_date: string
  eft_discount_applied: boolean
}

interface QuoteInput {
  zip: string
  dob: string // YYYY-MM-DD
  gender: 'M' | 'F'
  tobacco: boolean
  plan_letter: string
  effective_date: string // YYYY-MM-DD
}

/**
 * Authenticate with CSG API and return a bearer token.
 * Caches token for 7 hours (API allows 8).
 */
async function getCsgToken(): Promise<string> {
  const apiKey = process.env.CSG_API_KEY
  if (!apiKey) throw new Error('CSG_API_KEY not configured')

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value
  }

  const res = await fetch(`${CSG_API_BASE}/v1/auth.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, portal_name: 'csg_individual' }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CSG auth failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { token: string }
  cachedToken = { value: data.token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return data.token
}

/**
 * Fetch Med Supp companies from CSG (no auth required, cached 24h).
 */
async function getCompanies(): Promise<CsgCompany[]> {
  if (cachedCompanies && Date.now() - cachedCompanies.fetchedAt < COMPANY_CACHE_TTL_MS) {
    return cachedCompanies.data
  }

  const res = await fetch(`${CSG_API_BASE}/v1/med_supp/companies.json`)
  if (!res.ok) {
    throw new Error(`CSG companies fetch failed (${res.status})`)
  }

  const data = await res.json() as { companies: CsgCompany[] }
  cachedCompanies = { data: data.companies, fetchedAt: Date.now() }
  return data.companies
}

/**
 * Calculate age from DOB to a reference date.
 */
function calculateAge(dob: string, referenceDate: string): number {
  const birth = new Date(dob)
  const ref = new Date(referenceDate)
  let age = ref.getFullYear() - birth.getFullYear()
  const monthDiff = ref.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// POST /api/medicare-quote/quotes — Get Med Supp quotes
medicareQuoteRoutes.post('/quotes', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.CSG_API_KEY
    if (!apiKey) {
      res.status(503).json(errorResponse('Medicare quoting requires CSG API configuration. Contact your administrator.'))
      return
    }

    const { zip, dob, gender, tobacco, plan_letter, effective_date } = req.body as QuoteInput

    if (!zip || !dob || !gender || !plan_letter || !effective_date) {
      res.status(400).json(errorResponse('Missing required fields: zip, dob, gender, plan_letter, effective_date'))
      return
    }

    const age = calculateAge(dob, effective_date)
    if (age < 64) {
      res.status(400).json(errorResponse('Client must be at least 64 years old for Medicare Supplement'))
      return
    }

    const token = await getCsgToken()

    const quoteRes = await fetch(`${CSG_API_BASE}/v1/med_supp/quotes.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': token,
      },
      body: JSON.stringify({
        zip_code: zip,
        date_of_birth: dob,
        gender: gender,
        tobacco_user: tobacco,
        plan_letter: plan_letter.toUpperCase(),
        effective_date: effective_date,
      }),
    })

    if (!quoteRes.ok) {
      const text = await quoteRes.text()
      console.error('CSG quote request failed:', quoteRes.status, text)
      res.status(502).json(errorResponse(`Quote service returned ${quoteRes.status}`))
      return
    }

    const quoteData = await quoteRes.json() as { quotes: CsgQuoteResult[] }
    const companies = await getCompanies()
    const companyMap = new Map(companies.map(c => [c.id, c]))

    // Normalize: convert pennies to dollars, enrich with company data
    const normalized = (quoteData.quotes || []).map(q => {
      const company = companyMap.get(q.company_id)
      return {
        company_id: q.company_id,
        carrier: q.company_name || company?.name || 'Unknown',
        am_best_rating: company?.am_best_rating || null,
        naic_code: company?.naic_code || null,
        plan_letter: q.plan_letter,
        monthly_premium: q.monthly_rate / 100,
        annual_premium: q.annual_rate / 100,
        rate_type: q.rate_type,
        effective_date: q.effective_date,
        eft_discount: q.eft_discount_applied,
      }
    }).sort((a, b) => a.monthly_premium - b.monthly_premium)

    res.json(successResponse<MedicareQuoteData>({
      quotes: normalized,
      count: normalized.length,
      input: { zip, age, gender, tobacco, plan_letter, effective_date },
    } as unknown as MedicareQuoteData))
  } catch (err) {
    console.error('POST /api/medicare-quote/quotes error:', err)
    res.status(500).json(errorResponse(String(err instanceof Error ? err.message : err)))
  }
})

// GET /api/medicare-quote/companies — Get carrier list (cached)
medicareQuoteRoutes.get('/companies', async (_req: Request, res: Response) => {
  try {
    const companies = await getCompanies()
    res.json(successResponse<MedicareCompaniesData>({ companies, count: companies.length } as unknown as MedicareCompaniesData))
  } catch (err) {
    console.error('GET /api/medicare-quote/companies error:', err)
    res.status(500).json(errorResponse(String(err instanceof Error ? err.message : err)))
  }
})

// GET /api/medicare-quote/plan-letters — Available plan letters
medicareQuoteRoutes.get('/plan-letters', (_req: Request, res: Response) => {
  res.json(successResponse<MedicarePlanLettersData>({
    plan_letters: [
      { key: 'A', label: 'Plan A', description: 'Basic benefits' },
      { key: 'B', label: 'Plan B', description: 'Basic + Part A deductible' },
      { key: 'C', label: 'Plan C', description: 'Full coverage (pre-2020 only)' },
      { key: 'D', label: 'Plan D', description: 'Basic + Part B excess' },
      { key: 'F', label: 'Plan F', description: 'Full coverage (pre-2020 only)' },
      { key: 'G', label: 'Plan G', description: 'Most popular - all except Part B deductible' },
      { key: 'K', label: 'Plan K', description: '50% cost-sharing' },
      { key: 'L', label: 'Plan L', description: '75% cost-sharing' },
      { key: 'M', label: 'Plan M', description: '50% Part A deductible' },
      { key: 'N', label: 'Plan N', description: 'Cost-sharing with copays' },
    ],
  } as unknown as MedicarePlanLettersData))
})

// GET /api/medicare-quote/status — Check if CSG API is configured
medicareQuoteRoutes.get('/status', (_req: Request, res: Response) => {
  const configured = !!process.env.CSG_API_KEY
  res.json(successResponse<MedicareQuoteStatusData>({ configured, provider: 'CSG Actuarial' } as unknown as MedicareQuoteStatusData))
})
