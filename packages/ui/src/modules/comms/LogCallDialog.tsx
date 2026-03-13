'use client'

import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { apiPost } from '@tomachina/core'

interface LogCallDialogProps {
  open: boolean
  onClose: () => void
  clientId: string
  clientName?: string
  onSaved?: () => void
}

type CallDirection = 'outbound' | 'inbound'
type CallOutcome = 'connected' | 'left_voicemail' | 'no_answer' | 'busy' | 'wrong_number'

const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'left_voicemail', label: 'Left Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
]

export function LogCallDialog({ open, onClose, clientId, clientName, onSaved }: LogCallDialogProps) {
  const { showToast } = useToast()
  const [direction, setDirection] = useState<CallDirection>('outbound')
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await apiPost('/api/comms/log-call', {
        client_id: clientId,
        direction,
        outcome,
        duration: duration ? Number(duration) : null,
        notes: notes.trim(),
      })
      if (result.success) {
        showToast('Call logged', 'success')
        setDirection('outbound')
        setOutcome('connected')
        setDuration('')
        setNotes('')
        onSaved?.()
        onClose()
      } else {
        showToast(result.error || 'Failed to log call', 'error')
      }
    } catch {
      showToast('Failed to log call', 'error')
    } finally {
      setSaving(false)
    }
  }

  const displayName = clientName || 'Client'

  return (
    <Modal open={open} onClose={onClose} title={`Log Call \u2014 ${displayName}`}
      footer={
        <>
          <button onClick={onClose} disabled={saving}
            className="rounded-md h-[34px] px-4 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Direction</label>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="call-direction" value="outbound"
                checked={direction === 'outbound'} onChange={() => setDirection('outbound')}
                disabled={saving} className="accent-[var(--portal)]" />
              <span className="text-sm text-[var(--text-primary)]">Outbound</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="call-direction" value="inbound"
                checked={direction === 'inbound'} onChange={() => setDirection('inbound')}
                disabled={saving} className="accent-[var(--portal)]" />
              <span className="text-sm text-[var(--text-primary)]">Inbound</span>
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Outcome</label>
          <div className="mt-2 space-y-2">
            {OUTCOMES.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="call-outcome" value={opt.value}
                  checked={outcome === opt.value} onChange={() => setOutcome(opt.value)}
                  disabled={saving} className="accent-[var(--portal)]" />
                <span className="text-sm text-[var(--text-primary)]">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            Duration <span className="normal-case">(optional, minutes)</span>
          </label>
          <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)}
            disabled={saving} placeholder="e.g. 15"
            className="mt-1 w-full max-w-[200px] rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} rows={4}
            placeholder="Call notes..."
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors resize-none" />
        </div>
      </div>
    </Modal>
  )
}
