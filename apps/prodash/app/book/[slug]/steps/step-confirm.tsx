'use client'

import type { BookingHook } from '../use-booking'

export function StepConfirm({ booking }: { booking: BookingHook }) {
  const { result, clientInfo, selectedType, selectedMode, config, reset } = booking

  if (!result) return null

  const hasEmail = clientInfo.email.trim().length > 0
  const startDate = new Date(result.start)

  // Google Calendar add link
  const calStart = startDate.toISOString().replace(/[-:]/g, '').replace('.000', '')
  const calEnd = new Date(result.end).toISOString().replace(/[-:]/g, '').replace('.000', '')
  const calTitle = encodeURIComponent(`${result.meeting_type} with ${result.agent_name}`)
  const calLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}/${calEnd}&details=${encodeURIComponent('Booked via Retirement Protectors')}`

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Success icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(34,197,94,0.12)', color: '#22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', fontSize: 36,
      }}>
        <span className="material-icons-outlined" style={{ fontSize: 36 }}>check_circle</span>
      </div>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
        You&apos;re All Set!
      </h2>

      {hasEmail ? (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 24 }}>
          A calendar invitation has been sent to <strong style={{ color: '#e2e8f0' }}>{clientInfo.email}</strong>.
        </p>
      ) : (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 24 }}>
          We&apos;ll call you at <strong style={{ color: '#e2e8f0' }}>{clientInfo.phone}</strong> to confirm your appointment.
        </p>
      )}

      {/* Booking details card */}
      <div style={{
        background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
        padding: 24, textAlign: 'left', marginBottom: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>With</div>
            <div style={{ fontSize: '0.9rem' }}>{result.agent_name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Meeting</div>
            <div style={{ fontSize: '0.9rem' }}>{result.meeting_type}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date</div>
            <div style={{ fontSize: '0.9rem' }}>
              {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Time</div>
            <div style={{ fontSize: '0.9rem' }}>
              {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' '}({selectedType?.duration_minutes} min)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Mode</div>
            <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons-outlined" style={{ fontSize: 16, color: '#4a7ab5' }}>
                {selectedMode === 'meet' ? 'videocam' : selectedMode === 'call' ? 'phone' : 'person'}
              </span>
              {selectedMode === 'meet' ? 'Video Call' : selectedMode === 'call' ? 'Phone Call' : selectedMode}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Timezone</div>
            <div style={{ fontSize: '0.9rem' }}>{config.availability.timezone}</div>
          </div>
        </div>
      </div>

      {/* Calendar link (only with email) */}
      {hasEmail && (
        <a
          href={calLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 8, border: '1px solid #1e293b',
            background: '#111827', color: '#4a7ab5', fontWeight: 600,
            fontSize: '0.88rem', textDecoration: 'none', marginBottom: 16,
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>calendar_today</span>
          Add to Google Calendar
        </a>
      )}

      {/* Book another */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={reset}
          style={{
            background: 'none', border: 'none', color: '#94a3b8',
            fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 8,
          }}
        >
          Book another meeting
        </button>
      </div>
    </div>
  )
}
