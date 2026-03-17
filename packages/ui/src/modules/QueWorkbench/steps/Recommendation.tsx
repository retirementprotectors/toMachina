'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../../fetchWithAuth'
import { useToast } from '../../../components/Toast'

/* ─── Types ─── */

interface RecommendationProps {
  sessionId: string
  selectedQuoteIds: string[]
  onNext: () => void
  onBack: () => void
}

interface QuoteSummary {
  quote_id: string
  carrier: string
  product: string
  annual_premium: number
  monthly_premium: number
  score: number
}

type SolutionCategory =
  | 'income_now'
  | 'income_later'
  | 'estate_max'
  | 'growth_max'
  | 'ltc_max'
  | 'mge_detailed'
  | 'roth_conversion'
  | 'tax_harvesting'
  | 'medicare_supplement'
  | 'life_protection'

interface ProductRecommendation {
  quote_id: string
  carrier: string
  product: string
  rationale: string
}

const SOLUTION_CATEGORIES: Array<{ key: SolutionCategory; label: string; icon: string; description: string }> = [
  { key: 'income_now', label: 'Income Now', icon: 'payments', description: 'Immediate income from existing assets' },
  { key: 'income_later', label: 'Income Later', icon: 'schedule', description: 'Deferred income for future needs' },
  { key: 'estate_max', label: 'Estate Maximization', icon: 'account_balance', description: 'Legacy and estate planning' },
  { key: 'growth_max', label: 'Growth Maximization', icon: 'trending_up', description: 'Asset accumulation focus' },
  { key: 'ltc_max', label: 'LTC Protection', icon: 'health_and_safety', description: 'Long-term care coverage' },
  { key: 'mge_detailed', label: 'Multi-Goal Engine', icon: 'hub', description: 'Comprehensive financial analysis' },
  { key: 'roth_conversion', label: 'Roth Conversion', icon: 'swap_horiz', description: 'Tax-advantaged Roth strategy' },
  { key: 'tax_harvesting', label: 'Tax Harvesting', icon: 'agriculture', description: 'Tax loss harvesting strategy' },
  { key: 'medicare_supplement', label: 'Medicare Supplement', icon: 'medical_services', description: 'Medigap coverage selection' },
  { key: 'life_protection', label: 'Life Protection', icon: 'shield', description: 'Life insurance coverage' },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

function formatCurrency(val: number): string {
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/* ─── Component ─── */

export function Recommendation({ sessionId, selectedQuoteIds, onNext, onBack }: RecommendationProps) {
  const { showToast } = useToast()

  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [solutionCategory, setSolutionCategory] = useState<SolutionCategory | ''>('')
  const [productRationales, setProductRationales] = useState<Record<string, string>>({})
  const [advisorNotes, setAdvisorNotes] = useState('')

  // Fetch selected quote details
  useEffect(() => {
    let cancelled = false

    async function fetchSelectedQuotes() {
      setLoading(true)
      try {
        const res = await fetchWithAuth(`${API_BASE}/que/${sessionId}`)
        const data = await res.json() as { success: boolean; data?: { quotes: QuoteSummary[] }; error?: string }
        if (cancelled) return

        if (!data.success || !data.data) {
          showToast(data.error || 'Failed to load quotes', 'error')
          return
        }

        // Filter to selected quotes only
        const selected = data.data.quotes.filter(q => selectedQuoteIds.includes(q.quote_id))
        setQuotes(selected)

        // Initialize rationales
        const rationales: Record<string, string> = {}
        for (const q of selected) {
          rationales[q.quote_id] = ''
        }
        setProductRationales(rationales)
      } catch {
        if (!cancelled) {
          showToast('Failed to connect to QUE service', 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSelectedQuotes()
    return () => { cancelled = true }
  }, [sessionId, selectedQuoteIds, showToast])

  // Update rationale for a specific quote
  const updateRationale = useCallback((quoteId: string, value: string) => {
    setProductRationales(prev => ({ ...prev, [quoteId]: value }))
  }, [])

  // Submit recommendation
  const handleFinalize = useCallback(async () => {
    if (!solutionCategory) {
      showToast('Please select a solution category', 'warning')
      return
    }

    if (quotes.length === 0) {
      showToast('No products selected', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const selectedProducts: ProductRecommendation[] = quotes.map(q => ({
        quote_id: q.quote_id,
        carrier: q.carrier,
        product: q.product,
        rationale: productRationales[q.quote_id] || '',
      }))

      const res = await fetchWithAuth(`${API_BASE}/que/${sessionId}/recommend`, {
        method: 'POST',
        body: JSON.stringify({
          solution_category: solutionCategory,
          selected_products: selectedProducts,
          advisor_notes: advisorNotes,
        }),
      })

      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) {
        showToast(data.error || 'Failed to save recommendation', 'error')
        return
      }

      showToast('Recommendation finalized', 'success')
      onNext()
    } catch {
      showToast('Failed to save recommendation', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, solutionCategory, quotes, productRationales, advisorNotes, showToast, onNext])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Build Recommendation</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Select the solution category, add rationale per product, and finalize your recommendation.
        </p>
      </div>

      {/* Selected Quote Cards */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--text-muted)]">
          Selected Products ({quotes.length})
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quotes.map(q => (
            <div
              key={q.quote_id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{q.carrier}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{q.product}</p>
                </div>
                {q.score > 0 && (
                  <span className="rounded-full bg-[var(--portal)] px-2 py-0.5 text-xs font-bold text-white">
                    {q.score}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span>{formatCurrency(q.monthly_premium)}/mo</span>
                <span>{formatCurrency(q.annual_premium)}/yr</span>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                  Product Rationale
                </label>
                <textarea
                  value={productRationales[q.quote_id] || ''}
                  onChange={e => updateRationale(q.quote_id, e.target.value)}
                  placeholder="Why this product for this client..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Solution Category Picker */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--text-muted)]">
          Solution Category *
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SOLUTION_CATEGORIES.map(cat => {
            const isSelected = solutionCategory === cat.key
            return (
              <button
                key={cat.key}
                onClick={() => setSolutionCategory(cat.key)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
                    : 'border-[var(--border)] hover:border-[var(--portal)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span
                  className={`material-icons-outlined shrink-0 ${
                    isSelected ? 'text-[var(--portal)]' : 'text-[var(--text-muted)]'
                  }`}
                  style={{ fontSize: '20px' }}
                >
                  {cat.icon}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${
                    isSelected ? 'text-[var(--portal)]' : 'text-[var(--text-primary)]'
                  }`}>
                    {cat.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{cat.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Advisor Notes */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase text-[var(--text-muted)]">
          Advisor Notes
        </h3>
        <textarea
          value={advisorNotes}
          onChange={e => setAdvisorNotes(e.target.value)}
          placeholder="Additional context, client preferences, meeting notes, suitability considerations..."
          rows={5}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
        />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>

        <button
          onClick={handleFinalize}
          disabled={submitting || !solutionCategory}
          className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              Finalize Recommendation
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
