'use client'

import type { BookingHook } from '../use-booking'

const MODE_ICONS: Record<string, string> = {
  meet: 'videocam',
  call: 'phone',
  'in-person': 'person',
}

export function StepType({ booking }: { booking: BookingHook }) {
  const { config, selectType } = booking
  const agent = config.agent

  return (
    <div>
      {/* Agent header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt={agent.display_name}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 12px',
              display: 'block',
              border: '3px solid #1e293b',
            }}
          />
        ) : (
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(74,122,181,0.15)',
            color: '#4a7ab5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0 auto 12px',
            border: '3px solid #1e293b',
          }}>
            {(agent.first_name?.[0] || agent.display_name[0]).toUpperCase()}
          </div>
        )}
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 2 }}>
          {config.isTeam ? agent.display_name : agent.display_name}
        </h1>
        {agent.job_title && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>{agent.job_title}</p>
        )}
      </div>

      {/* Booking type cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {config.bookingTypes.map((type) => (
          <button
            key={type.name}
            onClick={() => selectType(type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#111827',
              border: '1px solid #1e293b',
              borderRadius: 12,
              padding: '16px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              color: '#e2e8f0',
              transition: 'all 0.2s ease',
              minHeight: 44,
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = '#4a7ab5'
              e.currentTarget.style.background = 'rgba(74,122,181,0.06)'
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = '#1e293b'
              e.currentTarget.style.background = '#111827'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{type.name}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                {type.duration_minutes} minutes
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {type.modes.map(mode => (
                <span
                  key={mode}
                  className="material-icons-outlined"
                  style={{ fontSize: 20, color: '#64748b' }}
                  title={mode === 'meet' ? 'Video Call' : mode === 'call' ? 'Phone Call' : mode}
                >
                  {MODE_ICONS[mode] || 'event'}
                </span>
              ))}
              <span className="material-icons-outlined" style={{ fontSize: 20, color: '#4a7ab5', marginLeft: 4 }}>
                chevron_right
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
