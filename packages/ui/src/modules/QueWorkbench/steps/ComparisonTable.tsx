'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchWithAuth } from '../../fetchWithAuth'
import { useToast } from '../../../components/Toast'

/* ─── Types ─── */

interface ComparisonTableProps {
  sessionId: string
  onNext: (selectedQuoteIds: string[]) => void
  onBack: () => void
}

interface QuoteRow {
  quote_id: string
  carrier: string
  product: string
  annual_premium: number
  monthly_premium: number
  death_benefit: number
  accumulation_value: number
  fees: number
  rating: string
  score: number
  rank: number
}

interface ComparisonData {
  quotes: QuoteRow[]
  best_value_id: string | null
  lowest_premium_id: string | null
  highest_benefit_id: string | null
}

type SortKey = 'carrier' | 'product' | 'annual_premium' | 'monthly_premium' | 'death_benefit' | 'fees' | 'rating' | 'score' | 'rank'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

function formatCurrency(val: number): string {
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/* ─── Component ─── */

export function ComparisonTable({ sessionId, onNext, onBack }: ComparisonTableProps) {
  const { showToast } = useToast()

  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Flags
  const [bestValueId, setBestValueId] = useState<string | null>(null)
  const [lowestPremiumId, setLowestPremiumId] = useState<string | null>(null)
  const [highestBenefitId, setHighestBenefitId] = useState<string | null>(null)

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Fetch session quotes
  useEffect(() => {
    let cancelled = false

    async function fetchQuotes() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchWithAuth(`${API_BASE}/que/${sessionId}`)
        const data = await res.json() as { success: boolean; data?: { quotes: QuoteRow[] }; error?: string }
        if (cancelled) return

        if (!data.success || !data.data) {
          setError(data.error || 'Failed to load session quotes')
          return
        }

        setQuotes(data.data.quotes)
      } catch {
        if (!cancelled) {
          setError('Failed to connect to QUE service')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchQuotes()
    return () => { cancelled = true }
  }, [sessionId])

  // Run comparison
  const handleCompare = useCallback(async () => {
    setComparing(true)
    try {
      const res = await fetchWithAuth(`${API_BASE}/que/${sessionId}/compare`, {
        method: 'POST',
      })
      const data = await res.json() as { success: boolean; data?: ComparisonData; error?: string }
      if (!data.success || !data.data) {
        showToast(data.error || 'Comparison failed', 'error')
        return
      }

      setQuotes(data.data.quotes)
      setBestValueId(data.data.best_value_id)
      setLowestPremiumId(data.data.lowest_premium_id)
      setHighestBenefitId(data.data.highest_benefit_id)
      showToast('Comparison complete', 'success')
    } catch {
      showToast('Failed to run comparison', 'error')
    } finally {
      setComparing(false)
    }
  }, [sessionId, showToast])

  // Sort logic
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [quotes, sortKey, sortDir])

  // Selection
  const toggleSelection = useCallback((quoteId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(quoteId)) {
        next.delete(quoteId)
      } else {
        next.add(quoteId)
      }
      return next
    })
  }, [])

  // Pill badge helper
  const getPills = useCallback((quoteId: string): Array<{ label: string; className: string }> => {
    const pills: Array<{ label: string; className: string }> = []
    if (quoteId === bestValueId) {
      pills.push({ label: 'Best Value', className: 'bg-[var(--status-success)] text-white' })
    }
    if (quoteId === lowestPremiumId) {
      pills.push({ label: 'Lowest Premium', className: 'bg-[var(--portal)] text-white' })
    }
    if (quoteId === highestBenefitId) {
      pills.push({ label: 'Highest Benefit', className: 'bg-[var(--status-warning)] text-white' })
    }
    return pills
  }, [bestValueId, lowestPremiumId, highestBenefitId])

  // Sort header renderer
  const renderSortHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      key={key}
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--status-error)]">error_outline</span>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{error}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">search_off</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">No quotes found for this session.</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Go back and run quotes first.</p>
        <div className="mt-4">
          <button
            onClick={onBack}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Back to Quotes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Quote Comparison</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''} — select products for recommendation
          </p>
        </div>
        <button
          onClick={handleCompare}
          disabled={comparing}
          className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {comparing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Scoring...
            </>
          ) : (
            <>
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>analytics</span>
              Run Comparison
            </>
          )}
        </button>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              <th className="w-10 px-3 py-3">
                <span className="sr-only">Select</span>
              </th>
              {renderSortHeader('Carrier', 'carrier')}
              {renderSortHeader('Product', 'product')}
              {renderSortHeader('Annual', 'annual_premium', 'right')}
              {renderSortHeader('Monthly', 'monthly_premium', 'right')}
              {renderSortHeader('Death Benefit / AV', 'death_benefit', 'right')}
              {renderSortHeader('Fees', 'fees', 'right')}
              {renderSortHeader('Rating', 'rating')}
              {renderSortHeader('Score', 'score', 'right')}
              {renderSortHeader('Rank', 'rank', 'right')}
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[var(--text-muted)]">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sortedQuotes.map((q) => {
              const isSelected = selectedIds.has(q.quote_id)
              const pills = getPills(q.quote_id)
              return (
                <tr
                  key={q.quote_id}
                  className={`border-t border-[var(--border)] transition-colors ${
                    isSelected ? 'bg-[var(--portal-glow)]' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(q.quote_id)}
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--portal)]"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{q.carrier}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{q.product}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                    {formatCurrency(q.annual_premium)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {formatCurrency(q.monthly_premium)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {q.death_benefit > 0 ? formatCurrency(q.death_benefit) : q.accumulation_value > 0 ? formatCurrency(q.accumulation_value) : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {q.fees > 0 ? formatCurrency(q.fees) : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{q.rating || '\u2014'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                    {q.score > 0 ? q.score : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {q.rank > 0 ? `#${q.rank}` : '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {pills.map((pill) => (
                        <span
                          key={pill.label}
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.className}`}
                        >
                          {pill.label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Bar */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>

        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <span className="text-sm text-[var(--text-muted)]">
              {selectedIds.size} selected
            </span>
          )}
          <button
            onClick={() => onNext(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Proceed to Recommendation
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}
