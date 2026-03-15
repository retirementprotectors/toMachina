'use client'

import { useState } from 'react'

/**
 * VoicemailConfig — TRK-084
 *
 * Admin stub for voicemail settings: greeting message,
 * voicemail-to-email toggle, and transcription toggle.
 *
 * STUB: All UI, no backend. Sprint 10 wires Twilio voicemail
 * with transcription and email forwarding.
 */

/* ─── Component ─── */

export function VoicemailConfig() {
  const [greeting, setGreeting] = useState(
    'Thank you for calling Retirement Protectors. We are unable to take your call right now. Please leave a message and we will get back to you as soon as possible.'
  )
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(true)

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Voicemail Configuration</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Configure voicemail behavior for missed and after-hours calls. Twilio integration in Sprint 10.
        </p>
      </div>

      {/* Greeting Message */}
      <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Greeting Message</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          This message plays when a caller reaches voicemail. Sprint 10 adds text-to-speech preview.
        </p>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          rows={4}
          className="mt-3 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)]">{greeting.length} characters</span>
          <button
            className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>play_arrow</span>
            Preview
          </button>
        </div>
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
          onClick={() => setEmailEnabled((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            emailEnabled ? '' : 'bg-[var(--bg-surface)]'
          }`}
          style={emailEnabled ? { background: 'var(--portal)' } : undefined}
          role="switch"
          aria-checked={emailEnabled}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            style={{ left: emailEnabled ? '22px' : '2px' }}
          />
        </button>
      </div>

      {/* Transcription Toggle */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Voicemail Transcription</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Automatically transcribe voicemail messages using AI speech-to-text.
          </p>
        </div>
        <button
          onClick={() => setTranscriptionEnabled((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            transcriptionEnabled ? '' : 'bg-[var(--bg-surface)]'
          }`}
          style={transcriptionEnabled ? { background: 'var(--portal)' } : undefined}
          role="switch"
          aria-checked={transcriptionEnabled}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            style={{ left: transcriptionEnabled ? '22px' : '2px' }}
          />
        </button>
      </div>

      {/* Footer note */}
      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        All voicemail settings are concept stubs. Backend wiring with Twilio in Sprint 10.
      </p>
    </div>
  )
}
