'use client'

import { useEffect, useMemo } from 'react'
import type { BookingHook } from '../use-booking'
import { computeSlots } from '../use-booking'
import { Calendar } from '../calendar'
import { SlotPicker } from '../slot-picker'

const MODE_LABELS: Record<string, { icon: string; label: string }> = {
  meet: { icon: 'videocam', label: 'Video Call' },
  call: { icon: 'phone', label: 'Phone Call' },
  office: { icon: 'business', label: 'In-Office' },
  home: { icon: 'home', label: 'At Your Home' },
  'in-person': { icon: 'person', label: 'In Person' },
}

export function StepDatetime({ booking }: { booking: BookingHook }) {
  const {
    config, selectedType, selectedDate, selectedSlot, busyPeriods, loadingBusy,
    setSelectedDate, selectSlot, selectMode, goBack, fetchBusy,
  } = booking

  const now = new Date()
  const calYear = selectedDate?.getFullYear() ?? now.getFullYear()
  const calMonth = selectedDate?.getMonth() ?? now.getMonth()

  // Fetch busy data when month changes
  useEffect(() => {
    fetchBusy(calYear, calMonth + 1) // API uses 1-indexed months
  }, [calYear, calMonth, fetchBusy])

  // Compute business days from availability config
  const businessDays = useMemo(() => {
    const days = new Set<number>()
    for (const [dow] of Object.entries(config.availability.business_hours)) {
      days.add(Number(dow))
    }
    return days
  }, [config.availability.business_hours])

  // Compute available slots for selected date
  const slots = useMemo(() => {
    if (!selectedDate || !selectedType) return []
    return computeSlots(selectedDate, config.availability, selectedType.duration_minutes, busyPeriods)
  }, [selectedDate, selectedType, config.availability, busyPeriods])

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
            display: 'flex', alignItems: 'center', padding: 4,
          }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        </button>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Select Date & Time</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
            {selectedType?.name} — {selectedType?.duration_minutes} min
            {config.availability.timezone && ` (${config.availability.timezone})`}
          </p>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <Calendar
          year={calYear}
          month={calMonth}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); booking.selectSlot(null as unknown as never) }}
          onMonthChange={(y, m) => setSelectedDate(new Date(y, m, 1))}
          maxAdvanceDays={config.availability.max_advance_days || 90}
          businessDays={businessDays}
        />
      </div>

      {/* Slots */}
      {selectedDate && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <SlotPicker
            slots={slots}
            selectedSlot={selectedSlot}
            onSelectSlot={selectSlot}
            loading={loadingBusy}
          />
        </div>
      )}

      {/* Mode selector */}
      {selectedSlot && selectedType && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>
            How would you like to meet?
          </h3>
          <div style={{ display: 'flex', gap: 10 }}>
            {(selectedType.modes || ['meet', 'call']).map(mode => {
              const info = MODE_LABELS[mode] || { icon: 'event', label: mode }
              return (
                <button
                  key={mode}
                  onClick={() => selectMode(mode)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '14px 16px',
                    minHeight: 44,
                    borderRadius: 8,
                    border: '1px solid #1e293b',
                    background: 'rgba(74,122,181,0.06)',
                    color: '#e2e8f0',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = '#4a7ab5'
                    e.currentTarget.style.background = 'rgba(74,122,181,0.15)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = '#1e293b'
                    e.currentTarget.style.background = 'rgba(74,122,181,0.06)'
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: 20 }}>{info.icon}</span>
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
