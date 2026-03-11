/**
 * EMAIL — Gmail inbox scanning.
 * Reads inbox config from Firestore `email_inbox_config` collection.
 * For each configured inbox: scans for new unread messages since last check.
 */

import { getFirestore } from 'firebase-admin/firestore'
import { scanInbox, markAsRead, type EmailMessage } from './lib/gmail-scanner.js'
import { createQueueEntry, isFileQueued, getLastScanTime, setLastScanTime } from './queue.js'

export interface EmailInboxConfig {
  address: string
  matrix: string
  team: string
  description: string
  active: boolean
}

export interface EmailScanResult {
  success: boolean
  inboxes_scanned: number
  messages_processed: number
  attachments_queued: number
  messages_without_attachments: number
  skipped_duplicates: number
  errors: string[]
}

/**
 * Load email inbox configurations from Firestore.
 */
async function loadInboxConfigs(): Promise<EmailInboxConfig[]> {
  const db = getFirestore()
  const snap = await db.collection('email_inbox_config').where('active', '==', true).get()
  return snap.docs.map(d => d.data() as EmailInboxConfig)
}

/**
 * Determine email priority from subject and sender.
 */
function classifyPriority(msg: EmailMessage): 'high' | 'normal' | 'low' {
  const subject = msg.subject.toLowerCase()
  if (subject.includes('urgent') || subject.includes('asap') || subject.includes('rush')) return 'high'
  if (subject.includes('fyi') || subject.includes('no action')) return 'low'
  return 'normal'
}

/**
 * Scan all configured email inboxes for new messages with attachments.
 */
export async function scanEmailInboxes(): Promise<EmailScanResult> {
  const result: EmailScanResult = {
    success: true,
    inboxes_scanned: 0,
    messages_processed: 0,
    attachments_queued: 0,
    messages_without_attachments: 0,
    skipped_duplicates: 0,
    errors: [],
  }

  try {
    const configs = await loadInboxConfigs()
    if (configs.length === 0) {
      result.errors.push('No active email inbox configs found in Firestore')
      return result
    }

    const lastScan = await getLastScanTime('EMAIL')
    const afterDate = lastScan
      ? new Date(lastScan).toISOString().split('T')[0]
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    for (const config of configs) {
      try {
        result.inboxes_scanned++
        const messages = await scanInbox(config.address, afterDate)

        for (const msg of messages) {
          result.messages_processed++

          if (msg.attachments.length === 0) {
            result.messages_without_attachments++
            // Still mark as read
            try { await markAsRead(config.address, msg.messageId) } catch { /* noop */ }
            continue
          }

          const priority = classifyPriority(msg)

          for (const attachment of msg.attachments) {
            // Use messageId + attachmentId as composite file_id for dedup
            const compositeId = `email:${msg.messageId}:${attachment.attachmentId}`

            const alreadyQueued = await isFileQueued(compositeId)
            if (alreadyQueued) {
              result.skipped_duplicates++
              continue
            }

            await createQueueEntry('EMAIL', {
              file_id: compositeId,
              file_name: attachment.filename,
              file_type: attachment.mimeType.split('/').pop() || 'unknown',
              file_size: attachment.size,
              document_type: undefined,
              content_preview: `From: ${msg.from}\nSubject: ${msg.subject}`.slice(0, 200),
              email_from: msg.from,
              email_subject: msg.subject,
              email_priority: priority,
            })

            result.attachments_queued++
          }

          // Mark message as read after processing all attachments
          try { await markAsRead(config.address, msg.messageId) } catch { /* noop */ }
        }
      } catch (err) {
        result.errors.push(`Inbox "${config.address}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    await setLastScanTime('EMAIL', new Date().toISOString())
  } catch (err) {
    result.success = false
    result.errors.push(`Root scan error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return result
}
