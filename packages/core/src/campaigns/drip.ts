// Drip Sequence Engine — multi-touch campaign orchestration
// Pure functions — no Firestore dependency

import type { DeliveryEvent } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DripSequence {
  drip_id: string
  campaign_id: string
  sequence_name: string
  description?: string
  steps: DripStep[]
  fallback_channel: 'email' | 'sms'
  max_steps?: number
  status: 'active' | 'paused' | 'archived'
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface DripStep {
  step_index: number
  delay_days: number
  channel: 'email' | 'sms'
  template_id: string
  conditions: DripCondition[]
}

export interface DripCondition {
  type: 'responded' | 'opened' | 'clicked' | 'opted_out'
  action: 'skip' | 'stop' | 'switch_channel'
}

export interface DripEnrollment {
  enrollment_id: string
  drip_sequence_id: string
  campaign_id: string
  contact_id: string
  current_step: number
  next_send_at: string
  status: 'active' | 'completed' | 'stopped' | 'paused'
  started_at: string
  last_send_at?: string
  updated_at: string
}

export interface DripScheduleEntry {
  step_index: number
  scheduled_for: string
}

export type StepEvaluation = 'send' | 'skip' | 'stop' | 'switch_channel'

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a drip step should send, skip, stop, or switch channel.
 * Checks the step's conditions against delivery events for this enrollment.
 */
export function evaluateStep(
  enrollment: DripEnrollment,
  step: DripStep,
  deliveryEvents: DeliveryEvent[]
): StepEvaluation {
  // Filter events for this enrollment's contact + campaign
  const contactEvents = deliveryEvents.filter(
    (e) => e.recipient_id === enrollment.contact_id && e.campaign_id === enrollment.campaign_id
  )

  // Check each condition — first matching condition wins
  for (const condition of step.conditions) {
    const matched = checkCondition(condition, contactEvents)
    if (matched) {
      return condition.action
    }
  }

  // No conditions matched — proceed with send
  return 'send'
}

/**
 * Get the next step in a drip sequence after the current index.
 * Returns null if no more steps remain.
 */
export function getNextStep(
  sequence: DripSequence,
  currentIndex: number,
  events: DeliveryEvent[]
): DripStep | null {
  const nextIndex = currentIndex + 1

  if (nextIndex >= sequence.steps.length) return null

  // Respect max_steps if set
  if (sequence.max_steps && nextIndex >= sequence.max_steps) return null

  const step = sequence.steps.find((s) => s.step_index === nextIndex)
  return step || null
}

/**
 * Determine if an enrollment should advance to the next step.
 * Checks if sufficient time has elapsed since the last send.
 */
export function shouldAdvance(
  enrollment: DripEnrollment,
  stepEvents: DeliveryEvent[]
): boolean {
  // Must be active
  if (enrollment.status !== 'active') return false

  // Check if next_send_at has passed
  if (!enrollment.next_send_at) return false

  const nextSendTime = new Date(enrollment.next_send_at).getTime()
  const now = Date.now()

  return now >= nextSendTime
}

/**
 * Build a complete drip schedule from a sequence starting at a given date.
 * Returns an array of step indices with their scheduled send times.
 */
export function buildDripSchedule(
  sequence: DripSequence,
  startDate: Date | string
): DripScheduleEntry[] {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  if (isNaN(start.getTime())) return []

  const sortedSteps = [...sequence.steps].sort((a, b) => a.step_index - b.step_index)
  const maxSteps = sequence.max_steps || sortedSteps.length

  return sortedSteps.slice(0, maxSteps).map((step) => {
    const sendDate = new Date(start.getTime() + step.delay_days * 86400000)
    return {
      step_index: step.step_index,
      scheduled_for: sendDate.toISOString(),
    }
  })
}

/**
 * Resolve the channel for a step, applying fallback if the primary channel bounced.
 */
export function resolveChannel(
  step: DripStep,
  fallbackChannel: 'email' | 'sms',
  deliveryEvents: DeliveryEvent[]
): 'email' | 'sms' {
  // Check if the primary channel bounced in previous sends
  const bounced = deliveryEvents.some(
    (e) => e.channel === step.channel && (e.event_type === 'bounced' || e.event_type === 'failed')
  )

  if (bounced && fallbackChannel !== step.channel) {
    return fallbackChannel
  }

  return step.channel
}

/**
 * Calculate drip progress for a sequence — per-step completion rates.
 */
export function calculateDripProgress(
  sequence: DripSequence,
  enrollments: DripEnrollment[],
  deliveryEvents: DeliveryEvent[]
): {
  step_index: number
  channel: string
  template_id: string
  delay_days: number
  total_enrolled: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_bounced: number
  completion_rate: number
}[] {
  const totalEnrolled = enrollments.filter((e) => e.status === 'active' || e.status === 'completed').length
  const safeTotal = Math.max(totalEnrolled, 1)

  return sequence.steps.map((step) => {
    // Find events for this step by matching template_id in metadata or step context
    const stepEvents = deliveryEvents.filter((e) => {
      const meta = e.metadata as Record<string, unknown> | undefined
      return meta && meta.step_index === step.step_index && meta.drip_id === sequence.drip_id
    })

    const sent = stepEvents.filter((e) => e.event_type === 'sent').length
    const delivered = stepEvents.filter((e) => e.event_type === 'delivered').length
    const opened = stepEvents.filter((e) => e.event_type === 'opened').length
    const clicked = stepEvents.filter((e) => e.event_type === 'clicked').length
    const bounced = stepEvents.filter((e) => e.event_type === 'bounced').length

    // Completion = enrollments that reached or passed this step
    const completedThisStep = enrollments.filter(
      (e) => e.current_step > step.step_index || e.status === 'completed'
    ).length

    return {
      step_index: step.step_index,
      channel: step.channel,
      template_id: step.template_id,
      delay_days: step.delay_days,
      total_enrolled: totalEnrolled,
      total_sent: sent,
      total_delivered: delivered,
      total_opened: opened,
      total_clicked: clicked,
      total_bounced: bounced,
      completion_rate: Math.round((completedThisStep / safeTotal) * 10000) / 100,
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkCondition(
  condition: DripCondition,
  events: DeliveryEvent[]
): boolean {
  switch (condition.type) {
    case 'responded':
      // "Responded" = they clicked or replied (clicked is the closest proxy)
      return events.some((e) => e.event_type === 'clicked')

    case 'opened':
      return events.some((e) => e.event_type === 'opened')

    case 'clicked':
      return events.some((e) => e.event_type === 'clicked')

    case 'opted_out':
      return events.some((e) => e.event_type === 'unsubscribed')

    default:
      return false
  }
}
