/**
 * Campaign Calendar Engine (MUS-D13)
 *
 * Proactive 90-day content calendar.
 * AEP blackout enforced (Oct–Dec) — no override.
 * Seasonal cadences: T65, birthday, annual review, always-on.
 *
 * Server-only for T65/annual review queries (Firestore).
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoCampaignCalendar, CmoCalendarEntry } from '../types'

const CALENDAR_WINDOW_DAYS = 90

/** AEP blackout: Oct 1 – Dec 31, no exceptions */
function isInAepBlackout(date: Date): boolean {
  const month = date.getMonth() // 0-indexed: 9=Oct, 10=Nov, 11=Dec
  return month >= 9 && month <= 11
}

/** Generate a unique entry ID */
function entryId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}`
}

/**
 * Generate always-on campaign entries: one per channel per 30-day window.
 * Medicare, FIA nurture, MYGA nurture.
 */
function generateAlwaysOnEntries(
  windowStart: Date,
  windowEnd: Date,
): CmoCalendarEntry[] {
  const entries: CmoCalendarEntry[] = []
  const alwaysOnCampaigns = [
    { name: 'Medicare Nurture', market: 'b2c' as const, artisan: 'digital' as const },
    { name: 'FIA Nurture', market: 'b2c' as const, artisan: 'digital' as const },
    { name: 'MYGA Nurture', market: 'b2c' as const, artisan: 'digital' as const },
  ]

  let idx = 0
  for (const campaign of alwaysOnCampaigns) {
    // One entry per 30-day chunk in the window
    const chunkStart = new Date(windowStart)
    while (chunkStart < windowEnd) {
      const scheduledDate = new Date(chunkStart)

      entries.push({
        entryId: entryId('always-on', idx++),
        name: campaign.name,
        type: 'always-on',
        scheduledDate,
        market: campaign.market,
        artisan: campaign.artisan,
        priority: 'medium',
        status: 'planned',
      })

      chunkStart.setDate(chunkStart.getDate() + 30)
    }
  }

  return entries
}

/**
 * Generate AEP-specific campaign entries during blackout window.
 */
function generateAepEntries(
  windowStart: Date,
  windowEnd: Date,
): CmoCalendarEntry[] {
  const entries: CmoCalendarEntry[] = []
  let idx = 0

  // AEP campaigns run weekly during Oct–Dec
  const current = new Date(windowStart)
  while (current < windowEnd) {
    if (isInAepBlackout(current)) {
      entries.push({
        entryId: entryId('aep', idx++),
        name: 'AEP Campaign',
        type: 'aep',
        scheduledDate: new Date(current),
        market: 'b2c',
        artisan: 'digital',
        priority: 'high',
        status: 'planned',
      })
    }
    current.setDate(current.getDate() + 7)
  }

  return entries
}

/**
 * Generate seasonal entries: birthday touches, product launches.
 */
function generateSeasonalEntries(
  windowStart: Date,
  windowEnd: Date,
): CmoCalendarEntry[] {
  const entries: CmoCalendarEntry[] = []
  let idx = 0

  // Monthly seasonal touchpoints
  const current = new Date(windowStart)
  while (current < windowEnd) {
    entries.push({
      entryId: entryId('seasonal', idx++),
      name: 'Monthly Client Touch',
      type: 'seasonal',
      scheduledDate: new Date(current),
      market: 'b2c',
      artisan: 'social',
      priority: 'low',
      status: 'planned',
    })
    current.setDate(current.getDate() + 30)
  }

  return entries
}

/**
 * Apply AEP blackout enforcement.
 * All non-AEP entries in Oct–Dec → status 'blocked', reason 'AEP_BLACKOUT'.
 * No override parameter. No exceptions.
 */
function enforceAepBlackout(entries: CmoCalendarEntry[]): CmoCalendarEntry[] {
  return entries.map((entry) => {
    if (entry.type !== 'aep' && isInAepBlackout(entry.scheduledDate)) {
      return {
        ...entry,
        status: 'blocked' as const,
        blockedReason: 'AEP_BLACKOUT',
      }
    }
    return entry
  })
}

/**
 * Generate the 90-day campaign calendar.
 *
 * T65 and annual review entries require Firestore access — those are
 * populated by the API route layer that calls this function.
 * This function generates the framework entries that don't need Firestore.
 *
 * Client identifiers and birth dates NEVER appear in calendar entries.
 */
export async function generateCampaignCalendar(
  fromDate: Date,
  options?: {
    t65Count?: number
    annualReviewCount?: number
  },
): Promise<CmoCampaignCalendar> {
  const windowStart = new Date(fromDate)
  const windowEnd = new Date(fromDate)
  windowEnd.setDate(windowEnd.getDate() + CALENDAR_WINDOW_DAYS)

  const aepBlackoutActive = isInAepBlackout(windowStart) || isInAepBlackout(windowEnd)

  let entries: CmoCalendarEntry[] = []

  // Always-on campaigns
  entries.push(...generateAlwaysOnEntries(windowStart, windowEnd))

  // AEP campaigns (during blackout only)
  entries.push(...generateAepEntries(windowStart, windowEnd))

  // Seasonal
  entries.push(...generateSeasonalEntries(windowStart, windowEnd))

  // T65 entries — count only, no client data in entries
  if (options?.t65Count && options.t65Count > 0) {
    let idx = 0
    // Spread T65 entries evenly across the window
    const interval = Math.max(1, Math.floor(CALENDAR_WINDOW_DAYS / options.t65Count))
    for (let i = 0; i < options.t65Count; i++) {
      const scheduledDate = new Date(windowStart)
      scheduledDate.setDate(scheduledDate.getDate() + i * interval)
      if (scheduledDate > windowEnd) break

      entries.push({
        entryId: entryId('t65', idx++),
        name: 'T65 Outreach',
        type: 't65',
        scheduledDate,
        market: 'b2c',
        artisan: 'digital',
        priority: 'high',
        status: 'planned',
      })
    }
  }

  // Annual review entries — count only, no client data
  if (options?.annualReviewCount && options.annualReviewCount > 0) {
    let idx = 0
    const interval = Math.max(1, Math.floor(CALENDAR_WINDOW_DAYS / options.annualReviewCount))
    for (let i = 0; i < options.annualReviewCount; i++) {
      const scheduledDate = new Date(windowStart)
      scheduledDate.setDate(scheduledDate.getDate() + i * interval)
      if (scheduledDate > windowEnd) break

      entries.push({
        entryId: entryId('annual-review', idx++),
        name: 'Annual Review Campaign',
        type: 'annual-review',
        scheduledDate,
        market: 'b2c',
        artisan: 'digital',
        priority: 'medium',
        status: 'planned',
      })
    }
  }

  // Enforce AEP blackout — non-negotiable
  entries = enforceAepBlackout(entries)

  // Sort by scheduledDate ascending
  entries.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())

  return {
    generatedAt: new Date(),
    windowStart,
    windowEnd,
    entries,
    aepBlackoutActive,
  }
}
