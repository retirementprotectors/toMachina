/**
 * Gmail API inbox scanning — replaces GAS GmailApp.
 * Scans configured email inboxes for new messages with attachments.
 */

import { google, type gmail_v1 } from 'googleapis'

let gmailClient: gmail_v1.Gmail | null = null

function getGmail(): gmail_v1.Gmail {
  if (!gmailClient) {
    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
    })
    gmailClient = google.gmail({ version: 'v1', auth })
  }
  return gmailClient
}

export interface EmailMessage {
  messageId: string
  threadId: string
  from: string
  subject: string
  date: string
  snippet: string
  attachments: EmailAttachment[]
  labels: string[]
}

export interface EmailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

/**
 * Scan inbox for unread messages since a given date.
 */
export async function scanInbox(
  userId: string,
  afterDate?: string,
  maxResults = 50
): Promise<EmailMessage[]> {
  const gmail = getGmail()
  const messages: EmailMessage[] = []

  let queryParts = ['is:unread']
  if (afterDate) {
    const formatted = afterDate.replace(/-/g, '/')
    queryParts.push(`after:${formatted}`)
  }

  const listRes = await gmail.users.messages.list({
    userId,
    q: queryParts.join(' '),
    maxResults,
  })

  for (const msg of listRes.data.messages || []) {
    const detail = await gmail.users.messages.get({
      userId,
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    })

    const headers = detail.data.payload?.headers || []
    const from = headers.find(h => h.name === 'From')?.value || ''
    const subject = headers.find(h => h.name === 'Subject')?.value || ''
    const date = headers.find(h => h.name === 'Date')?.value || ''

    const attachments: EmailAttachment[] = []
    const parts = detail.data.payload?.parts || []
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        })
      }
    }

    messages.push({
      messageId: msg.id!,
      threadId: msg.threadId!,
      from,
      subject,
      date,
      snippet: detail.data.snippet || '',
      attachments,
      labels: detail.data.labelIds || [],
    })
  }

  return messages
}

/**
 * Mark a message as read (remove UNREAD label).
 */
export async function markAsRead(userId: string, messageId: string): Promise<void> {
  const gmail = getGmail()
  await gmail.users.messages.modify({
    userId,
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  })
}

/**
 * Get attachment content as base64.
 */
export async function getAttachment(
  userId: string,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const gmail = getGmail()
  const res = await gmail.users.messages.attachments.get({
    userId,
    messageId,
    id: attachmentId,
  })
  return res.data.data || ''
}
