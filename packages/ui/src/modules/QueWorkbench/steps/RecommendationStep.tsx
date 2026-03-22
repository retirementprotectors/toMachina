'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../../fetchValidated'
import { SolutionCategoryPicker } from '../shared/SolutionCategoryPicker'
import type { QueProductLine } from '../types'

interface RecommendationStepProps {
  sessionId: string
  productLine: QueProductLine
  onNext: () => void
  onBack: () => void
}

interface SelectedProduct {
  quote_id: string
  carrier_name: string
  product_name: string
  rationale: string
}

export function RecommendationStep({ sessionId, productLine, onNext, onBack }: RecommendationStepProps) {
  const [solutionCategory, setSolutionCategory] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [advisorNotes, setAdvisorNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadExistingRecommendation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchValidated<{
        recommendation?: {
          solution_category?: string
          selected_products?: SelectedProduct[]
          advisor_notes?: string
        }
        selected_quote_ids?: string[]
        quotes?: { quote_id: string; carrier_name: string; product_name: string }[]
      }>(`/api/que/${sessionId}`)
      if (!result.success) {
        setLoading(false)
        return
      }
      if (result.data) {
        const rec = result.data.recommendation
        if (rec) {
          setSolutionCategory(rec.solution_category ?? null)
          setSelectedProducts(rec.selected_products ?? [])
          setAdvisorNotes(rec.advisor_notes ?? '')
        } else if (result.data.selected_quote_ids && result.data.quotes) {
          // Pre-populate from selected quotes
          const quotes = result.data.quotes
          const products: SelectedProduct[] = result.data.selected_quote_ids
            .map((qid) => {
              const q = quotes.find((x) => x.quote_id === qid)
              return q
                ? { quote_id: q.quote_id, carrier_name: q.carrier_name, product_name: q.product_name, rationale: '' }
                : null
            })
            .filter((p): p is SelectedProduct => p !== null)
          setSelectedProducts(products)
        }
      }
    } catch {
      // Non-fatal — just start fresh
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadExistingRecommendation()
  }, [loadExistingRecommendation])

  const updateRationale = (quoteId: string, rationale: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) => (p.quote_id === quoteId ? { ...p, rationale } : p)),
    )
  }

  const handleSave = async () => {
    if (!solutionCategory || selectedProducts.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const result = await fetchValidated(`/api/que/${sessionId}/recommendation`, {
        method: 'POST',
        body: JSON.stringify({
          solution_category: solutionCategory,
          selected_products: selectedProducts,
          advisor_notes: advisorNotes,
          product_line: productLine,
        }),
      })
      if (!result.success) {
        setError(result.error ?? 'Failed to save recommendation')
        return
      }
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="material-icons-outlined animate-spin text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
          sync
        </span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">Loading recommendation...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Build Recommendation</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Categorize the solution and add rationale for each selected product
        </p>
      </div>

      {/* Solution Category Picker */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Solution Category</h3>
        <SolutionCategoryPicker selected={solutionCategory} onSelect={setSolutionCategory} />
      </div>

      {/* Selected Products */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          Selected Products ({selectedProducts.length})
        </h3>
        {selectedProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No products selected. Go back to the Compare step.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedProducts.map((product) => (
              <div
                key={product.quote_id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="material-icons-outlined"
                    style={{ fontSize: '20px', color: 'var(--portal)' }}
                  >
                    verified
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{product.carrier_name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{product.product_name}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                    Rationale (why this product?)
                  </label>
                  <textarea
                    value={product.rationale}
                    onChange={(e) => updateRationale(product.quote_id, e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
                    placeholder="Explain why this product is recommended for the client..."
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advisor Notes */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Advisor Notes</h3>
        <textarea
          value={advisorNotes}
          onChange={(e) => setAdvisorNotes(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          placeholder="Additional notes, observations, or next steps for this recommendation..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
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
          onClick={() => void handleSave()}
          disabled={!solutionCategory || selectedProducts.length === 0 || saving}
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
              Generate Output
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
