'use client'

import type { Client } from '@tomachina/core'
import { formatPhone, str } from '../../lib/formatters'
import { SectionCard, DetailField, FieldGrid } from '../../lib/ui-helpers'

interface ContactTabProps {
  client: Client
}

export function ContactTab({ client }: ContactTabProps) {
  return (
    <div className="space-y-4">
      {/* Phone Numbers */}
      <SectionCard title="Phone Numbers" icon="phone">
        <div className="space-y-3">
          <PhoneRow
            label="Primary"
            number={formatPhone(client.phone)}
            type={str(client.phone_type)}
            verified={Boolean(client.phone_verified)}
          />
          <PhoneRow
            label="Cell"
            number={formatPhone(client.cell_phone)}
            type="Mobile"
            verified={Boolean(client.cell_verified)}
          />
          <PhoneRow
            label="Alternate"
            number={formatPhone(client.alt_phone)}
            type={str(client.alt_phone_type)}
            verified={false}
          />
        </div>
      </SectionCard>

      {/* Email */}
      <SectionCard title="Email" icon="email">
        <div className="space-y-3">
          <EmailRow label="Primary" email={str(client.email)} />
          <EmailRow label="Secondary" email={str(client.secondary_email)} />
        </div>
      </SectionCard>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Primary Address" icon="home">
          <AddressBlock
            street={str(client.address)}
            street2={str(client.address2)}
            city={str(client.city)}
            state={str(client.state)}
            zip={str(client.zip)}
            county={str(client.county)}
          />
        </SectionCard>

        <SectionCard title="Mailing Address" icon="markunread_mailbox">
          {hasMailing(client) ? (
            <AddressBlock
              street={str(client.mailing_address)}
              street2={str(client.mailing_address2)}
              city={str(client.mailing_city)}
              state={str(client.mailing_state)}
              zip={str(client.mailing_zip)}
              county=""
            />
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">Same as primary</p>
          )}
        </SectionCard>
      </div>

      {/* RPI Relationship */}
      <SectionCard title="RPI Relationship" icon="handshake">
        <FieldGrid cols={3}>
          <DetailField label="Agent" value={str(client.agent_name)} />
          <DetailField label="Book of Business" value={str(client.book_of_business)} />
          <DetailField label="Source" value={str(client.source)} />
        </FieldGrid>
      </SectionCard>

      {/* Do Not Contact */}
      <SectionCard title="Do Not Contact" icon="do_not_disturb">
        <div className="flex flex-wrap gap-3">
          <DncFlag label="All" active={Boolean(client.dnc_all)} />
          <DncFlag label="Phone" active={Boolean(client.dnc_phone)} />
          <DncFlag label="SMS" active={Boolean(client.dnc_sms)} />
          <DncFlag label="Email" active={Boolean(client.dnc_email)} />
        </div>
      </SectionCard>

      {/* Social */}
      {str(client.facebook_url) && (
        <SectionCard title="Social" icon="share">
          <FieldGrid cols={2}>
            <DetailField label="Facebook" value={str(client.facebook_url)} />
          </FieldGrid>
        </SectionCard>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhoneRow({
  label,
  number,
  type,
  verified,
}: {
  label: string
  number: string
  type: string
  verified: boolean
}) {
  if (!number) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
        <span className="text-sm text-[var(--text-muted)]">&mdash;</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)] w-20">
          {label}
        </span>
        <a
          href={`tel:${number.replace(/\D/g, '')}`}
          className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)] transition-colors"
        >
          {number}
        </a>
        {type && (
          <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
            {type}
          </span>
        )}
      </div>
      {verified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
          <span className="material-icons-outlined text-[12px]">verified</span>
          Verified
        </span>
      )}
    </div>
  )
}

function EmailRow({ label, email }: { label: string; email: string }) {
  if (!email) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
        <span className="text-sm text-[var(--text-muted)]">&mdash;</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-[var(--text-muted)] w-20">
          {label}
        </span>
        <a
          href={`mailto:${email}`}
          className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)] transition-colors"
        >
          {email}
        </a>
      </div>
    </div>
  )
}

function AddressBlock({
  street,
  street2,
  city,
  state,
  zip,
  county,
}: {
  street: string
  street2: string
  city: string
  state: string
  zip: string
  county: string
}) {
  if (!street && !city) {
    return <p className="text-sm text-[var(--text-muted)]">&mdash;</p>
  }

  return (
    <div className="space-y-0.5 text-sm text-[var(--text-primary)]">
      {street && <p>{street}</p>}
      {street2 && <p>{street2}</p>}
      <p>
        {[city, state].filter(Boolean).join(', ')}
        {zip ? ` ${zip}` : ''}
      </p>
      {county && (
        <p className="text-xs text-[var(--text-muted)]">{county} County</p>
      )}
    </div>
  )
}

function DncFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? 'bg-red-500/15 text-red-400'
          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
      }`}
    >
      <span className="material-icons-outlined text-[14px]">
        {active ? 'block' : 'check_circle'}
      </span>
      {label}
      <span className="ml-0.5">{active ? 'ON' : 'OFF'}</span>
    </span>
  )
}

function hasMailing(client: Client): boolean {
  return Boolean(
    client.mailing_address || client.mailing_city || client.mailing_state || client.mailing_zip
  )
}
