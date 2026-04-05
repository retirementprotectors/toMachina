/**
 * SLACK INTAKE — Ranger-aware Slack channel intake (ZRD-O11).
 * Team posts to #megazord-intake with file attachment.
 * MEGAZORD acknowledges, routes to Ranger, posts results back.
 * Supports CSV, XLSX, PDF attachments.
 */

import { getFirestore } from 'firebase-admin/firestore'
import { routeToRanger, isAutoDispatchable, type FileMetadata } from './wire-router.js'

/** Slack channel ID for #megazord-intake — must be configured */
const MEGAZORD_INTAKE_CHANNEL = process.env.MEGAZORD_INTAKE_CHANNEL_ID || ''

/** Supported MIME types for Slack file attachments */
const SUPPORTED_MIMES = new Set([
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
  'text/tab-separated-values',
])

export interface SlackIntakeResult {
  success: boolean
  files_received: number
  files_dispatched: number
  files_queued_review: number
  errors: string[]
}

export interface SlackFileAttachment {
  id: string
  name: string
  mimetype: string
  size: number
  url_private_download: string
}

export interface SlackMessage {
  channel: string
  user: string
  text: string
  files?: SlackFileAttachment[]
  ts: string
}

/**
 * Process a Slack message from #megazord-intake.
 * Extracts file attachments, routes to Rangers, posts acknowledgments.
 */
export async function processSlackIntake(message: SlackMessage): Promise<SlackIntakeResult> {
  const result: SlackIntakeResult = {
    success: true,
    files_received: 0,
    files_dispatched: 0,
    files_queued_review: 0,
    errors: [],
  }

  if (!message.files || message.files.length === 0) {
    result.errors.push('No file attachments found in message')
    result.success = false
    return result
  }

  result.files_received = message.files.length

  for (const file of message.files) {
    // Validate MIME type
    if (!SUPPORTED_MIMES.has(file.mimetype)) {
      result.errors.push(`Unsupported file type: ${file.name} (${file.mimetype}). Supported: CSV, XLSX, PDF`)
      continue
    }

    // Route to Ranger
    const meta: FileMetadata = {
      filename: file.name,
      mimeType: file.mimetype,
      size: file.size,
      senderHint: message.user,
      subjectHint: message.text,
    }
    const route = routeToRanger(meta)

    if (isAutoDispatchable(route)) {
      try {
        // Dispatch to Ranger via API
        const apiUrl = process.env.TM_API_URL || 'http://localhost:8080'
        const dispatchRes = await fetch(`${apiUrl}/api/rangers/dispatch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mdj-auth': process.env.MDJ_AUTH_SECRET || '',
          },
          body: JSON.stringify({
            rangerId: route.rangerId,
            mode: route.mode,
            params: {
              slack_file_id: file.id,
              slack_file_url: file.url_private_download,
              slack_channel: message.channel,
              slack_ts: message.ts,
              slack_user: message.user,
            },
          }),
        })
        const dispatchJson = (await dispatchRes.json()) as { success: boolean; error?: string }

        if (dispatchJson.success) {
          result.files_dispatched++
        } else {
          throw new Error(dispatchJson.error || 'Dispatch failed')
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        result.errors.push(`${file.name}: ${errorMsg}`)
      }
    } else {
      // Low confidence — queue for manual review
      const store = getFirestore()
      const queueRef = store.collection('intake_queue')
      await queueRef.add({
        source: 'SLACK_MEGAZORD',
        status: 'PENDING_REVIEW',
        file_name: file.name,
        mime_type: file.mimetype,
        slack_file_id: file.id,
        slack_file_url: file.url_private_download,
        slack_channel: message.channel,
        slack_user: message.user,
        suggested_ranger: route.rangerId,
        routing_confidence: route.confidence,
        routing_reason: route.reason,
        created_at: new Date().toISOString(),
      })
      result.files_queued_review++
    }
  }

  return result
}

/**
 * Get the channel ID for #megazord-intake.
 */
export function getMegazordIntakeChannel(): string {
  return MEGAZORD_INTAKE_CHANNEL
}
