'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { useToast } from '../../components/Toast'

/**
 * VoicemailConfig — CP08
 * Admin UI for voicemail settings: greeting message,
 * voicemail-to-email toggle, and transcription toggle.
 * Wired to Firestore config/voicemail document.
 */

/* ─── Types ─── */

interface VoicemailSettings {
  greeting_text: string
  max_length: number
  email_notification: boolean
  transcription_enabled: boolean
}

const DEFAULTS: VoicemailSettings = {
  greeting_text:
    "Thank you for calling Retirement Protectors. We're unable to take your call right now. Please leave a message and we'll get back to you as soon as possible.",
  max_length: 120,
  email_notification: true,
  transcription_enabled: true,
}

/* ─── Component ─── */

export function VoicemailConfig() {
  const [config, setConfig] = useState<VoicemailSettings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { showToast } = useToast()

  // Load config from Firestore on mount
  useEffect(() => {
    async function load() {
      try {
        const db = getDb()
        const snap = await getDoc(doc(db, 'config', 'voicemail'))
        if (snap.exists()) {
          const data = snap.data() as Partial<VoicemailSettings>
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
      await setDoc(doc(db, 'config', 'voicemail'), {
        ...config,
        updated_at: new Date().toISOString(),
      }, { merge: true })
      showToast('Voicemail configuration saved', 'success')
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
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Voicemail Configuration</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Configure voicemail behavior for missed and after-hours calls.
        </p>
      </div>

      {/* Greeting Message */}
      <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Greeting Message</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          This message plays when a caller reaches voicemail (text-to-speech).
        </p>
        <textarea
          value={config.greeting_text}
          onChange={(e) => setConfig((c) => ({ ...c, greeting_text: e.target.value }))}
          rows={4}
          className="mt-3 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
        />
        <div className="mt-2 text-[10px] text-[var(--text-muted)]">{config.greeting_text.length} characters</div>
      </div>

      {/* Max Recording Length */}
      <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Max Recording Length</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Maximum voicemail length in seconds.
        </p>
        <input
          type="number"
          value={config.max_length}
          onChange={(e) => setConfig((c) => ({ ...c, max_length: Number(e.target.value) || 120 }))}
          min={30}
          max={300}
          className="mt-3 w-32 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
        />
        <span className="ml-2 text-xs text-[var(--text-muted)]">seconds</span>
      </div>

      {/* Voicemail-to-Email Toggle */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Voicemail-to-Email</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Forward voicemail recordings to the assigned team member via email.
          </p>
        </div>
        <button
          onClick={() => setConfig((c) => ({ ...c, email_notification: !c.email_notification }))}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            config.email_notification ? '' : 'bg-[var(--bg-surface)]'
          }`}
          style={config.email_notification ? { background: 'var(--portal)' } : undefined}
          role="switch"
          aria-checked={config.email_notification}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            style={{ left: config.email_notification ? '22px' : '2px' }}
          />
        </button>
      </div>

      {/* Transcription Toggle */}
      <div className="mb-8 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Voicemail Transcription</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Automatically transcribe voicemail messages using Twilio speech-to-text.
          </p>
        </div>
        <button
          onClick={() => setConfig((c) => ({ ...c, transcription_enabled: !c.transcription_enabled }))}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            config.transcription_enabled ? '' : 'bg-[var(--bg-surface)]'
          }`}
          style={config.transcription_enabled ? { background: 'var(--portal)' } : undefined}
          role="switch"
          aria-checked={config.transcription_enabled}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            style={{ left: config.transcription_enabled ? '22px' : '2px' }}
          />
        </button>
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
