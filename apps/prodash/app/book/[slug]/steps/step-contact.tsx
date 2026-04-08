'use client'

import { useState } from 'react'
import type { BookingHook } from '../use-booking'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '16px', // prevents iOS zoom
  fontFamily: 'inherit',
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 8,
  color: '#e2e8f0',
  outline: 'none',
  transition: 'border-color 0.2s',
  minHeight: 44,
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: 6,
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#fca5a5',
  marginTop: 4,
}

export function StepContact({ booking }: { booking: BookingHook }) {
  const { clientInfo, setClientInfo, goBack, submit, submitting, selectedSlot, selectedType, selectedMode } = booking
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const update = (field: string, value: string) => {
    setClientInfo({ ...clientInfo, [field]: value })
  }

  const handleSubmit = () => {
    setTouched({ name: true, phone: true })
    if (!clientInfo.name.trim() || !clientInfo.phone.trim()) {
      booking.setError('Please fill in all required fields')
      return
    }
    booking.setError('')
    submit()
  }

  const showNameError = touched.name && !clientInfo.name.trim()
  const showPhoneError = touched.phone && !clientInfo.phone.trim()

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          onClick={goBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        </button>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Your Information</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
            {selectedType?.name} — {selectedSlot?.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {selectedSlot?.label}
            {selectedMode === 'meet' ? ' (Video)' : selectedMode === 'call' ? ' (Phone)' : ''}
          </p>
        </div>
      </div>

      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>
            Full Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={clientInfo.name}
            onChange={e => update('name', e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, name: true }))}
            placeholder="Jane Smith"
            style={{
              ...INPUT_STYLE,
              borderColor: showNameError ? '#ef4444' : '#1e293b',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#4a7ab5'}
          />
          {showNameError && <div style={ERROR_STYLE}>Name is required</div>}
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>
            Phone <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="tel"
            value={clientInfo.phone}
            onChange={e => update('phone', e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, phone: true }))}
            placeholder="(515) 555-1234"
            style={{
              ...INPUT_STYLE,
              borderColor: showPhoneError ? '#ef4444' : '#1e293b',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#4a7ab5'}
          />
          {showPhoneError && <div style={ERROR_STYLE}>Phone number is required</div>}
        </div>

        {/* Email (optional) */}
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>
            Email <span style={{ color: '#64748b', fontWeight: 400 }}>(optional — we&apos;ll call to confirm if no email)</span>
          </label>
          <input
            type="email"
            value={clientInfo.email}
            onChange={e => update('email', e.target.value)}
            placeholder="jane@example.com"
            style={INPUT_STYLE}
            onFocus={e => e.currentTarget.style.borderColor = '#4a7ab5'}
            onBlur={e => e.currentTarget.style.borderColor = '#1e293b'}
          />
        </div>

        {/* Guests (only if email provided) */}
        {clientInfo.email.trim() && (
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE}>Additional Guests</label>
            <input
              type="text"
              value={clientInfo.guests}
              onChange={e => update('guests', e.target.value)}
              placeholder="guest@example.com, other@example.com"
              style={INPUT_STYLE}
              onFocus={e => e.currentTarget.style.borderColor = '#4a7ab5'}
              onBlur={e => e.currentTarget.style.borderColor = '#1e293b'}
            />
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>What would you like to discuss?</label>
          <textarea
            value={clientInfo.reason}
            onChange={e => update('reason', e.target.value.slice(0, 500))}
            placeholder="Anything you'd like us to prepare for..."
            rows={3}
            style={{
              ...INPUT_STYLE,
              resize: 'vertical',
              minHeight: 80,
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#4a7ab5'}
            onBlur={e => e.currentTarget.style.borderColor = '#1e293b'}
          />
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#475569', marginTop: 4 }}>
            {clientInfo.reason.length}/500
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '14px 20px',
            minHeight: 44,
            borderRadius: 8,
            border: 'none',
            background: submitting ? '#334155' : '#4a7ab5',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {submitting ? (
            <>
              <span style={{
                width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Booking...
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
