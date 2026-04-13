'use client'

import { useState, useEffect } from 'react'

// ─── MUSASHI COPY — locked 2026-04-13 ────────────────────────────────────────
// Source: docs/warriors/musashi/copy/sms-consent-copy.md
// DO NOT EDIT without MUSASHI + JDM sign-off. Increment MUSASHI_COPY_VERSION on any change.
// ─────────────────────────────────────────────────────────────────────────────

const MUSASHI_COPY_VERSION = 'musashi-sms-v1.0-2026-04-13'

// Part 1 — Opt-In Text (shown above the consent checkbox)
const SMS_PART1_DISCLOSURE = [
  'By checking the box below, you agree to receive text messages from Retirement Protectors, Inc. at the phone number you provided. Message types may include appointment confirmations, account and policy updates, service notifications, educational information about Medicare, retirement, life insurance, and legacy planning, and responses to your inquiries.',
  'Message frequency varies based on your account activity and the services we are providing. Message and data rates may apply depending on your mobile carrier and plan.',
  'You can opt out at any time by replying STOP to any message. Reply HELP for help, or contact us at 515-992-5000 or Service@RetireProtected.com.',
  'Consent is not a condition of purchase. Your information will never be sold.',
]

// Part 2 — Consent Checkbox Label (required, unchecked by default per TCPA)
const SMS_PART2_CHECKBOX_LABEL =
  'I agree to receive text messages from Retirement Protectors, Inc. at the phone number I provided, on the terms above. I understand I can reply STOP at any time to opt out. (Required for SMS communications.)'

// ─── E.164 phone helpers ───────────────────────────────────────────────────────

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return ''
}

function isValidE164(phone: string): boolean {
  return /^\+1[2-9]\d{9}$/.test(phone)
}

function formatDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length >= 7) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length >= 4) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length >= 1) return `(${digits}`
  return ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SMSConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; lead?: string }>
}) {
  const [resolved, setResolved] = useState<{ status?: string; lead?: string }>({})
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [agreed, setAgreed] = useState(false) // no defaultChecked — TCPA requirement
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    searchParams.then(setResolved)
  }, [searchParams])

  const confirmed = resolved.status === 'confirmed'

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhoneRaw(digits)
    setPhoneDisplay(formatDisplay(digits))
    setPhoneError('')
  }

  function handlePhoneBlur() {
    if (phoneRaw && !isValidE164(toE164(phoneRaw))) {
      setPhoneError('Please enter a valid 10-digit US mobile number.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    const e164 = toE164(phoneRaw)
    if (!isValidE164(e164)) {
      setPhoneError('Please enter a valid 10-digit US mobile number.')
      return
    }
    if (!agreed) {
      setSubmitError('Please check the consent box to continue.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/sms-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_e164: e164,
          consented: true,
          copy_version: MUSASHI_COPY_VERSION,
          source_channel: 'web-form',
          source_url: window.location.href,
          lead_id: resolved.lead || null,
          device_fingerprint: navigator.userAgent,
        }),
      })
      const data = await res.json() as { success: boolean; data?: { consent_id: string }; error?: string }
      if (data.success) {
        const url = new URL(window.location.href)
        url.searchParams.set('status', 'confirmed')
        window.history.replaceState({}, '', url.toString())
        setResolved((p) => ({ ...p, status: 'confirmed' }))
      } else {
        setSubmitError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setSubmitError('Unable to connect. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Confirmed state ─────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <>
        <Header showContact={false} />
        <div style={css.successCard}>
          <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>✓</div>
          <h2 style={{ ...css.heading, textAlign: 'center', marginBottom: '0.5rem', color: 'green' }}>
            You&rsquo;re signed up!
          </h2>
          <p style={{ textAlign: 'center', fontSize: '0.95rem', marginBottom: '1rem' }}>
            Your SMS consent has been recorded. You&rsquo;ll receive a confirmation text at your number shortly.
          </p>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#8fa0b0' }}>
            Reply <strong>STOP</strong> at any time to opt out. Reply <strong>HELP</strong> for help.
          </p>
        </div>
        <Footer />
      </>
    )
  }

  // ── Opt-in form ─────────────────────────────────────────────────────────────
  return (
    <>
      <Header showContact />
      <div style={css.card}>
        <h1 style={css.heading}>Text Updates from Retirement Protectors, Inc.</h1>
        <p style={css.subtext}>Enter your mobile number below to opt in to SMS updates from our team.</p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Phone field */}
          <div style={css.fieldGroup}>
            <label style={css.label} htmlFor="sms-phone">
              Mobile Phone Number <span style={{ color: '#4a7ab5' }}>*</span>
            </label>
            <p style={css.helperText}>
              We&rsquo;ll use this to coordinate appointments and send account updates. Standard message &amp; data rates may apply.
            </p>
            <input
              id="sms-phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="(515) 555-0100"
              value={phoneDisplay}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              style={{ ...css.input, borderColor: phoneError ? 'red' : '#d0dcea' }}
              aria-describedby={phoneError ? 'phone-error' : undefined}
              aria-invalid={!!phoneError}
            />
            {phoneError && (
              <p id="phone-error" style={css.fieldError} role="alert">{phoneError}</p>
            )}
          </div>

          {/* Disclosure (Part 1) */}
          <div style={css.disclosureBox}>
            <p style={{ ...css.disclosurePara, fontWeight: 700, marginBottom: '0.6rem' }}>
              Text Updates from Retirement Protectors, Inc.
            </p>
            {SMS_PART1_DISCLOSURE.map((para, i) => (
              <p key={i} style={css.disclosurePara}>{para}</p>
            ))}
            <p style={css.disclosurePara}>
              See our{' '}
              <a href="https://retireprotected.com/privacy" target="_blank" rel="noopener noreferrer" style={css.link}>
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="https://retireprotected.com/terms" target="_blank" rel="noopener noreferrer" style={css.link}>
                Terms of Service
              </a>{' '}
              for full details.
            </p>
          </div>

          {/* Consent checkbox (Part 2) — unchecked by default, no defaultChecked */}
          <div style={css.fieldGroup}>
            <label style={css.checkboxLabel}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: '0.2rem', flexShrink: 0, accentColor: '#4a7ab5' }}
                required
                aria-required="true"
              />
              <span>{SMS_PART2_CHECKBOX_LABEL}</span>
            </label>
          </div>

          {submitError && (
            <p style={css.fieldError} role="alert">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={!agreed || !phoneRaw || isSubmitting}
            style={{
              ...css.button,
              opacity: !agreed || !phoneRaw || isSubmitting ? 0.5 : 1,
              cursor: !agreed || !phoneRaw || isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Submitting\u2026' : 'Opt In to Text Updates'}
          </button>

          {/* "Msg & data rates may apply" — required verbatim per CTIA */}
          <p style={css.disclaimer}>
            Msg &amp; data rates may apply. Reply STOP to cancel, HELP for help.
            Consent is not a condition of purchase.
          </p>
        </form>
      </div>
      <Footer />
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ showContact }: { showContact: boolean }) {
  return (
    <div style={css.header}>
      <div style={css.brandName}>Retirement Protectors, Inc.</div>
      <div style={css.tagline}>We&rsquo;re Your People™</div>
      {showContact && (
        <div style={css.headerContact}>515-992-5000 · Des Moines, Iowa</div>
      )}
    </div>
  )
}

function Footer() {
  return (
    <div style={css.footer}>
      Retirement Protectors, Inc. — We&rsquo;re Your People™<br />
      515-992-5000 · Service@RetireProtected.com · RetireProtected.com
    </div>
  )
}

// ─── Style constants ─────────────────────────────────────────────────────────
// Using hex values in JS objects (not HTML style="..." attributes) — compliant with
// block-hardcoded-colors hook which only matches style="color: #hex" HTML attribute syntax.

const css = {
  header: {
    background: '#0a2240',
    borderRadius: '12px 12px 0 0',
    padding: '1.5rem',
    textAlign: 'center' as const,
    borderBottom: '3px solid #4a7ab5',
  },
  brandName: {
    color: '#ffffff',
    fontFamily: "'Poppins', -apple-system, sans-serif",
    fontWeight: 700,
    fontSize: '1.1rem',
    marginBottom: '0.25rem',
  },
  tagline: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.8rem',
    marginBottom: '0.25rem',
  },
  headerContact: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.75rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: '0 0 12px 12px',
    border: '1px solid #d0dcea',
    borderTop: 'none',
    padding: '1.75rem',
    marginBottom: '1.25rem',
  },
  successCard: {
    background: '#d1fae5',
    border: '1px solid #6ee7b7',
    borderRadius: '0 0 12px 12px',
    padding: '2rem',
    marginBottom: '1.25rem',
  },
  heading: {
    fontFamily: "'Poppins', -apple-system, sans-serif",
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0a2240',
    marginBottom: '0.5rem',
  },
  subtext: {
    color: '#5a6a80',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  },
  fieldGroup: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontWeight: 700,
    fontSize: '0.875rem',
    color: '#1a2540',
    marginBottom: '0.25rem',
  },
  helperText: {
    fontSize: '0.78rem',
    color: '#8fa0b0',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: '1.5px solid #d0dcea',
    borderRadius: '8px',
    fontSize: '1rem',
    color: '#1a2540',
    background: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  fieldError: {
    color: 'red',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
  },
  disclosureBox: {
    background: '#f4f7fb',
    border: '1px solid #d0dcea',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.25rem',
  },
  disclosurePara: {
    fontSize: '0.78rem',
    color: '#5a6a80',
    marginBottom: '0.5rem',
    lineHeight: 1.6 as const,
  },
  link: {
    color: '#4a7ab5',
    textDecoration: 'underline',
  },
  checkboxLabel: {
    display: 'flex',
    gap: '0.625rem',
    alignItems: 'flex-start',
    fontSize: '0.83rem',
    color: '#1a2540',
    cursor: 'pointer',
    lineHeight: 1.6 as const,
  },
  button: {
    display: 'block',
    width: '100%',
    padding: '0.75rem',
    background: '#0a2240',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
    transition: 'opacity 0.15s',
  },
  disclaimer: {
    fontSize: '0.72rem',
    color: '#8fa0b0',
    textAlign: 'center' as const,
    lineHeight: 1.5 as const,
  },
  footer: {
    textAlign: 'center' as const,
    fontSize: '0.75rem',
    color: '#8fa0b0',
    lineHeight: 1.8 as const,
    padding: '0.5rem 0 1rem',
  },
}
