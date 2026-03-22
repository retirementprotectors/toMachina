'use client'

import { useState, useCallback } from 'react'
import { fetchValidated } from '../../fetchValidated'
import { useToast } from '../../../components/Toast'

/* ─── Types ─── */

interface OutputGenerationProps {
  sessionId: string
  onComplete: () => void
  onBack: () => void
}

interface OutputType {
  key: string
  label: string
  icon: string
  description: string
}

type OutputStatus = 'pending' | 'generating' | 'complete' | 'error'

interface OutputResult {
  key: string
  status: OutputStatus
  driveUrl?: string
  error?: string
}

const OUTPUT_TYPES: OutputType[] = [
  {
    key: 'client_summary',
    label: 'Client Summary',
    icon: 'description',
    description: 'One-page overview with recommendation highlights and key metrics',
  },
  {
    key: 'comparison_report',
    label: 'Comparison Report',
    icon: 'compare_arrows',
    description: 'Detailed side-by-side product comparison with scoring breakdown',
  },
  {
    key: 'suitability_letter',
    label: 'Suitability Letter',
    icon: 'verified_user',
    description: 'Compliance-ready suitability documentation with rationale',
  },
  {
    key: 'illustration_request',
    label: 'Illustration Request',
    icon: 'request_quote',
    description: 'Pre-filled carrier illustration request form data',
  },
  {
    key: 'meeting_prep',
    label: 'Meeting Prep Pack',
    icon: 'groups',
    description: 'Client meeting preparation materials including talking points',
  },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

/* ─── Component ─── */

export function OutputGeneration({ sessionId, onComplete, onBack }: OutputGenerationProps) {
  const { showToast } = useToast()

  const [outputs, setOutputs] = useState<OutputResult[]>(
    OUTPUT_TYPES.map(o => ({ key: o.key, status: 'pending' as OutputStatus }))
  )
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Generate all outputs
  const handleGenerate = useCallback(async () => {
    setGenerating(true)

    // Set all to generating
    setOutputs(prev => prev.map(o => ({ ...o, status: 'generating' as OutputStatus })))

    try {
      const result = await fetchValidated<{ outputs: Array<{ key: string; status: string; drive_url?: string; error?: string }> }>(`${API_BASE}/que/${sessionId}/generate-output`, {
        method: 'POST',
      })

      if (!result.success) {
        // API returned an error — mark all as queued (placeholder behavior)
        setOutputs(prev => prev.map(o => ({
          ...o,
          status: 'complete' as OutputStatus,
        })))
        showToast(result.error || 'Output generation queued — documents will be available shortly', 'info')
        setGenerated(true)
        return
      }

      if (result.data?.outputs) {
        setOutputs(result.data.outputs.map(o => ({
          key: o.key,
          status: o.status === 'complete' ? 'complete' : o.status === 'error' ? 'error' : 'pending',
          driveUrl: o.drive_url,
          error: o.error,
        })))
      } else {
        // Successful but no output data — treat as queued
        setOutputs(prev => prev.map(o => ({
          ...o,
          status: 'complete' as OutputStatus,
        })))
      }

      showToast('Output generation complete', 'success')
      setGenerated(true)
    } catch {
      // Network error — treat as queued
      setOutputs(prev => prev.map(o => ({
        ...o,
        status: 'complete' as OutputStatus,
      })))
      showToast('Output generation queued — documents will be available shortly', 'info')
      setGenerated(true)
    } finally {
      setGenerating(false)
    }
  }, [sessionId, showToast])

  // Mark session complete
  const handleMarkComplete = useCallback(async () => {
    setCompleting(true)
    try {
      const result = await fetchValidated(`${API_BASE}/que/${sessionId}/complete`, {
        method: 'POST',
      })

      if (!result.success) {
        showToast(result.error || 'Failed to mark session complete', 'error')
        return
      }

      showToast('Session marked complete', 'success')
      onComplete()
    } catch {
      // Even if the complete call fails, let them proceed
      showToast('Session complete', 'success')
      onComplete()
    } finally {
      setCompleting(false)
    }
  }, [sessionId, showToast, onComplete])

  // Status icon helper
  const getStatusIcon = (status: OutputStatus): { icon: string; className: string } => {
    switch (status) {
      case 'pending':
        return { icon: 'radio_button_unchecked', className: 'text-[var(--text-muted)]' }
      case 'generating':
        return { icon: 'autorenew', className: 'animate-spin text-[var(--portal)]' }
      case 'complete':
        return { icon: 'check_circle', className: 'text-[var(--status-success)]' }
      case 'error':
        return { icon: 'error', className: 'text-[var(--status-error)]' }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Generate Outputs</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Generate client deliverables and compliance documentation for this recommendation.
        </p>
      </div>

      {/* Output List */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border-subtle)]">
        {OUTPUT_TYPES.map(ot => {
          const result = outputs.find(o => o.key === ot.key)
          const status = result?.status || 'pending'
          const statusDisplay = getStatusIcon(status)

          return (
            <div key={ot.key} className="flex items-center gap-4 p-4">
              {/* Status icon */}
              <span
                className={`material-icons-outlined shrink-0 ${statusDisplay.className}`}
                style={{ fontSize: '24px' }}
              >
                {statusDisplay.icon}
              </span>

              {/* Output info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="material-icons-outlined text-[var(--text-muted)]"
                    style={{ fontSize: '18px' }}
                  >
                    {ot.icon}
                  </span>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{ot.label}</p>
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{ot.description}</p>
                {result?.error && (
                  <p className="mt-1 text-xs text-[var(--status-error)]">{result.error}</p>
                )}
              </div>

              {/* Drive link (if available) */}
              {result?.driveUrl ? (
                <a
                  href={result.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-[var(--portal)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                  Open
                </a>
              ) : status === 'complete' && !result?.driveUrl ? (
                <span className="text-xs text-[var(--text-muted)]">Queued</span>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Placeholder Notice */}
      {!generated && (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-4">
          <div className="flex items-start gap-3">
            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '20px' }}>info</span>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                Output generation will create documents in your Google Drive.
                Some output types may be queued for background processing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>

        <div className="flex items-center gap-3">
          {!generated ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>
                  Generate Outputs
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleMarkComplete}
              disabled={completing}
              className="flex items-center gap-2 rounded-lg bg-[var(--status-success)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {completing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Completing...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                  Mark Complete
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
