'use client'

import { useBooking, type BookingConfigData } from './use-booking'
import { StepType } from './steps/step-type'
import { StepDatetime } from './steps/step-datetime'
import { StepContact } from './steps/step-contact'
import { StepConfirm } from './steps/step-confirm'

const STEPS = ['type', 'datetime', 'contact', 'confirm'] as const
const STEP_LABELS = ['Type', 'Date & Time', 'Your Info', 'Confirmed']

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
