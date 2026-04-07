'use client'

import { useState } from 'react'
import type { VoltronLionDomain, GapRequestPriority } from '@tomachina/core'
import { authFetch } from './auth-fetch'

// ── Constants ────────────────────────────────────────────────────────────

const DOMAINS: { value: VoltronLionDomain; label: string }[] = [
  { value: 'medicare', label: 'Medicare' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'investment', label: 'Investment' },
  { value: 'life-estate', label: 'Life & Estate' },
  { value: 'legacy-ltc', label: 'Legacy/LTC' },
  { value: 'general', label: 'General' },
]

const PRIORITIES: { value: GapRequestPriority; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'low', label: 'Low', color: '#22c55e' },
]

const colors = {
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#22c55e',
  red: '#ef4444',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#0a0e17',
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  color: colors.text,
  fontSize: '0.85rem',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  color: colors.blue,
  marginBottom: 6,
}

// ── Component ────────────────────────────────────────────────────────────

export function GapRequestForm({ sourceCaseId }: { sourceCaseId?: string }) {
  const [domain, setDomain] = useState<VoltronLionDomain>('general')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scenario, setScenario] = useState('')
  const [expectedOutput, setExpectedOutput] = useState('')
  const [priority, setPriority] = useState<GapRequestPriority>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !description || !scenario || !expectedOutput) return

    setSubmitting(true)
    setResult(null)

    try {
      const res = await authFetch('/api/voltron/gap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          title,
          description,
          scenario,
          expected_output: expectedOutput,
          priority,
          source_case_id: sourceCaseId || null,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult({ success: true, message: 'Gap request submitted' })
      setTitle('')
      setDescription('')
      setScenario('')
      setExpectedOutput('')
    } catch {
      setResult({ success: false, message: 'Failed to submit gap request' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: colors.text, margin: '0 0 4px' }}>
          Gap Request
        </h3>
        <p style={{ fontSize: '0.8rem', color: colors.textMuted, margin: 0 }}>
          Report a missing wire or capability for CTO review
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Domain</label>
          <select
            value={domain}
            onChange={e => setDomain(e.target.value as VoltronLionDomain)}
            style={inputStyle}
          >
            {DOMAINS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as GapRequestPriority)}
            style={inputStyle}
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Short description of missing capability"
          style={inputStyle}
          required
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's missing and why it matters"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' as const }}
          required
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Scenario</label>
        <textarea
          value={scenario}
          onChange={e => setScenario(e.target.value)}
          placeholder="Client scenario that triggered this gap"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' as const }}
          required
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Expected Output</label>
        <textarea
          value={expectedOutput}
          onChange={e => setExpectedOutput(e.target.value)}
          placeholder="What the wire should produce"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' as const }}
          required
        />
      </div>

      {result && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 6,
          marginBottom: 16,
          fontSize: '0.85rem',
          color: result.success ? colors.green : colors.red,
          background: result.success ? `${colors.green}15` : `${colors.red}15`,
        }}>
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !title || !description || !scenario || !expectedOutput}
        style={{
          padding: '10px 24px',
          background: submitting ? colors.bgHover : colors.blue,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? 'Submitting...' : 'Submit Gap Request'}
      </button>
    </form>
  )
}
