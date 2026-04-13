'use client'

/* ─── OmniTextTab — TKO-UX-006 ────────────────────────────────────────────
 * Conversation-first SMS view. Groups /api/communications?channel=sms by
 * phone E.164. List + thread + compose. V1 — no edit/delete/threading/attach.
 * ────────────────────────────────────────────────────────────────────── */

import { OmniConversationShell } from './OmniConversationShell'

function formatPhone(e164: string): string {
  // E.164 +1XXXYYYZZZZ → (XXX) YYY-ZZZZ
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return e164
}

interface OmniTextTabProps {
  /** Pre-select this phone number's conversation if present */
  initialPhone?: string | null
}

export function OmniTextTab({ initialPhone = null }: OmniTextTabProps) {
  return (
    <OmniConversationShell
      channel="sms"
      iconName="sms"
      emptyTitle="No SMS conversations yet"
      emptyHint="Inbound and outbound texts will appear here, grouped by phone number."
      composePlaceholder="Type a message…"
      sendEndpoint="/api/comms/send-sms"
      buildSendBody={(handle, body) => ({ to: handle, body })}
      formatHandle={formatPhone}
      initialHandle={initialPhone}
    />
  )
}
