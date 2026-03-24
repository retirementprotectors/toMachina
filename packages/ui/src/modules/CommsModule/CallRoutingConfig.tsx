'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { useToast } from '../../components/Toast'

/**
 * CallRoutingConfig — CP07
 * Admin UI for call routing rules and business hours configuration.
 * Wired to Firestore config/call_routing document.
 */

/* ─── Types ─── */

interface RoutingConfig {
  default_agent: string
  business_hours_start: string
  business_hours_end: string
  after_hours_action: 'voicemail' | 'ring_default'
}

const DEFAULTS: RoutingConfig = {
  default_agent: 'josh@retireprotected.com',
  business_hours_start: '08:00',
  business_hours_end: '17:00',
  after_hours_action: 'voicemail',
}

/* ─── Component ─── */

export function CallRoutingConfig() {
  const [config, setConfig] = useState<RoutingConfig>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { showToast } = useToast()

  // Load config from Firestore on mount
  useEffect(() => {
    async function load() {
      try {
        const db = getDb()
        const snap = await getDoc(doc(db, 'config', 'call_routing'))
        if (snap.exists()) {
          const data = snap.data() as Partial<RoutingConfig>
          setConfig({ ...DEFAULTS, ...data })
        }
      } catch {
        // Use defaults on error
      }
      setLoaded(true)
    }
    void load()
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const db = getDb()
      await setDoc(doc(db, 'config', 'call_routing'), {
        ...config,
        updated_at: new Date().toISOString(),
      }, { merge: true })
      showToast('Call routing configuration saved', 'success')
    } catch {
      showToast('Failed to save configuration', 'error')
    }
    setSaving(false)
  }, [config, showToast])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="material-icons-outlined animate-spin text-2xl text-[var(--text-muted)]">sync</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Call Routing Configuration</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Configure how incoming calls are routed to team members.
        </p>
      </div>

      {/* Default Agent */}
      <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Default Agent</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Calls from unassigned clients or unknown numbers route here.
        </p>
        <input
          type="email"
          value={config.default_agent}
          onChange={(e) => setConfig((c) => ({ ...c, default_agent: e.target.value }))}
          placeholder="email@retireprotected.com"
          className="mt-3 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
        />
      </div>

      {/* Business Hours */}
      <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Business Hours</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Calls outside business hours follow the after-hours action below.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Start Time</label>
            <input
              type="time"
              value={config.business_hours_start}
              onChange={(e) => setConfig((c) => ({ ...c, business_hours_start: e.target.value }))}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
            />
          </div>
          <span className="mt-5 text-[var(--text-muted)]">to</span>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">End Time</label>
            <input
              type="time"
              value={config.business_hours_end}
              onChange={(e) => setConfig((c) => ({ ...c, business_hours_end: e.target.value }))}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
            />
          </div>
        </div>
      </div>

      {/* After-Hours Action */}
      <div className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">After-Hours Action</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          What happens when calls come in outside business hours.
        </p>
        <div className="mt-3 flex gap-2">
          {(['voicemail', 'ring_default'] as const).map((action) => (
            <button
              key={action}
              onClick={() => setConfig((c) => ({ ...c, after_hours_action: action }))}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg h-[40px] text-xs font-semibold transition-colors ${
                config.after_hours_action === action
                  ? 'text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={config.after_hours_action === action ? { background: 'var(--portal)' } : undefined}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                {action === 'voicemail' ? 'voicemail' : 'phone_forwarded'}
              </span>
              {action === 'voicemail' ? 'Go to Voicemail' : 'Ring Default Agent'}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg h-[40px] text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
        style={{ background: 'var(--portal)' }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
          {saving ? 'hourglass_top' : 'save'}
        </span>
        {saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  )
}
