'use client'

/**
 * RSPClientProfile — TRK-RSP-006
 * Interactive client profile form with have/need analysis.
 * Ai3 fields: personal info, financial snapshot, goals.
 */

import { useState } from 'react'

interface ClientProfileData {
  first_name: string
  last_name: string
  dob: string
  spouse_name?: string
  spouse_dob?: string
  dependents: number
  annual_income?: number
  retirement_date?: string
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  goals: string[]
}

interface RSPClientProfileProps {
  clientId: string
  initialData?: Partial<ClientProfileData>
  onSave?: (data: ClientProfileData) => void
}

const DEFAULT_GOALS = [
  'Retirement Income',
  'Legacy Planning',
  'Tax Optimization',
  'Medicare Coverage',
  'Long-Term Care',
  'Wealth Transfer',
]

export function RSPClientProfile({ clientId, initialData, onSave }: RSPClientProfileProps) {
  const [data, setData] = useState<Partial<ClientProfileData>>(initialData || {})
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set(initialData?.goals || []))

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev => {
      const next = new Set(prev)
      if (next.has(goal)) next.delete(goal)
      else next.add(goal)
      return next
    })
  }

  const handleSave = () => {
    if (onSave) {
      onSave({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        dob: data.dob || '',
        spouse_name: data.spouse_name,
        spouse_dob: data.spouse_dob,
        dependents: data.dependents || 0,
        annual_income: data.annual_income,
        retirement_date: data.retirement_date,
        risk_tolerance: data.risk_tolerance || 'moderate',
        goals: [...selectedGoals],
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Client Profile</h3>
        <span className="text-xs text-[var(--text-muted)] font-mono">{clientId}</span>
      </div>

      {/* Personal Info */}
      <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)] space-y-3">
        <h4 className="text-sm font-semibold text-[var(--portal)]">Personal Information</h4>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="First Name"
            value={data.first_name || ''}
            onChange={e => setData(d => ({ ...d, first_name: e.target.value }))}
            className="px-3 py-2 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-sm"
          />
          <input
            placeholder="Last Name"
            value={data.last_name || ''}
            onChange={e => setData(d => ({ ...d, last_name: e.target.value }))}
            className="px-3 py-2 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-sm"
          />
          <input
            type="date"
            placeholder="Date of Birth"
            value={data.dob || ''}
            onChange={e => setData(d => ({ ...d, dob: e.target.value }))}
            className="px-3 py-2 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-sm"
          />
          <select
            value={data.risk_tolerance || 'moderate'}
            onChange={e => setData(d => ({ ...d, risk_tolerance: e.target.value as ClientProfileData['risk_tolerance'] }))}
            className="px-3 py-2 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-sm"
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>

      {/* Goals */}
      <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <h4 className="text-sm font-semibold text-[var(--portal)] mb-3">Client Goals</h4>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_GOALS.map(goal => (
            <button
              key={goal}
              onClick={() => toggleGoal(goal)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedGoals.has(goal)
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="px-4 py-2 rounded bg-[var(--portal)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Save Profile
      </button>
    </div>
  )
}

export type { RSPClientProfileProps, ClientProfileData }
