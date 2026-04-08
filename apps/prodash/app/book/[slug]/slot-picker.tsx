'use client'

import type { TimeSlot } from './use-booking'

interface SlotPickerProps {
  slots: TimeSlot[]
  selectedSlot: TimeSlot | null
  onSelectSlot: (slot: TimeSlot) => void
  loading?: boolean
}

export function SlotPicker({ slots, selectedSlot, onSelectSlot, loading }: SlotPickerProps) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '0.85rem' }}>
        Loading available times...
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '0.85rem' }}>
        No available times on this day. Please select another date.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {slots.map((slot) => {
        const isSelected = selectedSlot?.start.getTime() === slot.start.getTime()
        return (
          <button
            key={slot.start.toISOString()}
            onClick={() => onSelectSlot(slot)}
            style={{
              padding: '10px 16px',
              minHeight: 44,
              borderRadius: 8,
              border: isSelected ? '2px solid #4a7ab5' : '1px solid #1e293b',
              background: isSelected ? 'rgba(74,122,181,0.15)' : '#111827',
              color: isSelected ? '#4a7ab5' : '#e2e8f0',
              fontWeight: isSelected ? 600 : 400,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}
