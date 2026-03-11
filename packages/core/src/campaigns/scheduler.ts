// Campaign Scheduler — scheduling, send windows, AEP blackout

import { AEP_BLACKOUT, type CampaignType } from './types'

/**
 * Check if a date falls within AEP blackout period.
 * Medicare campaigns CANNOT send Oct 1 - Dec 7.
 */
export function isBlackoutPeriod(date: Date | string, campaignType: string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return false

  const type = campaignType.toUpperCase()
  if (!AEP_BLACKOUT.affected_types.some((t) => type.includes(t))) return false

  const month = d.getMonth() + 1 // 1-indexed
  const day = d.getDate()

  // Oct 1 through Dec 7
  if (month === AEP_BLACKOUT.start_month && day >= AEP_BLACKOUT.start_day) return true
  if (month === 11) return true // November — fully blocked
  if (month === AEP_BLACKOUT.end_month && day <= AEP_BLACKOUT.end_day) return true

  return false
}

/**
 * Get the next valid send window, skipping blackout if needed.
 * Returns the original date if not in blackout, or Dec 8 if in blackout.
 */
export function getNextSendWindow(date: Date | string, campaignType: string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime())

  if (!isBlackoutPeriod(d, campaignType)) return d

  // Move to Dec 8 of the same year
  const year = d.getFullYear()
  return new Date(year, 11, 8, 9, 0, 0) // Dec 8, 9am
}

/**
 * Create a schedule configuration.
 */
export function createSchedule(params: {
  campaign_id: string
  send_date: string
  send_time: string // HH:MM
  timezone: string
  campaign_type: string
}): { scheduled_for: string; blackout_warning: boolean } {
  const { campaign_id, send_date, send_time, timezone, campaign_type } = params

  // Build ISO datetime (timezone-aware scheduling done server-side)
  const scheduledFor = `${send_date}T${send_time}:00`
  const scheduledDate = new Date(scheduledFor)

  const blackoutWarning = isBlackoutPeriod(scheduledDate, campaign_type)

  return {
    scheduled_for: scheduledDate.toISOString(),
    blackout_warning: blackoutWarning,
  }
}

/**
 * Validate a send schedule.
 * Returns null if valid, error message if not.
 */
export function validateSchedule(
  scheduledFor: string,
  campaignType: string
): string | null {
  const date = new Date(scheduledFor)
  if (isNaN(date.getTime())) return 'Invalid date format'

  if (date.getTime() < Date.now() - 60000) return 'Scheduled time is in the past'

  if (isBlackoutPeriod(date, campaignType)) {
    return `Medicare campaigns cannot be sent during AEP blackout (Oct 1 - Dec 7). Next available window: Dec 8.`
  }

  return null
}
