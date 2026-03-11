// Campaign Send Orchestration Types

export interface AudienceFilter {
  client_status?: string[]
  product_types?: string[]
  states?: string[]
  zip_range?: { min: string; max: string }
  age_range?: { min: number; max: number }
  sources?: string[]
  tags?: string[]
  exclude_tags?: string[]
  book_of_business?: string
}

export interface AudienceResult {
  total_eligible: number
  filtered_by_dnd: number
  audience: string[] // client IDs
}

export interface SendSchedule {
  schedule_id: string
  campaign_id: string
  scheduled_for: string // ISO datetime
  timezone: string
  audience_filter: AudienceFilter
  channel: 'email' | 'sms' | 'both'
  status: 'scheduled' | 'processing' | 'completed' | 'cancelled' | 'failed'
  created_by: string
  created_at: string
  updated_at: string
  executed_at?: string
  result?: SendResult
}

export interface SendJob {
  job_id: string
  schedule_id?: string
  campaign_id: string
  template_id: string
  channel: 'email' | 'sms'
  recipient_id: string
  recipient_email?: string
  recipient_phone?: string
  content_subject?: string
  content_body?: string
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'skipped'
  error_message?: string
  provider_id?: string // SendGrid message ID or Twilio SID
  queued_at: string
  sent_at?: string
  delivered_at?: string
}

export interface SendResult {
  total_targeted: number
  total_sent: number
  total_delivered: number
  total_bounced: number
  total_failed: number
  total_skipped_dnd: number
  batches_processed: number
  started_at: string
  completed_at: string
}

export interface CampaignMetrics {
  campaign_id: string
  total_sends: number
  total_delivered: number
  total_bounced: number
  total_opened: number
  total_clicked: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  bounce_rate: number
  last_send_at?: string
}

export interface DeliveryEvent {
  event_id: string
  send_job_id: string
  campaign_id: string
  recipient_id: string
  event_type: 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'unsubscribed' | 'failed'
  channel: 'email' | 'sms'
  provider: 'sendgrid' | 'twilio'
  provider_event_id?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

export type CampaignType = 'PSM' | 'AGE' | 'COV' | 'ENG' | 'LEGACY' | 'T65' | 'AEP' | 'GENERAL'

export const BATCH_SIZE = 50

export const AEP_BLACKOUT = {
  start_month: 10, // October
  start_day: 1,
  end_month: 12, // December
  end_day: 7,
  affected_types: ['AEP', 'T65', 'MAPD', 'MED_SUPP', 'MEDICARE'] as string[],
} as const
