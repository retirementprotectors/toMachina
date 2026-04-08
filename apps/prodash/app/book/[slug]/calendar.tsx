'use client'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarProps {
  year: number
  month: number
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  onMonthChange: (year: number, month: number) => void
  maxAdvanceDays: number
  busyDaysFull?: Set<string>
  businessDays?: Set<number>
}

export function Calendar({
  year, month, selectedDate, onSelectDate, onMonthChange,
  maxAdvanceDays, businessDays,
}: CalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const cells: Array<{ day: number; disabled: boolean; isToday: boolean; isSelected: boolean }> = []

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    cells.push({ day: 0, disabled: true, isToday: false, isSelected: false })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    date.setHours(0, 0, 0, 0)
    const isPast = date < today
    const isBeyond = date > maxDate
    const isWeekday = businessDays ? businessDays.has(date.getDay()) : (date.getDay() !== 0 && date.getDay() !== 6)
    const disabled = isPast || isBeyond || !isWeekday
    const isToday = date.getTime() === today.getTime()
    const isSelected = selectedDate ? date.toDateString() === selectedDate.toDateString() : false

    cells.push({ day: d, disabled, isToday, isSelected })
  }

  const prevMonth = () => {
    const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 }
    onMonthChange(prev.y, prev.m)
  }
  const nextMonth = () => {
    const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 }
    onMonthChange(next.y, next.m)
  }

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const canGoPrev = !(year === today.getFullYear() && month === today.getMonth())

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          style={{
            background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default',
            color: canGoPrev ? '#94a3b8' : '#334155', fontSize: 20, padding: 8,
            display: 'flex', alignItems: 'center',
          }}
        >
          <span className="material-icons-outlined">chevron_left</span>
        </button>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{monthName}</span>
        <button
          onClick={nextMonth}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', fontSize: 20, padding: 8,
            display: 'flex', alignItems: 'center',
          }}
        >
          <span className="material-icons-outlined">chevron_right</span>
        </button>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.72rem', fontWeight: 600,
            color: '#64748b', padding: '6px 0', textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((cell, i) => {
          if (cell.day === 0) return <div key={`e-${i}`} />

          return (
            <button
              key={cell.day}
              disabled={cell.disabled}
              onClick={() => onSelectDate(new Date(year, month, cell.day))}
              style={{
                minHeight: 44,
                minWidth: 44,
                border: cell.isSelected ? '2px solid #4a7ab5' : cell.isToday ? '1px solid #334155' : '1px solid transparent',
                borderRadius: 8,
                background: cell.isSelected
                  ? 'rgba(74,122,181,0.15)'
                  : cell.disabled
                    ? 'transparent'
                    : 'rgba(255,255,255,0.02)',
                color: cell.isSelected ? '#4a7ab5' : cell.disabled ? '#334155' : '#e2e8f0',
                cursor: cell.disabled ? 'default' : 'pointer',
                fontWeight: cell.isSelected || cell.isToday ? 600 : 400,
                fontSize: '0.88rem',
                transition: 'all 0.15s ease',
              }}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
