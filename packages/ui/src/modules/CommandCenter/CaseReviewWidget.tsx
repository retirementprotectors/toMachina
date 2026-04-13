'use client'

import { useState } from 'react'
import type { CaseOutcome } from '@tomachina/core'
import { authFetch } from './auth-fetch'

// ── Types ──────────────────────────────────────────────────────────────

interface CaseReviewWidgetProps {
  caseId: string
  currentStatus: string
  onReviewComplete?: (outcome: CaseOutcome) => void
}

const colors = {
  bg: '#0a0e17',
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f59e0b',
  red: '#ef4444',
}

// ── Component ──────────────────────────────────────────────────────────

export function CaseReviewWidget({ caseId, currentStatus, onReviewComplete }: CaseReviewWidgetProps) {
  const [submitting, setSubmitting] = useState(false)
  const [activeAction, setActiveAction] = useState<CaseOutcome | null>(null)
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Only show for output_ready or agent_review status
  if (currentStatus !== 'output_ready' && currentStatus !== 'agent_review') {
    return null
  }

  async function submitOutcome(outcome: CaseOutcome) {
    setSubmitting(true)
    setResult(null)

    try {
      const body: Record<string, unknown> = { outcome }
      if (notes.trim()) {
        body.revision_notes = notes.trim()
      }

      const res = await authFetch(`/api/voltron/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setResult({ success: true, message: `Case ${outcome}` })
      setActiveAction(null)
      setNotes('')
      onReviewComplete?.(outcome)
    } catch {
      setResult({ success: false, message: 'Failed to submit review' })
    } finally {
      setSubmitting(false)
    }
  }

  const buttonStyle = (color: string, isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: isActive ? `${color}25` : 'transparent',
    border: `1px solid ${isActive ? color : colors.border}`,
    borderRadius: 6,
    color: isActive ? color : colors.textMuted,
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: submitting ? 'not-allowed' : 'pointer',
    opacity: submitting ? 0.5 : 1,
    transition: 'all 0.2s',
  })

  return (
    <div style={{
      padding: 16,
      background: colors.bgHover,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
    }}>
      <div style={{
        fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const,
        letterSpacing: '1px', color: colors.blue, marginBottom: 12,
      }}>
        Review Outcome
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => {
            if (activeAction === 'accepted') {
              submitOutcome('accepted')
            } else {
              setActiveAction('accepted')
            }
          }}
          disabled={submitting}
          style={buttonStyle(colors.green, activeAction === 'accepted')}
        >
          {activeAction === 'accepted' ? 'Confirm Accept' : 'Accept'}
        </button>
        <button
          onClick={() => setActiveAction(activeAction === 'revised' ? null : 'revised')}
          disabled={submitting}
          style={buttonStyle(colors.orange, activeAction === 'revised')}
        >
          Revise
        </button>
        <button
          onClick={() => setActiveAction(activeAction === 'escalated' ? null : 'escalated')}
          disabled={submitting}
          style={buttonStyle(colors.red, activeAction === 'escalated')}
        >
          Escalate
        </button>
      </div>

      {/* Notes field for Revise/Escalate */}
      {(activeAction === 'revised' || activeAction === 'escalated') && (
        <div style={{ marginBottom: 12 }}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={activeAction === 'revised' ? 'What did you change?' : 'Why is this being escalated?'}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              color: colors.text,
              fontSize: '0.82rem',
              resize: 'vertical' as const,
              outline: 'none',
            }}
          />
          <button
            onClick={() => submitOutcome(activeAction)}
            disabled={submitting || !notes.trim()}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              background: submitting || !notes.trim() ? colors.bgHover : (activeAction === 'revised' ? colors.orange : colors.red),
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: submitting || !notes.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !notes.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? 'Submitting...' : `Submit ${activeAction === 'revised' ? 'Revision' : 'Escalation'}`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: '0.82rem',
          color: result.success ? colors.green : colors.red,
          background: result.success ? `${colors.green}15` : `${colors.red}15`,
        }}>
          {result.message}
        </div>
      )}
    </div>
  )
}
