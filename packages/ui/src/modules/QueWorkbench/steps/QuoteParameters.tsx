'use client'

import { useState } from 'react'
import { fetchWithAuth } from '../../fetchWithAuth'
import type { QueProductLine } from '../types'
import { MedicareQuoteForm } from '../adapters/MedicareQuoteForm'
import { LifeQuoteForm } from '../adapters/LifeQuoteForm'
import { AnnuityQuoteForm } from '../adapters/AnnuityQuoteForm'
import { InvestmentQuoteForm } from '../adapters/InvestmentQuoteForm'

interface QuoteParametersProps {
  sessionId: string
  productLine: QueProductLine
  onNext: () => void
  onBack: () => void
}

export function QuoteParameters({ sessionId, productLine, onNext, onBack }: QuoteParametersProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (params: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/que/${sessionId}/quote`, {
        method: 'POST',
        body: JSON.stringify({ parameters: params, product_line: productLine }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to submit parameters' }))
        setError((body as { error?: string }).error ?? 'Failed to submit parameters')
        return
      }
      const body = await res.json() as { success: boolean; error?: string }
      if (body.success) {
        onNext()
      } else {
        setError(body.error ?? 'Unexpected error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const renderForm = () => {
    switch (productLine) {
      case 'MEDICARE':
        return <MedicareQuoteForm onSubmit={(p) => void handleSubmit(p)} loading={loading} />
      case 'LIFE':
        return <LifeQuoteForm onSubmit={(p) => void handleSubmit(p)} loading={loading} />
      case 'ANNUITY':
        return <AnnuityQuoteForm onSubmit={(p) => void handleSubmit(p)} loading={loading} />
      case 'INVESTMENT':
        return <InvestmentQuoteForm onSubmit={(p) => void handleSubmit(p)} loading={loading} />
      default:
        return <p className="text-sm text-[var(--text-muted)]">Unsupported product line</p>
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Quote Parameters</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Configure the {productLine.toLowerCase()} quoting parameters
        </p>
      </div>

      {/* Adapter form */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        {renderForm()}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
      </div>
    </div>
  )
}
