// Campaign Analytics — metrics calculation

import type { CampaignMetrics, DeliveryEvent } from './types'

/**
 * Calculate campaign metrics from delivery events.
 */
export function calculateMetrics(
  campaignId: string,
  events: DeliveryEvent[]
): CampaignMetrics {
  const campaignEvents = events.filter((e) => e.campaign_id === campaignId)

  const sent = campaignEvents.filter((e) => e.event_type === 'sent').length
  const delivered = campaignEvents.filter((e) => e.event_type === 'delivered').length
  const bounced = campaignEvents.filter((e) => e.event_type === 'bounced').length
  const opened = campaignEvents.filter((e) => e.event_type === 'opened').length
  const clicked = campaignEvents.filter((e) => e.event_type === 'clicked').length

  const totalSends = Math.max(sent, 1) // avoid division by zero

  // Find the latest send timestamp
  const sendEvents = campaignEvents.filter((e) => e.event_type === 'sent')
  const lastSendAt = sendEvents.length > 0
    ? sendEvents.reduce((latest, e) => e.timestamp > latest ? e.timestamp : latest, '')
    : undefined

  return {
    campaign_id: campaignId,
    total_sends: sent,
    total_delivered: delivered,
    total_bounced: bounced,
    total_opened: opened,
    total_clicked: clicked,
    delivery_rate: sent > 0 ? Math.round((delivered / totalSends) * 10000) / 100 : 0,
    open_rate: delivered > 0 ? Math.round((opened / delivered) * 10000) / 100 : 0,
    click_rate: delivered > 0 ? Math.round((clicked / delivered) * 10000) / 100 : 0,
    bounce_rate: sent > 0 ? Math.round((bounced / totalSends) * 10000) / 100 : 0,
    last_send_at: lastSendAt,
  }
}

/**
 * Build a timeline of send activity (daily counts).
 */
export function buildTimeline(
  events: DeliveryEvent[]
): { date: string; sent: number; delivered: number; opened: number; clicked: number; bounced: number }[] {
  const dailyCounts: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }> = {}

  events.forEach((e) => {
    const date = e.timestamp.split('T')[0]
    if (!dailyCounts[date]) {
      dailyCounts[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
    }
    const day = dailyCounts[date]
    if (e.event_type === 'sent') day.sent++
    else if (e.event_type === 'delivered') day.delivered++
    else if (e.event_type === 'opened') day.opened++
    else if (e.event_type === 'clicked') day.clicked++
    else if (e.event_type === 'bounced') day.bounced++
  })

  return Object.entries(dailyCounts)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Track a delivery event. Returns a formatted DeliveryEvent object.
 */
export function trackDeliveryEvent(params: {
  send_job_id: string
  campaign_id: string
  recipient_id: string
  event_type: DeliveryEvent['event_type']
  channel: 'email' | 'sms'
  provider: 'sendgrid' | 'twilio'
  provider_event_id?: string
  metadata?: Record<string, unknown>
}): DeliveryEvent {
  return {
    event_id: `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...params,
    timestamp: new Date().toISOString(),
  }
}
