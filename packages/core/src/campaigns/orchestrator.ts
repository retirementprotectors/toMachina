// Campaign Send Orchestrator
// Coordinates: audience → assemble → chunk → queue → track

import { BATCH_SIZE, type SendJob, type SendResult, type AudienceFilter } from './types'
import { buildAudience } from './audience'

interface ClientRecord {
  client_id?: string
  _id?: string
  [key: string]: unknown
}

/**
 * Chunk an array into batches of a given size.
 */
export function chunkIntoBatches<T>(items: T[], size: number = BATCH_SIZE): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

/**
 * Build send jobs for a campaign.
 * Pure function — returns job objects ready to be written to Firestore.
 */
export function buildSendJobs(params: {
  campaign_id: string
  template_id: string
  channel: 'email' | 'sms'
  audience: string[]
  content_subject?: string
  content_body?: string
}): SendJob[] {
  const now = new Date().toISOString()
  const { campaign_id, template_id, channel, audience, content_subject, content_body } = params

  return audience.map((recipientId) => ({
    job_id: `SJ_${generateId()}`,
    campaign_id,
    template_id,
    channel,
    recipient_id: recipientId,
    content_subject,
    content_body,
    status: 'queued' as const,
    queued_at: now,
  }))
}

/**
 * Prepare a full send orchestration plan.
 * Returns batched send jobs ready for execution.
 */
export function prepareSendPlan(params: {
  campaign_id: string
  template_id: string
  channel: 'email' | 'sms'
  clients: ClientRecord[]
  audience_filter: AudienceFilter
  content_subject?: string
  content_body?: string
}): {
  audience_result: ReturnType<typeof buildAudience>
  batches: SendJob[][]
  total_jobs: number
} {
  const { campaign_id, template_id, channel, clients, audience_filter, content_subject, content_body } = params

  // 1. Build audience
  const audienceResult = buildAudience(clients, audience_filter, channel)

  // 2. Create send jobs
  const jobs = buildSendJobs({
    campaign_id,
    template_id,
    channel,
    audience: audienceResult.audience,
    content_subject,
    content_body,
  })

  // 3. Chunk into batches
  const batches = chunkIntoBatches(jobs)

  return {
    audience_result: audienceResult,
    batches,
    total_jobs: jobs.length,
  }
}

/**
 * Create an empty send result for tracking.
 */
export function initSendResult(): SendResult {
  return {
    total_targeted: 0,
    total_sent: 0,
    total_delivered: 0,
    total_bounced: 0,
    total_failed: 0,
    total_skipped_dnd: 0,
    batches_processed: 0,
    started_at: new Date().toISOString(),
    completed_at: '',
  }
}

/**
 * Finalize a send result.
 */
export function finalizeSendResult(result: SendResult): SendResult {
  return {
    ...result,
    completed_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}
