'use client'

import { useState, type FormEvent } from 'react'

interface MedicareQuoteFormProps {
  onSubmit: (params: Record<string, unknown>) => void
  loading?: boolean
}

const PLAN_LETTERS = ['A', 'B', 'C', 'D', 'F', 'G', 'K', 'L', 'M', 'N'] as const

export function MedicareQuoteForm({ onSubmit, loading = false }: MedicareQuoteFormProps) {
  const [zip, setZip] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [tobacco, setTobacco] = useState(false)
  const [planLetter, setPlanLetter] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      zip,
      dob,
      gender,
      tobacco,
      plan_letter: planLetter,
      effective_date: effectiveDate,
    })
  }

  const isValid = zip.trim() && dob && gender && planLetter && effectiveDate

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
          health_and_safety
        </span>
        Medicare Supplement Quote
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* ZIP */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">ZIP Code *</label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            maxLength={5}
            placeholder="50265"
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>

        {/* DOB */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Date of Birth *</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Gender *</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>

        {/* Plan Letter */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Plan Letter *</label>
          <select
            value={planLetter}
            onChange={(e) => setPlanLetter(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {PLAN_LETTERS.map((letter) => (
              <option key={letter} value={letter}>Plan {letter}</option>
            ))}
          </select>
        </div>

        {/* Effective Date */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Effective Date *</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          />
        </div>

        {/* Tobacco */}
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={tobacco}
              onChange={(e) => setTobacco(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--portal)]"
            />
            Tobacco User
          </label>
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
