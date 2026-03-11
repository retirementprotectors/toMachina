'use client'

import type { Client } from '@tomachina/core'
import { formatPhone, formatDate, str } from '../../lib/formatters'
import { SectionCard, DetailField, EditableField, FieldGrid } from '../../lib/ui-helpers'

interface ContactTabProps {
  client: Client
  editing?: boolean
  editData?: Record<string, unknown>
  onFieldChange?: (key: string, value: string) => void
}

function timeAgo(dateStr: unknown): string {
  if (!dateStr) return ''
  const d = new Date(String(dateStr))
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function ContactTab({ client, editing = false, editData = {}, onFieldChange }: ContactTabProps) {
  const ev = (key: string) => (editData[key] !== undefined ? String(editData[key]) : undefined)
  const clientName = [str(client.first_name), str(client.last_name)].filter(Boolean).join(' ') || 'Client'
  const lastContactAgo = timeAgo(client.last_contact_date)

  return (
    <div className="space-y-4">
      {/* Contact Header Card */}
      {!editing && (
        <div className="flex items-center gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          {/* Photo Placeholder */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: 'var(--portal)' }}>
            {clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{clientName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              {str(client.client_status) && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  str(client.client_status).toLowerCase() === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                }`}>
                  {str(client.client_status)}
                </span>
              )}
              {str(client.book_of_business) && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>folder</span>
                  {str(client.book_of_business)}
                </span>
              )}
              {lastContactAgo && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>schedule</span>
                  Last contact: {lastContactAgo}
                </span>
              )}
            </div>
          </div>
          {/* Quick Action Buttons */}
          <div className="flex gap-2">
            {str(client.phone) && (
              <a href={`tel:${str(client.phone).replace(/\D/g, '')}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--portal-glow)] hover:text-[var(--portal)]" title="Call">
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>call</span>
              </a>
            )}
            {str(client.email) && (
              <a href={`mailto:${str(client.email)}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--portal-glow)] hover:text-[var(--portal)]" title="Email">
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>email</span>
              </a>
            )}
            {str(client.cell_phone) && (
              <a href={`sms:${str(client.cell_phone).replace(/\D/g, '')}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:bg-[var(--portal-glow)] hover:text-[var(--portal)]" title="Text">
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>sms</span>
              </a>
            )}
          </div>
        </div>
      )}

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

      {/* Communication Preferences */}
      <SectionCard title="Communication Preferences" icon="tune">
        <FieldGrid cols={3}>
          <DetailField label="Preferred Contact" value={str(client.preferred_contact)} />
          <DetailField label="Best Time to Call" value={str(client.best_call_time)} />
          <DetailField label="Last Contact" value={formatDate(client.last_contact_date)} />
        </FieldGrid>
      </SectionCard>

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
