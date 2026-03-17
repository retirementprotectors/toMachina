'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../../fetchWithAuth'
import { QuoteCard } from '../shared/QuoteCard'

interface ComparisonStepProps {
  sessionId: string
  onNext: () => void
  onBack: () => void
}

interface QuoteData {
  quote_id: string
  carrier_name: string
  product_name: string
  premium_annual?: number
  premium_monthly?: number
  details: Record<string, unknown>
  source_name: string
  automation_level: 'full' | 'semi' | 'manual'
  score?: number
  rank?: number
  flags: string[]
}

type SortField = 'rank' | 'premium_annual' | 'premium_monthly' | 'score' | 'carrier_name'

export function ComparisonStep({ sessionId, onNext, onBack }: ComparisonStepProps) {
  const [quotes, setQuotes] = useState<QuoteData[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>('rank')

  const loadQuotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/que/${sessionId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to load quotes' }))
        setError((body as { error?: string }).error ?? 'Failed to load quotes')
        return
      }
      const body = await res.json() as {
        success: boolean
        data?: { quotes: QuoteData[]; selected_quote_ids?: string[] }
        error?: string
      }
      if (body.success && body.data) {
        setQuotes(body.data.quotes ?? [])
        if (body.data.selected_quote_ids?.length) {
          setSelectedIds(new Set(body.data.selected_quote_ids))
        }
      } else {
        setError(body.error ?? 'Unexpected response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadQuotes()
  }, [loadQuotes])

  const toggleSelect = (quoteId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(quoteId)) {
        next.delete(quoteId)
      } else {
        next.add(quoteId)
      }
      return next
    })
  }

  const handleSaveAndContinue = async () => {
    if (selectedIds.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/que/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ selected_quote_ids: Array.from(selectedIds) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to save selection' }))
        setError((body as { error?: string }).error ?? 'Failed to save selection')
        return
      }
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const sortedQuotes = [...quotes].sort((a, b) => {
    switch (sortBy) {
      case 'rank':
        return (a.rank ?? 999) - (b.rank ?? 999)
      case 'premium_annual':
        return (a.premium_annual ?? Infinity) - (b.premium_annual ?? Infinity)
      case 'premium_monthly':
        return (a.premium_monthly ?? Infinity) - (b.premium_monthly ?? Infinity)
      case 'score':
        return (b.score ?? 0) - (a.score ?? 0)
      case 'carrier_name':
        return a.carrier_name.localeCompare(b.carrier_name)
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="material-icons-outlined animate-spin text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
          sync
        </span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">Loading comparison...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Compare Quotes</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Select the best quotes for your recommendation ({selectedIds.size} selected)
          </p>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--text-muted)]">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="rank">Rank</option>
            <option value="premium_annual">Premium (Annual)</option>
            <option value="premium_monthly">Premium (Monthly)</option>
            <option value="score">Score</option>
            <option value="carrier_name">Carrier Name</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Quote grid */}
      {sortedQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">compare</span>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No quotes to compare</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Go back and add quotes first</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedQuotes.map((q) => (
            <QuoteCard
              key={q.quote_id}
              carrierName={q.carrier_name}
              productName={q.product_name}
              premiumAnnual={q.premium_annual}
              premiumMonthly={q.premium_monthly}
              details={q.details}
              sourceName={q.source_name}
              automationLevel={q.automation_level}
              score={q.score}
              rank={q.rank}
              flags={q.flags}
              selected={selectedIds.has(q.quote_id)}
              onSelect={() => toggleSelect(q.quote_id)}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back
        </button>
        <button
          type="button"
          onClick={() => void handleSaveAndContinue()}
          disabled={selectedIds.size === 0 || saving}
          className="flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          {saving ? (
            <>
              <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>sync</span>
              Saving...
            </>
          ) : (
            <>
              Build Recommendation
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
