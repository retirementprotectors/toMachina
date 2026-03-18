'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import type { ScheduleSlot, WeekSchedule } from './types'

// ============================================================================
// ScheduleView — Weekly grid (Mon-Fri) with office/field day distinction
// ============================================================================

interface ScheduleViewProps {
  specialistId: string
  portal: string
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
}

// Tier colors for field slots
const TIER_SLOT_STYLES: Record<string, { bg: string; border: string }> = {
  I:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  II:  { bg: 'bg-sky-500/10',     border: 'border-sky-500/30' },
  III: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
  IV:  { bg: 'bg-red-500/10',     border: 'border-red-500/30' },
}

/** Get the ISO week number and year for a given date */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNo }
}

/** Format week as YYYY-WNN */
function formatWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Get a human-readable label for the week */
function getWeekLabel(year: number, week: number): string {
  // Find Monday of this ISO week
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const monday = new Date(jan4.getTime())
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7)
  const friday = new Date(monday.getTime())
  friday.setUTCDate(monday.getUTCDate() + 4)

  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return `${fmt(monday)} – ${fmt(friday)}, ${year}`
}

export default function ScheduleView({ specialistId }: ScheduleViewProps) {
  const now = useMemo(() => new Date(), [])
  const currentWeek = useMemo(() => getISOWeek(now), [now])

  const [year, setYear] = useState(currentWeek.year)
  const [week, setWeek] = useState(currentWeek.week)
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch schedule for current week
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const weekKey = formatWeekKey(year, week)
        const res = await fetchWithAuth(`/api/prozone/schedule/${specialistId}/${weekKey}`)
        interface ApiDay { date: string; day: string; type: string; slots: Array<{ time: string; duration_minutes: number; tier?: string; zones?: string[]; status: string; departure_time?: string; return_time?: string }> }
        const json = await res.json() as { success: boolean; data?: { schedule: ApiDay[]; week: string; week_start: string; week_end: string }; error?: string }
        if (!cancelled) {
          if (json.success && json.data?.schedule) {
            // Transform API day-grouped response into WeekSchedule
            const dayAbbrev: Record<string, ScheduleSlot['day']> = { Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri' }
            const flatSlots: ScheduleSlot[] = json.data.schedule.flatMap((dayObj) =>
              (dayObj.slots || []).map((s, idx) => ({
                slot_id: `${dayObj.date}-${idx}`,
                day: dayAbbrev[dayObj.day] || 'mon' as ScheduleSlot['day'],
                start_time: s.time,
                end_time: '',
                duration_minutes: s.duration_minutes,
                slot_type: dayObj.type as 'office' | 'field',
                zone_id: s.zones?.[0],
                zone_name: s.tier ? `Tier ${s.tier}` : undefined,
                tier: s.tier as ScheduleSlot['tier'],
                status: s.status as ScheduleSlot['status'],
              }))
            )
            setSchedule({ week_label: getWeekLabel(year, week), year, week_number: week, slots: flatSlots })
          } else {
            setSchedule({ week_label: getWeekLabel(year, week), year, week_number: week, slots: [] })
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load schedule')
          setSchedule(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [specialistId, year, week])

  const navigateWeek = useCallback((direction: -1 | 1) => {
    let newWeek = week + direction
    let newYear = year
    if (newWeek < 1) {
      newYear -= 1
      newWeek = 52
    } else if (newWeek > 52) {
      newYear += 1
      newWeek = 1
    }
    setYear(newYear)
    setWeek(newWeek)
  }, [week, year])

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const grouped: Record<string, ScheduleSlot[]> = {}
    for (const day of DAYS) {
      grouped[day] = []
    }
    if (schedule?.slots) {
      for (const slot of schedule.slots) {
        if (grouped[slot.day]) {
          grouped[slot.day].push(slot)
        }
      }
      // Sort each day by start_time
      for (const day of DAYS) {
        grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
      }
    }
    return grouped
  }, [schedule])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading schedule...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
        <button
          onClick={() => navigateWeek(-1)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
          Prev
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Week {week}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{getWeekLabel(year, week)}</p>
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          Next
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-5 gap-3">
        {DAYS.map((day) => {
          const daySlots = slotsByDay[day]
          const hasFieldSlots = daySlots.some((s) => s.slot_type === 'field')
          const hasOfficeSlots = daySlots.some((s) => s.slot_type === 'office')

          return (
            <div
              key={day}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden"
            >
              {/* Day Header */}
              <div
                className="border-b border-[var(--border-subtle)] px-3 py-2.5 text-center"
                style={
                  hasOfficeSlots && !hasFieldSlots
                    ? { backgroundColor: 'color-mix(in srgb, var(--portal) 8%, transparent)' }
                    : undefined
                }
              >
                <p className="text-xs font-semibold text-[var(--text-primary)]">{DAY_LABELS[day]}</p>
                {daySlots.length > 0 && (
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {hasOfficeSlots && !hasFieldSlots && 'Office'}
                    {hasFieldSlots && !hasOfficeSlots && 'Field'}
                    {hasFieldSlots && hasOfficeSlots && 'Mixed'}
                  </p>
                )}
              </div>

              {/* Slots */}
              <div className="space-y-1.5 p-2">
                {daySlots.length === 0 ? (
                  <div className="py-6 text-center">
                    <span className="text-[10px] text-[var(--text-muted)]">No slots</span>
                  </div>
                ) : (
                  daySlots.map((slot) => {
                    const isField = slot.slot_type === 'field'
                    const tierStyle = isField && slot.tier
                      ? TIER_SLOT_STYLES[slot.tier] || TIER_SLOT_STYLES.IV
                      : null

                    return (
                      <div
                        key={slot.slot_id}
                        className={`rounded-lg border p-2 transition-colors hover:shadow-sm ${
                          tierStyle
                            ? `${tierStyle.bg} ${tierStyle.border}`
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                        }`}
                      >
                        <p className="text-[11px] font-medium text-[var(--text-primary)]">
                          {slot.start_time} – {slot.end_time}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          {slot.duration_minutes}min
                          {isField && slot.tier && ` · Tier ${slot.tier}`}
                        </p>
                        {isField && slot.zone_name && (
                          <p className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)]">
                            {slot.zone_name}
                          </p>
                        )}
                        {/* Status badge */}
                        <div className="mt-1">
                          {slot.status === 'completed' && (
                            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                              Done
                            </span>
                          )}
                          {slot.status === 'cancelled' && (
                            <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
                              Cancelled
                            </span>
                          )}
                          {slot.status === 'scheduled' && (
                            <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-400">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
