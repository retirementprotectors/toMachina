'use client'

import { useState } from 'react'

/**
 * CallRoutingConfig — TRK-083
 *
 * Admin stub for call routing rules and business hours configuration.
 * Displays a route rules table with mock data and business hours inputs.
 *
 * STUB: All UI, no backend. Sprint 10 wires Twilio Studio flows.
 */

/* ─── Types ─── */

interface RouteRule {
  id: string
  name: string
  condition: string
  destination: string
  priority: number
}

interface BusinessHours {
  start: string
  end: string
}

/* ─── Mock Data ─── */

const INITIAL_RULES: RouteRule[] = [
  {
    id: 'rule-1',
    name: 'Service Clients',
    condition: 'Caller is assigned to Service Division',
    destination: 'Nikki Gray',
    priority: 1,
  },
  {
    id: 'rule-2',
    name: 'Sales Inquiries',
    condition: 'Caller is new lead or Sales Division client',
    destination: 'Vince Vazquez',
    priority: 2,
  },
  {
    id: 'rule-3',
    name: 'Fallback',
    condition: 'No other rule matches',
    destination: 'Main Office Queue',
    priority: 3,
  },
]

/* ─── Component ─── */

export function CallRoutingConfig() {
  const [rules] = useState<RouteRule[]>(INITIAL_RULES)
  const [hours, setHours] = useState<BusinessHours>({ start: '08:00', end: '17:00' })

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Call Routing Configuration</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Configure how incoming calls are routed to team members. Twilio Studio integration in Sprint 10.
        </p>
      </div>

      {/* Business Hours */}
      <div className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Business Hours</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Calls outside business hours go to voicemail.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Start Time</label>
            <input
              type="time"
              value={hours.start}
              onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
            />
          </div>
          <span className="mt-5 text-[var(--text-muted)]">to</span>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">End Time</label>
            <input
              type="time"
              value={hours.end}
              onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
            />
          </div>
        </div>
      </div>

      {/* Route Rules Table */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Routing Rules</h3>
          <button
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
            Add Rule
          </button>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_1.5fr_1fr] gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">#</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Rule Name</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Condition</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Destination</span>
        </div>

        {/* Rule rows */}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="grid grid-cols-[40px_1fr_1.5fr_1fr] gap-3 border-b border-[var(--border-subtle)] px-5 py-3 last:border-b-0 hover:bg-[var(--bg-hover)]"
          >
            <span className="text-xs font-semibold text-[var(--text-muted)]">{rule.priority}</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{rule.name}</span>
            <span className="text-sm text-[var(--text-secondary)]">{rule.condition}</span>
            <span className="text-sm text-[var(--text-secondary)]">{rule.destination}</span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        Rules are evaluated top-to-bottom. First matching rule wins. Backend wiring in Sprint 10.
      </p>
    </div>
  )
}
