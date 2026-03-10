'use client'

import type { Client } from '@tomachina/core'
import { formatPhone, str } from '../../lib/formatters'
import { SectionCard, DetailField, EditableField, FieldGrid } from '../../lib/ui-helpers'

interface ContactTabProps {
  client: Client
  editing?: boolean
  editData?: Record<string, unknown>
  onFieldChange?: (key: string, value: string) => void
}

export function ContactTab({ client, editing = false, editData = {}, onFieldChange }: ContactTabProps) {
  const ev = (key: string) => (editData[key] !== undefined ? String(editData[key]) : undefined)
  return (
    <div className="space-y-4">
      {/* Phone Numbers */}
      <SectionCard title="Phone Numbers" icon="phone">
        {editing ? (
          <FieldGrid cols={3}>
            <EditableField label="Primary Phone" value={formatPhone(client.phone)} fieldKey="phone" editing={editing} editValue={ev('phone')} onChange={onFieldChange} type="tel" />
            <EditableField label="Phone Type" value={str(client.phone_type)} fieldKey="phone_type" editing={editing} editValue={ev('phone_type')} onChange={onFieldChange} type="select" options={[{ label: 'Mobile', value: 'Mobile' }, { label: 'Landline', value: 'Landline' }, { label: 'Work', value: 'Work' }]} />
            <DetailField label="Verified" value={client.phone_verified ? 'Yes' : 'No'} />
            <EditableField label="Cell Phone" value={formatPhone(client.cell_phone)} fieldKey="cell_phone" editing={editing} editValue={ev('cell_phone')} onChange={onFieldChange} type="tel" />
            <DetailField label="Cell Type" value="Mobile" />
            <DetailField label="Cell Verified" value={client.cell_verified ? 'Yes' : 'No'} />
            <EditableField label="Alternate Phone" value={formatPhone(client.alt_phone)} fieldKey="alt_phone" editing={editing} editValue={ev('alt_phone')} onChange={onFieldChange} type="tel" />
            <EditableField label="Alt Phone Type" value={str(client.alt_phone_type)} fieldKey="alt_phone_type" editing={editing} editValue={ev('alt_phone_type')} onChange={onFieldChange} type="select" options={[{ label: 'Mobile', value: 'Mobile' }, { label: 'Landline', value: 'Landline' }, { label: 'Work', value: 'Work' }]} />
          </FieldGrid>
        ) : (
          <div className="space-y-3">
            <PhoneRow label="Primary" number={formatPhone(client.phone)} type={str(client.phone_type)} verified={Boolean(client.phone_verified)} />
            <PhoneRow label="Cell" number={formatPhone(client.cell_phone)} type="Mobile" verified={Boolean(client.cell_verified)} />
            <PhoneRow label="Alternate" number={formatPhone(client.alt_phone)} type={str(client.alt_phone_type)} verified={false} />
          </div>
        )}
      </SectionCard>

      {/* Email */}
      <SectionCard title="Email" icon="email">
        {editing ? (
          <FieldGrid cols={2}>
            <EditableField label="Primary Email" value={str(client.email)} fieldKey="email" editing={editing} editValue={ev('email')} onChange={onFieldChange} type="email" />
            <EditableField label="Secondary Email" value={str(client.secondary_email)} fieldKey="secondary_email" editing={editing} editValue={ev('secondary_email')} onChange={onFieldChange} type="email" />
          </FieldGrid>
        ) : (
          <div className="space-y-3">
            <EmailRow label="Primary" email={str(client.email)} />
            <EmailRow label="Secondary" email={str(client.secondary_email)} />
          </div>
        )}
      </SectionCard>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Primary Address" icon="home">
          {editing ? (
            <div className="space-y-3">
              <EditableField label="Street" value={str(client.address)} fieldKey="address" editing={editing} editValue={ev('address')} onChange={onFieldChange} />
              <EditableField label="Street 2" value={str(client.address2)} fieldKey="address2" editing={editing} editValue={ev('address2')} onChange={onFieldChange} />
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="City" value={str(client.city)} fieldKey="city" editing={editing} editValue={ev('city')} onChange={onFieldChange} />
                <EditableField label="State" value={str(client.state)} fieldKey="state" editing={editing} editValue={ev('state')} onChange={onFieldChange} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="ZIP" value={str(client.zip)} fieldKey="zip" editing={editing} editValue={ev('zip')} onChange={onFieldChange} />
                <EditableField label="County" value={str(client.county)} fieldKey="county" editing={editing} editValue={ev('county')} onChange={onFieldChange} />
              </div>
            </div>
          ) : (
            <AddressBlock street={str(client.address)} street2={str(client.address2)} city={str(client.city)} state={str(client.state)} zip={str(client.zip)} county={str(client.county)} />
          )}
        </SectionCard>

        <SectionCard title="Mailing Address" icon="markunread_mailbox">
          {editing ? (
            <div className="space-y-3">
              <EditableField label="Street" value={str(client.mailing_address)} fieldKey="mailing_address" editing={editing} editValue={ev('mailing_address')} onChange={onFieldChange} />
              <EditableField label="Street 2" value={str(client.mailing_address2)} fieldKey="mailing_address2" editing={editing} editValue={ev('mailing_address2')} onChange={onFieldChange} />
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="City" value={str(client.mailing_city)} fieldKey="mailing_city" editing={editing} editValue={ev('mailing_city')} onChange={onFieldChange} />
                <EditableField label="State" value={str(client.mailing_state)} fieldKey="mailing_state" editing={editing} editValue={ev('mailing_state')} onChange={onFieldChange} />
              </div>
              <EditableField label="ZIP" value={str(client.mailing_zip)} fieldKey="mailing_zip" editing={editing} editValue={ev('mailing_zip')} onChange={onFieldChange} />
            </div>
          ) : hasMailing(client) ? (
            <AddressBlock street={str(client.mailing_address)} street2={str(client.mailing_address2)} city={str(client.mailing_city)} state={str(client.mailing_state)} zip={str(client.mailing_zip)} county="" />
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
