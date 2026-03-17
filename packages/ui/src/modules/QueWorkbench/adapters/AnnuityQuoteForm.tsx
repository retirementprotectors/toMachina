'use client'

import { useState, type FormEvent } from 'react'

interface AnnuityQuoteFormProps {
  onSubmit: (params: Record<string, unknown>) => void
  loading?: boolean
}

const TERMS = ['3', '5', '7', '10'] as const
const PRODUCT_TYPES = ['MYGA', 'FIA'] as const
const TAX_STATUSES = ['Qualified', 'Non-Qualified'] as const

export function AnnuityQuoteForm({ onSubmit, loading = false }: AnnuityQuoteFormProps) {
  const [depositAmount, setDepositAmount] = useState('')
  const [term, setTerm] = useState('')
  const [incomeStartAge, setIncomeStartAge] = useState('')
  const [productType, setProductType] = useState('')
  const [taxStatus, setTaxStatus] = useState('')
  const [indexPreference, setIndexPreference] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      deposit_amount: Number(depositAmount),
      term: Number(term),
      income_start_age: incomeStartAge ? Number(incomeStartAge) : undefined,
      product_type: productType,
      tax_status: taxStatus,
      index_preference: indexPreference || undefined,
    })
  }

  const isValid = depositAmount && term && productType && taxStatus

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
          savings
        </span>
        Annuity Quote
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Deposit Amount */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Deposit Amount *</label>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="100000"
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>

        {/* Term */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Term (Years) *</label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {TERMS.map((t) => (
              <option key={t} value={t}>{t} years</option>
            ))}
          </select>
        </div>

        {/* Product Type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Product Type *</label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Tax Status */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tax Status *</label>
          <select
            value={taxStatus}
            onChange={(e) => setTaxStatus(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {TAX_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Income Start Age */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Income Start Age</label>
          <input
            type="number"
            value={incomeStartAge}
            onChange={(e) => setIncomeStartAge(e.target.value)}
            placeholder="65"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>

        {/* Index Preference */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Index Preference</label>
          <input
            type="text"
            value={indexPreference}
            onChange={(e) => setIndexPreference(e.target.value)}
            placeholder="S&P 500, Fixed, etc."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!isValid || loading}
          className="flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          {loading ? (
            <>
              <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>sync</span>
              Running Quotes...
            </>
          ) : (
            <>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
              Run Quotes
            </>
          )}
        </button>
      </div>
    </form>
  )
}
