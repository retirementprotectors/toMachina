'use client'

import { useState, type FormEvent } from 'react'

interface LifeQuoteFormProps {
  onSubmit: (params: Record<string, unknown>) => void
  loading?: boolean
}

const PRODUCT_TYPES = ['Term', 'UL', 'IUL', 'WL', 'Survivorship'] as const

const HEALTH_CLASSES = [
  'Super Preferred NS',
  'Preferred NS',
  'Standard Plus NS',
  'Standard NS',
  'Preferred Smoker',
  'Standard Smoker',
] as const

const TABLE_RATINGS = ['None', '125%', '150%', '175%', '200%+'] as const

export function LifeQuoteForm({ onSubmit, loading = false }: LifeQuoteFormProps) {
  const [faceAmount, setFaceAmount] = useState('')
  const [premiumBudget, setPremiumBudget] = useState('')
  const [productType, setProductType] = useState('')
  const [healthClass, setHealthClass] = useState('')
  const [tableRating, setTableRating] = useState('None')
  const [isSurvivorship, setIsSurvivorship] = useState(false)
  const [secondInsuredName, setSecondInsuredName] = useState('')
  const [secondInsuredAge, setSecondInsuredAge] = useState('')
  const [secondInsuredGender, setSecondInsuredGender] = useState('')
  const [secondInsuredClass, setSecondInsuredClass] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const params: Record<string, unknown> = {
      face_amount: Number(faceAmount),
      premium_budget: premiumBudget ? Number(premiumBudget) : undefined,
      product_type: productType,
      health_class: healthClass,
      table_rating: tableRating,
      is_survivorship: isSurvivorship,
    }
    if (isSurvivorship) {
      params.second_insured_name = secondInsuredName
      params.second_insured_age = secondInsuredAge ? Number(secondInsuredAge) : undefined
      params.second_insured_gender = secondInsuredGender
      params.second_insured_class = secondInsuredClass
    }
    onSubmit(params)
  }

  const isValid = faceAmount && productType && healthClass

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
          shield
        </span>
        Life Insurance Quote
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Face Amount */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Face Amount *</label>
          <input
            type="number"
            value={faceAmount}
            onChange={(e) => setFaceAmount(e.target.value)}
            placeholder="500000"
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>

        {/* Premium Budget */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Premium Budget</label>
          <input
            type="number"
            value={premiumBudget}
            onChange={(e) => setPremiumBudget(e.target.value)}
            placeholder="5000"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
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

        {/* Health Class */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Health Class *</label>
          <select
            value={healthClass}
            onChange={(e) => setHealthClass(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {HEALTH_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Table Rating */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Table Rating</label>
          <select
            value={tableRating}
            onChange={(e) => setTableRating(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            {TABLE_RATINGS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Survivorship */}
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={isSurvivorship}
              onChange={(e) => setIsSurvivorship(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--portal)]"
            />
            Survivorship Policy
          </label>
        </div>
      </div>

      {/* Second insured (shown if survivorship) */}
      {isSurvivorship && (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Second Insured
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Name</label>
              <input
                type="text"
                value={secondInsuredName}
                onChange={(e) => setSecondInsuredName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Age</label>
              <input
                type="number"
                value={secondInsuredAge}
                onChange={(e) => setSecondInsuredAge(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Gender</label>
              <select
                value={secondInsuredGender}
                onChange={(e) => setSecondInsuredGender(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              >
                <option value="">Select...</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Health Class</label>
              <select
                value={secondInsuredClass}
                onChange={(e) => setSecondInsuredClass(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              >
                <option value="">Select...</option>
                {HEALTH_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

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
