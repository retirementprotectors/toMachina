'use client'

import { CommsCenter } from '@tomachina/ui'
import type { Client } from '@tomachina/core'

// ---------------------------------------------------------------------------
// CommsTab — thin wrapper around the shared CommsCenter module.
// Real-time Firestore listener + DNC enforcement handled by CommsCenter.
// ---------------------------------------------------------------------------

interface CommsTabProps {
  clientId: string
  client?: Client
}

export function CommsTab({ clientId, client }: CommsTabProps) {
  const commsClient = client ? {
    client_id: clientId,
    first_name: client.first_name,
    last_name: client.last_name,
    phone_numbers: mapPhones(client),
    email_addresses: mapEmails(client),
    dnc_all: Boolean(client.dnc_all || client.dnd_all),
    dnc_sms: Boolean(client.dnc_sms || client.dnd_sms),
    dnc_email: Boolean(client.dnc_email || client.dnd_email),
    dnd_all: Boolean(client.dnd_all || client.dnc_all),
    dnd_sms: Boolean(client.dnd_sms || client.dnc_sms),
    dnd_email: Boolean(client.dnd_email || client.dnc_email),
  } : undefined

  return (
    <CommsCenter
      portal="prodashx"
      clientId={clientId}
      client={commsClient}
    />
  )
}

function mapPhones(client: Client): Array<{ number: string; type: string; primary?: boolean }> {
  const phones: Array<{ number: string; type: string; primary?: boolean }> = []
  if (client.phone) {
    phones.push({ number: String(client.phone), type: 'Primary', primary: true })
  }
  const extra = client.phone_numbers as unknown
  if (Array.isArray(extra)) {
    for (const p of extra) {
      if (p && typeof p === 'object' && 'number' in p) {
        phones.push({
          number: String((p as { number: string }).number),
          type: String((p as { type?: string }).type || 'Other'),
          primary: Boolean((p as { primary?: boolean }).primary),
        })
      }
    }
  }
  const cell = client.cell_phone || client.mobile_phone
  if (cell && String(cell) !== (client.phone || '')) {
    phones.push({ number: String(cell), type: 'Cell' })
  }
  const home = client.home_phone
  if (home && String(home) !== (client.phone || '')) {
    phones.push({ number: String(home), type: 'Home' })
  }
  return phones
}

function mapEmails(client: Client): Array<{ email: string; type: string; primary?: boolean }> {
  const emails: Array<{ email: string; type: string; primary?: boolean }> = []
  if (client.email) {
    emails.push({ email: String(client.email), type: 'Primary', primary: true })
  }
  const extra = client.email_addresses as unknown
  if (Array.isArray(extra)) {
    for (const e of extra) {
      if (e && typeof e === 'object' && 'email' in e) {
        emails.push({
          email: String((e as { email: string }).email),
          type: String((e as { type?: string }).type || 'Other'),
          primary: Boolean((e as { primary?: boolean }).primary),
        })
      }
    }
  }
  const secondary = client.secondary_email || client.email_2
  if (secondary && String(secondary) !== (client.email || '')) {
    emails.push({ email: String(secondary), type: 'Secondary' })
  }
  return emails
}
