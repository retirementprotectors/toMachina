'use client'

import { useState, type FormEvent } from 'react'

interface InvestmentQuoteFormProps {
  onSubmit: (params: Record<string, unknown>) => void
  loading?: boolean
}

const TIME_HORIZONS = ['1-5', '5-10', '10-20', '20+'] as const
const REPORT_TYPES = ['Nitrogen', 'Signal', 'MoneyGuidePro'] as const

export function InvestmentQuoteForm({ onSubmit, loading = false }: InvestmentQuoteFormProps) {
  const [accountValue, setAccountValue] = useState('')
  const [riskTolerance, setRiskTolerance] = useState('50')
  const [incomeNeed, setIncomeNeed] = useState('')
  const [timeHorizon, setTimeHorizon] = useState('')
  const [reportType, setReportType] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      account_value: Number(accountValue),
      risk_tolerance: Number(riskTolerance),
      income_need: incomeNeed ? Number(incomeNeed) : undefined,
      time_horizon: timeHorizon,
      report_type: reportType,
    })
  }

  const isValid = accountValue && timeHorizon && reportType

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
          show_chart
        </span>
        Investment Analysis
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Account Value */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Value *</label>
          <input
            type="number"
            value={accountValue}
            onChange={(e) => setAccountValue(e.target.value)}
            placeholder="250000"
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>

        {/* Income Need */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Income Need (Annual)</label>
          <input
            type="number"
            value={incomeNeed}
            onChange={(e) => setIncomeNeed(e.target.value)}
            placeholder="36000"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>

        {/* Time Horizon */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Time Horizon *</label>
          <select
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {TIME_HORIZONS.map((h) => (
              <option key={h} value={h}>{h} years</option>
            ))}
          </select>
        </div>

        {/* Report Type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Report Type *</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">Select...</option>
            {REPORT_TYPES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Risk Tolerance Slider */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--text-muted)]">Risk Tolerance *</label>
          <span className="text-xs font-bold text-[var(--text-primary)]">{riskTolerance}/99</span>
        </div>
        <input
          type="range"
          min="1"
          max="99"
          value={riskTolerance}
          onChange={(e) => setRiskTolerance(e.target.value)}
          className="w-full accent-[var(--portal)]"
        />
        <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>Conservative</span>
          <span>Moderate</span>
          <span>Aggressive</span>
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
              Running Analysis...
            </>
          ) : (
            <>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
              Run Analysis
            </>
          )}
        </button>
      </div>
    </form>
  )
}
