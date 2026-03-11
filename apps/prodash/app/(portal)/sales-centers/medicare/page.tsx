'use client'

import { useState, useMemo, useCallback } from 'react'
import { useToast } from '@tomachina/ui'

/* ─── Types ─── */
interface QuoteResult {
  company_id: number
  carrier: string
  am_best_rating: string | null
  naic_code: string | null
  plan_letter: string
  monthly_premium: number
  annual_premium: number
  rate_type: string
  effective_date: string
  eft_discount: boolean
}

interface QuoteInput {
  zip: string
  dob: string
  gender: 'M' | 'F' | ''
  tobacco: boolean
  plan_letter: string
  effective_date: string
}

interface PlanLetter {
  key: string
  label: string
  description: string
}

const PLAN_LETTERS: PlanLetter[] = [
  { key: 'A', label: 'Plan A', description: 'Basic benefits' },
  { key: 'B', label: 'Plan B', description: 'Basic + Part A deductible' },
  { key: 'C', label: 'Plan C', description: 'Full coverage (pre-2020 only)' },
  { key: 'D', label: 'Plan D', description: 'Basic + Part B excess' },
  { key: 'F', label: 'Plan F', description: 'Full coverage (pre-2020 only)' },
  { key: 'G', label: 'Plan G', description: 'Most popular' },
  { key: 'K', label: 'Plan K', description: '50% cost-sharing' },
  { key: 'L', label: 'Plan L', description: '75% cost-sharing' },
  { key: 'M', label: 'Plan M', description: '50% Part A deductible' },
  { key: 'N', label: 'Plan N', description: 'Cost-sharing with copays' },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function calculateAge(dob: string, refDate: string): number {
  const birth = new Date(dob)
  const ref = new Date(refDate)
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return age
}

/* ─── Sort ─── */
type SortKey = 'carrier' | 'monthly_premium' | 'annual_premium' | 'rate_type' | 'am_best_rating'

export default function MedicareSalesCenterPage() {
  const { showToast } = useToast()

  // Form state
  const [input, setInput] = useState<QuoteInput>({
    zip: '',
    dob: '',
    gender: '',
    tobacco: false,
    plan_letter: 'G',
    effective_date: '',
  })

  // Results state
  const [results, setResults] = useState<QuoteResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('monthly_premium')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Compare state
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set())
  const [showCompare, setShowCompare] = useState(false)

  // Input handlers
  const updateField = useCallback(<K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) => {
    setInput(prev => ({ ...prev, [key]: value }))
  }, [])

  // Sorted results
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [results, sortKey, sortDir])

  // Recommendation logic: best value = lowest premium among top-rated carriers
  const recommendedIds = useMemo(() => {
    if (results.length === 0) return new Set<number>()
    const withRating = results.filter(r => r.am_best_rating)
    const pool = withRating.length >= 3 ? withRating : results
    const sorted = [...pool].sort((a, b) => a.monthly_premium - b.monthly_premium)
    return new Set(sorted.slice(0, 3).map(r => r.company_id))
  }, [results])

  // Compare list
  const compareList = useMemo(
    () => results.filter(r => compareIds.has(r.company_id)),
    [results, compareIds]
  )

  const toggleCompare = useCallback((id: number) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 3) {
        next.add(id)
      } else {
        showToast('Maximum 3 plans for comparison', 'warning')
        return prev
      }
      return next
    })
  }, [showToast])

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  // Fetch quotes
  const handleSearch = useCallback(async () => {
    if (!input.zip || !input.dob || !input.gender || !input.plan_letter || !input.effective_date) {
      showToast('Please fill in all required fields', 'warning')
      return
    }

    const age = calculateAge(input.dob, input.effective_date)
    if (age < 64) {
      showToast('Client must be at least 64 years old for Medicare Supplement', 'warning')
      return
    }

    setLoading(true)
    setHasSearched(true)
    setCompareIds(new Set())
    setShowCompare(false)

    try {
      const res = await fetch(`${API_BASE}/medicare-quote/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip: input.zip,
          dob: input.dob,
          gender: input.gender,
          tobacco: input.tobacco,
          plan_letter: input.plan_letter,
          effective_date: input.effective_date,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        if (res.status === 503) {
          setApiConfigured(false)
        }
        showToast(data.error || 'Failed to fetch quotes', 'error')
        setResults([])
        return
      }

      setApiConfigured(true)
      setResults(data.data.quotes)
      if (data.data.quotes.length === 0) {
        showToast('No plans found for this criteria', 'warning')
      } else {
        showToast(`Found ${data.data.quotes.length} plans`, 'success')
      }
    } catch {
      showToast('Failed to connect to quoting service', 'error')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [input, showToast])

  // Sort header renderer
  const renderSortHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      onClick={() => handleSort(key)}
      className={`cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && (
          <span className="text-[var(--portal)]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </span>
    </th>
  )

  // API not configured state
  if (apiConfigured === false) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Medicare Quoting</h1>
        <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8">
          <div className="flex items-start gap-4">
            <span className="material-icons-outlined text-3xl text-[var(--portal)]">settings</span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">CSG API Configuration Required</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Medicare quoting requires a CSG Actuarial API key. To set up:
              </p>
              <ol className="mt-3 list-decimal pl-5 text-sm text-[var(--text-secondary)] space-y-1">
                <li>Contact Brien Welch at CSG Actuarial (bwelch@csgactuarial.com)</li>
                <li>Request API credentials for the Med Supp quoting portal</li>
                <li>Set the <code className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs">CSG_API_KEY</code> environment variable in the API service</li>
                <li>Restart the API service to pick up the new key</li>
              </ol>
              <button
                onClick={() => { setApiConfigured(null); setHasSearched(false) }}
                className="mt-4 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Medicare Quoting</h1>
        {compareIds.size > 0 && (
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>compare_arrows</span>
            Compare ({compareIds.size})
          </button>
        )}
      </div>

      {/* ─── Quote Input Form ─── */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {/* ZIP */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">ZIP Code *</label>
            <input
              type="text"
              maxLength={5}
              value={input.zip}
              onChange={e => updateField('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="50266"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>

          {/* DOB */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Date of Birth *</label>
            <input
              type="date"
              value={input.dob}
              onChange={e => updateField('dob', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Gender *</label>
            <select
              value={input.gender}
              onChange={e => updateField('gender', e.target.value as 'M' | 'F')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              <option value="">Select...</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          {/* Tobacco */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tobacco Use</label>
            <div className="flex h-[38px] items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="tobacco"
                  checked={!input.tobacco}
                  onChange={() => updateField('tobacco', false)}
                  className="accent-[var(--portal)]"
                />
                No
              </label>
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="tobacco"
                  checked={input.tobacco}
                  onChange={() => updateField('tobacco', true)}
                  className="accent-[var(--portal)]"
                />
                Yes
              </label>
            </div>
          </div>

          {/* Plan Letter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Plan Letter *</label>
            <select
              value={input.plan_letter}
              onChange={e => updateField('plan_letter', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              {PLAN_LETTERS.map(p => (
                <option key={p.key} value={p.key}>{p.label} — {p.description}</option>
              ))}
            </select>
          </div>

          {/* Effective Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Effective Date *</label>
            <input
              type="date"
              value={input.effective_date}
              onChange={e => updateField('effective_date', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
        </div>

        {/* Search Button */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Quoting...
              </>
            ) : (
              <>
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>search</span>
                Get Quotes
              </>
            )}
          </button>
          {input.dob && input.effective_date && (
            <span className="text-xs text-[var(--text-muted)]">
              Age at effective date: {calculateAge(input.dob, input.effective_date)}
            </span>
          )}
        </div>
      </div>

      {/* ─── Comparison Panel ─── */}
      {showCompare && compareList.length > 0 && (
        <div className="mt-6 rounded-xl border-2 border-[var(--portal)] bg-[var(--bg-card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Plan Comparison</h2>
            <button
              onClick={() => setShowCompare(false)}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Feature</th>
                  {compareList.map(plan => (
                    <th key={plan.company_id} className="px-4 py-3 text-center text-xs font-semibold text-[var(--portal)]">
                      {plan.carrier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2.5 font-medium">Monthly Premium</td>
                  {compareList.map(p => (
                    <td key={p.company_id} className="px-4 py-2.5 text-center font-semibold">
                      {formatCurrency(p.monthly_premium)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2.5 font-medium">Annual Premium</td>
                  {compareList.map(p => (
                    <td key={p.company_id} className="px-4 py-2.5 text-center">{formatCurrency(p.annual_premium)}</td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2.5 font-medium">Rate Type</td>
                  {compareList.map(p => (
                    <td key={p.company_id} className="px-4 py-2.5 text-center capitalize">{p.rate_type || '—'}</td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2.5 font-medium">AM Best Rating</td>
                  {compareList.map(p => (
                    <td key={p.company_id} className="px-4 py-2.5 text-center">{p.am_best_rating || '—'}</td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2.5 font-medium">EFT Discount</td>
                  {compareList.map(p => (
                    <td key={p.company_id} className="px-4 py-2.5 text-center">{p.eft_discount ? 'Yes' : 'No'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">Annual Savings vs Highest</td>
                  {(() => {
                    const maxAnnual = Math.max(...compareList.map(p => p.annual_premium))
                    return compareList.map(p => (
                      <td key={p.company_id} className="px-4 py-2.5 text-center font-medium" style={{
                        color: p.annual_premium === maxAnnual ? 'var(--text-muted)' : 'var(--portal)'
                      }}>
                        {p.annual_premium === maxAnnual ? '—' : formatCurrency(maxAnnual - p.annual_premium)}
                      </td>
                    ))
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Results Table ─── */}
      {hasSearched && !loading && (
        <div className="mt-6">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">search_off</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No plans found for this criteria.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Try adjusting your ZIP code, plan letter, or effective date.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">
                  {results.length} plan{results.length !== 1 ? 's' : ''} found
                  {input.plan_letter && ` for Plan ${input.plan_letter}`}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  <span className="material-icons-outlined mr-1 align-middle" style={{ fontSize: '14px' }}>star</span>
                  = Best Value Recommendation
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-secondary)]">
                    <tr>
                      <th className="w-10 px-3 py-3" />
                      {renderSortHeader('Carrier', 'carrier')}
                      {renderSortHeader('Rating', 'am_best_rating')}
                      {renderSortHeader('Monthly', 'monthly_premium', 'right')}
                      {renderSortHeader('Annual', 'annual_premium', 'right')}
                      {renderSortHeader('Rate Type', 'rate_type')}
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">EFT</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">Compare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((plan) => {
                      const isRecommended = recommendedIds.has(plan.company_id)
                      const isComparing = compareIds.has(plan.company_id)
                      return (
                        <tr
                          key={plan.company_id}
                          className={`border-t border-[var(--border)] transition-colors ${
                            isRecommended ? 'bg-[var(--portal-glow)]' : 'hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            {isRecommended && (
                              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }} title="Best Value">star</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                            {plan.carrier}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {plan.am_best_rating || '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                            {formatCurrency(plan.monthly_premium)}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                            {formatCurrency(plan.annual_premium)}
                          </td>
                          <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">
                            {plan.rate_type || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {plan.eft_discount ? (
                              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>check_circle</span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleCompare(plan.company_id)}
                              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                isComparing
                                  ? 'bg-[var(--portal)] text-white'
                                  : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
                              }`}
                            >
                              {isComparing ? 'Selected' : 'Add'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Initial State ─── */}
      {!hasSearched && !loading && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">health_and_safety</span>
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            Enter client details above to get Medicare Supplement quotes.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Powered by CSG Actuarial — rates include EFT discount when available.
          </p>
        </div>
      )}
    </div>
  )
}
