'use client'

import { useState, useMemo } from 'react'
import { SendSmsDialog } from './SendSmsDialog'
import { SendEmailDialog } from './SendEmailDialog'
import { LogCallDialog } from './LogCallDialog'

export interface CommsClient {
  client_id: string
  first_name?: string
  last_name?: string
  phone_numbers?: Array<{ number: string; type: string; primary?: boolean }>
  email_addresses?: Array<{ email: string; type: string; primary?: boolean }>
  dnc_all?: boolean
  dnc_sms?: boolean
  dnc_email?: boolean
  dnd_all?: boolean
  dnd_sms?: boolean
  dnd_email?: boolean
}

interface CommsToolbarProps {
  client?: CommsClient
  onSent?: () => void
}

export function CommsToolbar({ client, onSent }: CommsToolbarProps) {
  const [showSms, setShowSms] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [showCall, setShowCall] = useState(false)

  // DNC enforcement — check BOTH dnc_* and dnd_* fields
  const isDncAll = client?.dnc_all || client?.dnd_all
  const isDncSms = isDncAll || client?.dnc_sms || client?.dnd_sms
  const isDncEmail = isDncAll || client?.dnc_email || client?.dnd_email

  const blockedChannels = useMemo(() => {
    const channels: string[] = []
    if (isDncAll) return ['All channels']
    if (isDncSms) channels.push('SMS')
    if (isDncEmail) channels.push('Email')
    return channels
  }, [isDncAll, isDncSms, isDncEmail])

  const hasClient = Boolean(client?.client_id)
  const clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : ''

  return (
    <div className="space-y-2">
      {blockedChannels.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
          <span className="material-icons-outlined text-[16px] text-red-400">do_not_disturb</span>
          <span className="text-xs font-medium text-red-400">
            DNC: {blockedChannels.join(', ')} blocked
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShowSms(true)} disabled={!hasClient || isDncSms}
          className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isDncSms ? 'DNC: SMS blocked' : !hasClient ? 'Select a client first' : 'Send SMS'}>
          <span className="material-icons-outlined text-[14px]">sms</span>
          Send SMS
        </button>
        <button onClick={() => setShowEmail(true)} disabled={!hasClient || isDncEmail}
          className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isDncEmail ? 'DNC: Email blocked' : !hasClient ? 'Select a client first' : 'Send Email'}>
          <span className="material-icons-outlined text-[14px]">email</span>
          Send Email
        </button>
        <button onClick={() => setShowCall(true)} disabled={!hasClient}
          className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          title={!hasClient ? 'Select a client first' : 'Call'}>
          <span className="material-icons-outlined text-[14px]">phone</span>
          Call
        </button>
      </div>

      {client && (
        <>
          <SendSmsDialog open={showSms} onClose={() => setShowSms(false)} client={client} onSent={onSent} />
          <SendEmailDialog open={showEmail} onClose={() => setShowEmail(false)} client={client} onSent={onSent} />
          <LogCallDialog open={showCall} onClose={() => setShowCall(false)} clientId={client.client_id} clientName={clientName} onSaved={onSent} />
        </>
      )}
    </div>
  )
}
