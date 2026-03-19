// ---------------------------------------------------------------------------
// Atomic Tool: notify-slack (3 functions)
// Extracted from: watcher.js:115+ (sendSlackCaseNotification),
//                 watcher.js:250+ (sendMultiDocScanNotification),
//                 watcher.js:356+ (sendOperationalAlert)
// Rich Block Kit Slack notifications for the wire pipeline
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition } from '../types'

export const definition: AtomicToolDefinition = {
  tool_id: 'notify-slack',
  name: 'Slack Notifications',
  description:
    'Send case notifications, multi-doc scan summaries, and operational alerts to Slack channels via Bot Token.',
  category: 'NOTIFICATIONS',
}

// --- Types ---

export interface SlackCaseInput {
  channel: string
  clientName: string
  specialist: string
  acfUrl?: string
  ai3Url?: string
  summaryUrl?: string
  accounts?: Array<{
    custodian?: string
    carrier_name?: string
    account_type?: string
    product_type?: string
    account_value?: number | string
    cash_value?: number | string
  }>
  documentCount?: number
  processingTime?: string | number
}

export interface SlackSplitInput {
  channel: string
  originalFileName: string
  totalPages: number
  documentCount: number
  specialist?: string
  processingTime?: string | number
  documents?: Array<{
    docNum?: number
    type: string
    clientName?: string
    fileName?: string
    batchId?: string
    accounts?: number
    unit?: string
    pipeline?: string
    urgency?: string
  }>
  approvalUrl?: string
}

export interface SlackAlertInput {
  channel: string
  text: string
  blocks?: Array<Record<string, unknown>>
}

// --- Helpers ---

async function postToSlack(
  channel: string,
  text: string,
  blocks?: Array<Record<string, unknown>>
): Promise<Record<string, unknown> | null> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('Slack notification skipped (no SLACK_BOT_TOKEN configured)')
    return null
  }

  try {
    const body: Record<string, unknown> = { channel, text }
    if (blocks) body.blocks = blocks

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const result = (await response.json()) as Record<string, unknown>
    if (!result.ok) {
      console.error(`Slack API error: ${result.error}`)
      return null
    }

    return result
  } catch (error) {
    console.error(`Slack notification failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

// --- Case Notification ---
// Extracted from watcher.js:115-247 (sendSlackCaseNotification)
// PROVEN Block Kit format — preserved verbatim

export async function notifySlackCase(
  input: SlackCaseInput
): Promise<Record<string, unknown> | null> {
  const {
    channel,
    clientName,
    specialist,
    acfUrl,
    ai3Url,
    summaryUrl,
    accounts = [],
    documentCount = 0,
    processingTime,
  } = input

  // Calculate totals
  const totalValue = accounts.reduce((sum, acc) => {
    return sum + (parseFloat(String(acc.account_value || acc.cash_value || 0)) || 0)
  }, 0)

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '\u2705 Case Ready for Review',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Client:*\n${clientName}` },
        { type: 'mrkdwn', text: `*Specialist:*\n${specialist}` },
        { type: 'mrkdwn', text: `*Documents:*\n${documentCount} processed` },
        { type: 'mrkdwn', text: `*Accounts Found:*\n${accounts.length}` },
      ],
    },
  ]

  // Add account summary if we have accounts
  if (accounts.length > 0) {
    const accountLines = accounts
      .slice(0, 5)
      .map((acc) => {
        const name = acc.custodian || acc.carrier_name || 'Unknown'
        const type = acc.account_type || acc.product_type || ''
        const value = parseFloat(String(acc.account_value || acc.cash_value || 0)) || 0
        return `\u2022 ${name} ${type}: $${value.toLocaleString()}`
      })
      .join('\n')

    const moreText =
      accounts.length > 5 ? `\n_...and ${accounts.length - 5} more_` : ''

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Account Summary:*\n${accountLines}${moreText}\n\n*Total Assets:* $${totalValue.toLocaleString()}`,
      },
    })
  }

  // Add links
  const links: string[] = []
  if (acfUrl) links.push(`<${acfUrl}|\ud83d\udcc1 Client ACF>`)
  if (ai3Url) links.push(`<${ai3Url}|\ud83d\udcca Ai3 Analysis>`)
  if (summaryUrl) links.push(`<${summaryUrl}|\ud83d\udccb Executive Summary>`)

  if (links.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: links.join('  |  ') },
    })
  }

  // Action context
  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `\ud83e\udd16 _Auto-processed in ${processingTime || 'N/A'}s \u2022 Ready for Gradient case design or internal review_`,
        },
      ],
    }
  )

  const fallbackText = `\u2705 Case Ready: ${clientName} (${specialist}) - ${accounts.length} accounts, $${totalValue.toLocaleString()} total`
  return postToSlack(channel, fallbackText, blocks)
}

// --- Multi-Doc Scan Notification ---
// Extracted from watcher.js:250-353 (sendMultiDocScanNotification)
// PROVEN Block Kit format — preserved verbatim

export async function notifySlackSplit(
  input: SlackSplitInput
): Promise<Record<string, unknown> | null> {
  const {
    channel,
    originalFileName,
    totalPages,
    documentCount,
    specialist,
    processingTime,
    documents = [],
  } = input

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `\u2702\ufe0f Bulk Scan Split: ${documentCount} Documents`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Original Scan:*\n${originalFileName}` },
        { type: 'mrkdwn', text: `*Specialist:*\n${specialist || 'Unassigned'}` },
        { type: 'mrkdwn', text: `*Pages:*\n${totalPages}` },
        { type: 'mrkdwn', text: `*Processing Time:*\n${processingTime || 'N/A'}s` },
      ],
    },
    { type: 'divider' },
  ]

  // Per-document breakdown
  for (const doc of documents) {
    const icon = doc.unit === 'Medicare' ? '\ud83c\udfe5' : '\ud83d\udcb0'
    const urgencyIcon = doc.urgency === 'urgent' ? ' \ud83d\udd34' : ''
    const acctText =
      doc.accounts && doc.accounts > 0
        ? ` \u2022 ${doc.accounts} acct${doc.accounts > 1 ? 's' : ''}`
        : ''

    const reviewLink =
      doc.batchId && doc.batchId !== 'FAILED'
        ? `<prodash.tomachina.com/approvals?batch_id=${doc.batchId}|\ud83d\udccb Review>`
        : '_no batch_'

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `${icon} *${doc.clientName || 'Unknown'}* \u2014 ${doc.type}${urgencyIcon}${acctText}\n` +
          `_Filed as:_ \`${doc.fileName || 'pending'}\`\n` +
          `_Pipeline:_ ${doc.pipeline || 'N/A'} \u2022 ${reviewLink}`,
      },
    })
  }

  // Action footer
  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `\ud83e\udd16 _Auto-split and processed \u2022 ${documentCount} approval batches created_`,
        },
      ],
    }
  )

  const fallbackText = `\u2702\ufe0f Bulk Scan Split: ${originalFileName} \u2192 ${documentCount} documents (${specialist})`
  return postToSlack(channel, fallbackText, blocks)
}

// --- Operational Alert ---
// Extracted from watcher.js:356-380 (sendOperationalAlert)
// Generic alert for heartbeat, errors, auth failures

export async function notifySlackAlert(
  input: SlackAlertInput
): Promise<Record<string, unknown> | null> {
  return postToSlack(input.channel, input.text, input.blocks)
}
