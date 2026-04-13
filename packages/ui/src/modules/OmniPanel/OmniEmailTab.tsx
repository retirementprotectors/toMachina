'use client'

/* ─── OmniEmailTab — TKO-UX-006 ───────────────────────────────────────────
 * Conversation-first email view. Groups /api/communications?channel=email by
 * recipient address. List + thread + compose (with subject). V1 — no edit/
 * delete/threading/attachments.
 * ────────────────────────────────────────────────────────────────────── */

import { OmniConversationShell } from './OmniConversationShell'

interface OmniEmailTabProps {
  /** Pre-select this email's conversation if present */
  initialEmail?: string | null
}

export function OmniEmailTab({ initialEmail = null }: OmniEmailTabProps) {
  return (
    <OmniConversationShell
      channel="email"
      iconName="email"
      emptyTitle="No email threads yet"
      emptyHint="Sent and received emails will appear here, grouped by address."
      composePlaceholder="Write your message…"
      composeSubjectVisible
      sendEndpoint="/api/comms/send-email"
      buildSendBody={(handle, body, subject) => ({
        to: handle,
        subject: subject || '(no subject)',
        body,
      })}
      formatHandle={(h) => h}
      initialHandle={initialEmail}
    />
  )
}
