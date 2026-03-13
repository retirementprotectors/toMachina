'use client'

import { useState } from 'react'

interface CredentialsModalProps {
  serviceName: string
  existingUsername?: string
  existingNotes?: string
  onSave: (username: string, notes: string) => void
  onClose: () => void
}

export function CredentialsModal({ serviceName, existingUsername, existingNotes, onSave, onClose }: CredentialsModalProps) {
  const [username, setUsername] = useState(existingUsername || '')
  const [notes, setNotes] = useState(existingNotes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!username.trim()) return
    setSaving(true)
    try {
      await onSave(username.trim(), notes.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Update Credentials</h3>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{serviceName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Username / Login</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. josh@retireprotected.com"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any relevant notes about this access..."
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md h-[34px] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!username.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium bg-[var(--portal)] text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[14px]">save</span>
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
