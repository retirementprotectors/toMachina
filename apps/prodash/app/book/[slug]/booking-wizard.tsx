'use client'

import { useState, useEffect } from 'react'
import { useBooking, type BookingConfigData } from './use-booking'
import { StepType } from './steps/step-type'
import { StepDatetime } from './steps/step-datetime'
import { StepContact } from './steps/step-contact'
import { StepConfirm } from './steps/step-confirm'

const STEPS = ['type', 'datetime', 'contact', 'confirm'] as const

// ─── Loader: fetches config client-side via /api/ proxy ───────────────────────

export function BookingLoader({ slug }: { slug: string }) {
  const [config, setConfig] = useState<BookingConfigData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/booking/config/${slug}`)
        if (res.ok) {
          const json = await res.json()
          if (json.success) setConfig(json.data)
          else setError(json.error || 'Configuration not found')
        } else if (res.status === 404) {
          setError('not_found')
        } else {
          setError(`Unable to load booking page (${res.status})`)
        }
      } catch {
        setError('Unable to connect to booking service')
      }
      setLoading(false)
    }
    loadConfig()
  }, [slug])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #1e293b', borderTopColor: '#4a7ab5',
          borderRadius: '50%', margin: '0 auto 16px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading booking page...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error === 'not_found') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>404</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>Booking Page Not Found</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          The booking link you followed may be outdated or incorrect.
        </p>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{error || 'Unable to load booking configuration'}</p>
      </div>
    )
  }

  return <BookingWizard config={config} slug={slug} />
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface BookingWizardProps {
  config: BookingConfigData
  slug: string
}

export function BookingWizard({ config }: BookingWizardProps) {
  const booking = useBooking(config)
  const currentIdx = STEPS.indexOf(booking.step)

  return (
    <div>
      {/* Step indicator */}
      {booking.step !== 'confirm' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {STEPS.slice(0, 3).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: i <= currentIdx ? 'rgba(74,122,181,0.2)' : 'rgba(148,163,184,0.1)',
                  color: i <= currentIdx ? '#4a7ab5' : '#64748b',
                  border: `2px solid ${i <= currentIdx ? '#4a7ab5' : '#1e293b'}`,
                  transition: 'all 0.3s ease',
                }}
              >
                {i < currentIdx ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div style={{
                  width: 40,
                  height: 2,
                  background: i < currentIdx ? '#4a7ab5' : '#1e293b',
                  borderRadius: 1,
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {booking.error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: '0.85rem',
          color: '#fca5a5',
        }}>
          {booking.error}
        </div>
      )}

      {/* Steps */}
      {booking.step === 'type' && <StepType booking={booking} />}
      {booking.step === 'datetime' && <StepDatetime booking={booking} />}
      {booking.step === 'contact' && <StepContact booking={booking} />}
      {booking.step === 'confirm' && <StepConfirm booking={booking} />}

      {/* Powered by footer */}
      <div style={{
        textAlign: 'center',
        marginTop: 32,
        fontSize: '0.7rem',
        color: '#475569',
        letterSpacing: '0.05em',
      }}>
        RETIREMENT PROTECTORS, INC.
      </div>
    </div>
  )
}
