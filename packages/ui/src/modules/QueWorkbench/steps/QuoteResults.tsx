'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../../fetchWithAuth'
import { QuoteCard } from '../shared/QuoteCard'
import type { QueProductLine } from '../types'

interface QuoteResultsProps {
  sessionId: string
  productLine: QueProductLine
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

const MANUAL_FIELDS: Record<QueProductLine, { key: string; label: string; type: string }[]> = {
  MEDICARE: [
    { key: 'plan_letter', label: 'Plan Letter', type: 'text' },
    { key: 'deductible', label: 'Deductible', type: 'number' },
    { key: 'copay_specialist', label: 'Specialist Copay', type: 'number' },
  ],
  LIFE: [
    { key: 'face_amount', label: 'Face Amount', type: 'number' },
    { key: 'cash_value', label: 'Cash Value', type: 'number' },
    { key: 'product_type', label: 'Product Type', type: 'text' },
  ],
  ANNUITY: [
    { key: 'guaranteed_rate', label: 'Guaranteed Rate (%)', type: 'number' },
    { key: 'surrender_period', label: 'Surrender Period (yr)', type: 'number' },
    { key: 'income_rider', label: 'Income Rider', type: 'text' },
  ],
  INVESTMENT: [
    { key: 'expense_ratio', label: 'Expense Ratio (%)', type: 'number' },
    { key: 'management_fee', label: 'Management Fee (%)', type: 'number' },
    { key: 'fund_family', label: 'Fund Family', type: 'text' },
  ],
}

export function QuoteResults({ sessionId, productLine, onNext, onBack }: QuoteResultsProps) {
  const [quotes, setQuotes] = useState<QuoteData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingQuote, setAddingQuote] = useState(false)

  /* ── Manual entry form state ── */
  const [manualCarrier, setManualCarrier] = useState('')
  const [manualProduct, setManualProduct] = useState('')
  const [manualPremiumAnnual, setManualPremiumAnnual] = useState('')
  const [manualPremiumMonthly, setManualPremiumMonthly] = useState('')
  const [manualDetails, setManualDetails] = useState<Record<string, string>>({})

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
      const body = await res.json() as { success: boolean; data?: { quotes: QuoteData[] }; error?: string }
      if (body.success && body.data) {
        setQuotes(body.data.quotes ?? [])
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

  const handleAddManualQuote = async () => {
    if (!manualCarrier.trim() || !manualProduct.trim()) return

    setAddingQuote(true)
    setError(null)
    try {
      const details: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(manualDetails)) {
        if (v.trim()) details[k] = v
      }

      const res = await fetchWithAuth(`/api/que/${sessionId}/quote`, {
        method: 'POST',
        body: JSON.stringify({
          source_id: 'manual',
          carrier_name: manualCarrier.trim(),
          product_name: manualProduct.trim(),
          premium_annual: manualPremiumAnnual ? Number(manualPremiumAnnual) : undefined,
          premium_monthly: manualPremiumMonthly ? Number(manualPremiumMonthly) : undefined,
          details,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to add quote' }))
        setError((body as { error?: string }).error ?? 'Failed to add quote')
        return
      }

      // Reset form and reload
      setManualCarrier('')
      setManualProduct('')
      setManualPremiumAnnual('')
      setManualPremiumMonthly('')
      setManualDetails({})
      setShowAddForm(false)
      await loadQuotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setAddingQuote(false)
    }
  }

  const extraFields = MANUAL_FIELDS[productLine] ?? []

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Quote Results</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''} retrieved
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
          Add Quote
        </button>
      </div>

      {/* Manual entry form */}
      {showAddForm && (
        <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Manual Quote Entry</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Carrier Name *</label>
              <input
                type="text"
                value={manualCarrier}
                onChange={(e) => setManualCarrier(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Product Name *</label>
              <input
                type="text"
                value={manualProduct}
                onChange={(e) => setManualProduct(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Premium (Annual)</label>
              <input
                type="number"
                value={manualPremiumAnnual}
                onChange={(e) => setManualPremiumAnnual(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Premium (Monthly)</label>
              <input
                type="number"
                value={manualPremiumMonthly}
                onChange={(e) => setManualPremiumMonthly(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              />
            </div>
            {extraFields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{field.label}</label>
                <input
                  type={field.type}
                  value={manualDetails[field.key] ?? ''}
                  onChange={(e) => setManualDetails((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleAddManualQuote()}
              disabled={addingQuote || !manualCarrier.trim() || !manualProduct.trim()}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
              style={{ background: 'var(--portal)' }}
            >
              {addingQuote ? (
                <>
                  <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>sync</span>
                  Adding...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span>
                  Save Quote
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Quote grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <span className="material-icons-outlined animate-spin text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
            sync
          </span>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Loading quotes...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">format_quote</span>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No quotes yet</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Add quotes manually or they will be auto-populated after quoting</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
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
          onClick={onNext}
          disabled={quotes.length === 0}
          className="flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          Compare Quotes
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
