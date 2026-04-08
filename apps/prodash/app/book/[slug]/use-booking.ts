'use client'

import { useState, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingAgentInfo {
  email: string
  all_emails?: string[]
  first_name?: string
  last_name?: string
  display_name: string
  job_title?: string
  slug: string
  photo_url?: string | null
  office_address?: string
}

export interface BookingType {
  name: string
  duration_minutes: number
  category: string
  modes: string[]
  auto_confirm: boolean
}

export interface BookingAvailability {
  timezone: string
  business_hours: Record<number, { start: string; end: string }>
  buffer_minutes: number
  max_advance_days: number
  slot_increment_minutes: number
}

export interface BookingConfigData {
  agent: BookingAgentInfo
  bookingTypes: BookingType[]
  availability: BookingAvailability
  isTeam: boolean
}

export interface TimeSlot {
  start: Date
  end: Date
  label: string
}

export interface BookingResult {
  booking_id: string
  agent_name: string
  meeting_type: string
  start: string
  end: string
  mode: string
  status: string
}

export interface ClientInfo {
  name: string
  phone: string
  email: string
  guests: string
  reason: string
}

export type WizardStep = 'type' | 'datetime' | 'contact' | 'confirm'

interface BusyPeriod { start: string; end: string }

// ─── Slot Computation ─────────────────────────────────────────────────────────

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return { hour: h, minute: m || 0 }
}

function periodsOverlap(
  slotStart: Date, slotEnd: Date,
  busyStart: Date, busyEnd: Date,
  bufferMs: number
): boolean {
  const bStart = new Date(busyStart.getTime() - bufferMs)
  const bEnd = new Date(busyEnd.getTime() + bufferMs)
  return slotStart < bEnd && slotEnd > bStart
}

export function computeSlots(
  date: Date,
  availability: BookingAvailability,
  durationMinutes: number,
  busyPeriods: BusyPeriod[]
): TimeSlot[] {
  const dayOfWeek = date.getDay()
  const hours = availability.business_hours[dayOfWeek]
  if (!hours) return []

  const start = parseTime(hours.start)
  const end = parseTime(hours.end)
  const increment = availability.slot_increment_minutes || 30
  const buffer = availability.buffer_minutes || 0
  const bufferMs = buffer * 60 * 1000

  const slots: TimeSlot[] = []
  const now = new Date()
  const minLeadMs = 30 * 60 * 1000

  const busyDates = busyPeriods.map(b => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }))

  let slotStart = new Date(date)
  slotStart.setHours(start.hour, start.minute, 0, 0)

  const dayEnd = new Date(date)
  dayEnd.setHours(end.hour, end.minute, 0, 0)

  while (slotStart < dayEnd) {
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000)
    if (slotEnd > dayEnd) break

    // Skip if too soon (today only)
    const isToday = date.toDateString() === now.toDateString()
    if (isToday && slotStart.getTime() < now.getTime() + minLeadMs) {
      slotStart = new Date(slotStart.getTime() + increment * 60 * 1000)
      continue
    }

    // Skip if overlaps with busy period
    const isBusy = busyDates.some(b => periodsOverlap(slotStart, slotEnd, b.start, b.end, bufferMs))
    if (!isBusy) {
      const label = slotStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      slots.push({ start: new Date(slotStart), end: new Date(slotEnd), label })
    }

    slotStart = new Date(slotStart.getTime() + increment * 60 * 1000)
  }

  return slots
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBooking(config: BookingConfigData) {
  const [step, setStep] = useState<WizardStep>('type')
  const [selectedType, setSelectedType] = useState<BookingType | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [selectedMode, setSelectedMode] = useState<string>('')
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ name: '', phone: '', email: '', guests: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BookingResult | null>(null)

  // Cache busy data per month
  const busyCache = useRef<Map<string, BusyPeriod[]>>(new Map())
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([])
  const [loadingBusy, setLoadingBusy] = useState(false)

  const fetchBusy = useCallback(async (year: number, month: number) => {
    const key = `${year}_${month}`
    if (busyCache.current.has(key)) {
      setBusyPeriods(busyCache.current.get(key)!)
      return
    }

    setLoadingBusy(true)
    try {
      const email = config.agent.email
      const res = await fetch(`/api/booking/busy?email=${encodeURIComponent(email)}&year=${year}&month=${month}`)
      if (res.ok) {
        const json = await res.json()
        const periods = json.data?.busy || []
        busyCache.current.set(key, periods)
        setBusyPeriods(periods)
      }
    } catch { /* silent — slots will show as fully available */ }
    setLoadingBusy(false)
  }, [config.agent.email])

  const selectType = useCallback((type: BookingType) => {
    setSelectedType(type)
    setStep('datetime')
    setError('')
  }, [])

  const selectSlot = useCallback((slot: TimeSlot) => {
    setSelectedSlot(slot)
  }, [])

  const selectMode = useCallback((mode: string) => {
    setSelectedMode(mode)
    setStep('contact')
    setError('')
  }, [])

  const goBack = useCallback(() => {
    setError('')
    if (step === 'datetime') {
      setStep('type')
      setSelectedSlot(null)
      setSelectedMode('')
    } else if (step === 'contact') {
      setStep('datetime')
    }
  }, [step])

  const submit = useCallback(async () => {
    if (!selectedType || !selectedSlot || !selectedMode) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: config.agent.email,
          agentName: config.agent.display_name,
          agentSlug: config.agent.slug,
          slot: {
            start: selectedSlot.start.toISOString(),
            end: selectedSlot.end.toISOString(),
          },
          meetingType: selectedType.name,
          mode: selectedMode,
          client: clientInfo,
          allEmails: config.agent.all_emails || [config.agent.email],
        }),
      })

      const json = await res.json()
      if (json.success) {
        setResult(json.data)
        setStep('confirm')
      } else {
        setError(json.error || 'Failed to create booking')
      }
    } catch {
      setError('Connection error — please try again')
    }
    setSubmitting(false)
  }, [config, selectedType, selectedSlot, selectedMode, clientInfo])

  const reset = useCallback(() => {
    setStep('type')
    setSelectedType(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSelectedMode('')
    setClientInfo({ name: '', phone: '', email: '', guests: '', reason: '' })
    setResult(null)
    setError('')
  }, [])

  return {
    step, selectedType, selectedDate, selectedSlot, selectedMode,
    clientInfo, submitting, error, result, busyPeriods, loadingBusy,
    setSelectedDate, setClientInfo, setError,
    selectType, selectSlot, selectMode, goBack, submit, reset, fetchBusy,
    config,
  }
}

export type BookingHook = ReturnType<typeof useBooking>
