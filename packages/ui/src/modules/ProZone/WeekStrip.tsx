'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import type { ScheduleDay } from './types'

// ============================================================================
// WeekStrip — Compact week navigator + daily summary strip
// ============================================================================

const TIER_STYLES: Record<string, { bg: string; text: string }> = {
  I:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  II:  { bg: 'bg-sky-500/10',     text: 'text-sky-400' },
  III: { bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  IV:  { bg: 'bg-red-500/10',     text: 'text-red-400' },
}

const DAY_LABELS: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
}

interface WeekStripProps {
  specialistId: string
  onFieldDayClick?: (tier: string) => void
  onScheduleLoaded?: (schedule: ScheduleDay[]) => void
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

/** Get dominant tier from a day's slots */
function getDominantTier(day: ScheduleDay): string {
  const tierCounts: Record<string, number> = {}
  for (const slot of day.slots) {
    if (slot.tier) {
      tierCounts[slot.tier] = (tierCounts[slot.tier] || 0) + 1
    }
  }
  let maxTier = 'I'
  let maxCount = 0
  for (const [tier, count] of Object.entries(tierCounts)) {
    if (count > maxCount) {
      maxCount = count
      maxTier = tier
    }
  }
  return maxTier
}

export default function WeekStrip({
  specialistId,
  onFieldDayClick,
  onScheduleLoaded,
}: WeekStripProps) {
  const currentWeek = useMemo(() => getISOWeek(new Date()), [])
  const [year, setYear] = useState(currentWeek.year)
  const [week, setWeek] = useState(currentWeek.week)
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch schedule on mount + when year/week/specialist change
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const weekKey = formatWeekKey(year, week)
        const res = await fetchWithAuth(`/api/prozone/schedule/${specialistId}/${weekKey}`)
        const json = await res.json() as {
          success: boolean
          data?: { schedule: ScheduleDay[] }
          error?: string
        }
        if (!cancelled) {
          const days = json.success && json.data?.schedule ? json.data.schedule : []
          setSchedule(days)
          onScheduleLoaded?.(days)
        }
      } catch {
        if (!cancelled) {
          setSchedule([])
          onScheduleLoaded?.([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [specialistId, year, week, onScheduleLoaded])

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

  // Build day cells from schedule (always show Mon-Fri)
  const weekDays = useMemo(() => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    return dayOrder.map((dayName) => {
      const dayData = schedule.find((d) => d.day === dayName)
      const abbrev = DAY_LABELS[dayName] || dayName.slice(0, 3)
      if (!dayData || dayData.type === 'off') {
        return { abbrev, type: 'off' as const, slotCount: 0, tier: '' }
      }
      const slotCount = dayData.slots.length
      const tier = dayData.type === 'field' ? getDominantTier(dayData) : ''
      return { abbrev, type: dayData.type, slotCount, tier }
    })
  }, [schedule])

  // Week range label
  const weekRange = useMemo(() => {
    const jan4 = new Date(Date.UTC(year, 0, 4))
    const dayOfWeek = jan4.getUTCDay() || 7
    const monday = new Date(jan4.getTime())
    monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7)
    const friday = new Date(monday.getTime())
    friday.setUTCDate(monday.getUTCDate() + 4)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[monday.getUTCMonth()]} ${monday.getUTCDate()}-${friday.getUTCDate()}`
  }, [year, week])

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateWeek(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
        </button>
        <div className="text-center">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Week {week}
          </span>
          <span className="mx-1.5 text-[var(--text-muted)]">&middot;</span>
          <span className="text-sm text-[var(--text-muted)]">{weekRange}</span>
        </div>
        <button
          type="button"
          onClick={() => navigateWeek(1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
        </button>
      </div>

      {/* Day Cells */}
      <div className="mt-2 flex items-center gap-1.5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            <span className="ml-2 text-xs text-[var(--text-muted)]">Loading...</span>
          </div>
        ) : (
          weekDays.map((day) => {
            if (day.type === 'off') {
              return (
                <div
                  key={day.abbrev}
                  className="flex flex-1 flex-col items-center rounded-lg px-2 py-1.5 bg-transparent opacity-50"
                >
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">{day.abbrev}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Off</span>
                </div>
              )
            }

            if (day.type === 'office') {
              return (
                <div
                  key={day.abbrev}
                  className="flex flex-1 flex-col items-center rounded-lg bg-[var(--bg-surface)] px-2 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="text-[10px] font-semibold text-[var(--text-primary)]">{day.abbrev}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Office ({day.slotCount})
                  </span>
                </div>
              )
            }

            // Field day
            const tierStyle = TIER_STYLES[day.tier] ?? TIER_STYLES.I
            return (
              <button
                key={day.abbrev}
                type="button"
                onClick={() => onFieldDayClick?.(day.tier)}
                className={`flex flex-1 flex-col items-center rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${tierStyle.bg} hover:opacity-80`}
              >
                <span className={`text-[10px] font-semibold ${tierStyle.text}`}>{day.abbrev}</span>
                <span className={`text-[10px] ${tierStyle.text}`}>
                  Field {day.tier} ({day.slotCount})
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
