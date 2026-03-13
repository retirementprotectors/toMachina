'use client'

import { useState, useCallback } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client } from '@tomachina/core'
import { formatPhone, str } from '../../lib/formatters'
import { InlineField, InlineSection, ReadOnlyField } from '../../lib/inline-edit'
import { FieldGrid } from '../../lib/ui-helpers'

interface ContactTabProps {
  client: Client
  clientId: string
}

const PHONE_TYPE_OPTIONS = [
  { label: 'Home', value: 'Home' },
  { label: 'Cell', value: 'Cell' },
  { label: 'Work', value: 'Work' },
  { label: 'Fax', value: 'Fax' },
]

const RELATIONSHIP_OPTIONS = [
  { label: 'Client', value: 'Client' },
  { label: 'Prospect', value: 'Prospect' },
  { label: 'Referrer', value: 'Referrer' },
  { label: 'Family', value: 'Family' },
  { label: 'Business Partner', value: 'Business Partner' },
  { label: 'Other', value: 'Other' },
]

interface DncPillConfig {
  label: string
  fieldKey: string
  icon: string
}

const DNC_PILLS: DncPillConfig[] = [
  { label: 'All', fieldKey: 'dnc_all', icon: 'block' },
  { label: 'Phone', fieldKey: 'dnc_phone', icon: 'phone_disabled' },
  { label: 'Text', fieldKey: 'dnc_sms', icon: 'sms_failed' },
  { label: 'Email', fieldKey: 'dnc_email', icon: 'unsubscribe' },
  { label: 'Mail', fieldKey: 'dnc_mail', icon: 'markunread_mailbox' },
]

function DncPill({
  label,
  icon,
  active,
  saving,
  onToggle,
}: {
  label: string
  icon: string
  active: boolean
  saving: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150"
      style={
        active
          ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
          : { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
      }
      title={`${active ? 'Remove' : 'Set'} Do Not Contact — ${label}`}
    >
      <span className="material-icons-outlined" style={{ fontSize: '13px' }}>
        {icon}
      </span>
      {label}
      {saving && (
        <span
          className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent"
          style={{ borderWidth: '1.5px' }}
        />
      )}
    </button>
  )
}

function DncRow({ client, docPath }: { client: Client; docPath: string }) {
  const [savingField, setSavingField] = useState<string | null>(null)

  const handleToggle = useCallback(
    async (fieldKey: string, currentValue: boolean) => {
      setSavingField(fieldKey)
      try {
        const ref = doc(getDb(), docPath)
        await updateDoc(ref, {
          [fieldKey]: !currentValue,
          updated_at: new Date().toISOString(),
        })
      } catch (err) {
        console.error('DNC toggle save failed:', err)
      } finally {
        setSavingField(null)
      }
    },
    [docPath]
  )

  const getFieldValue = (fieldKey: string): boolean => {
    const key = fieldKey as keyof Client
    return Boolean(client[key])
  }

  const anyActive = DNC_PILLS.some((pill) => getFieldValue(pill.fieldKey))

  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-4 py-2.5"
      style={{
        borderColor: anyActive ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)',
        background: anyActive ? 'rgba(239,68,68,0.04)' : 'var(--bg-card)',
      }}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="material-icons-outlined"
          style={{
            fontSize: '15px',
            color: anyActive ? '#f87171' : 'var(--text-muted)',
          }}
        >
          do_not_disturb
        </span>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: anyActive ? '#f87171' : 'var(--text-muted)' }}
        >
          Do Not Contact
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {DNC_PILLS.map((pill) => {
          const active = getFieldValue(pill.fieldKey)
          return (
            <DncPill
              key={pill.fieldKey}
              label={pill.label}
              icon={pill.icon}
              active={active}
              saving={savingField === pill.fieldKey}
              onToggle={() => handleToggle(pill.fieldKey, active)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function ContactTab({ client, clientId }: ContactTabProps) {
  const docPath = `clients/${clientId}`

  return (
    <div className="space-y-4">
      {/* Do Not Contact — compact pill row at top */}
      <DncRow client={client} docPath={docPath} />

      {/* Phone Numbers */}
      <InlineSection title="Phone Numbers" icon="phone">
        <FieldGrid cols={3}>
          <InlineField
            label="Cell Phone"
            value={str(client.cell_phone)}
            fieldKey="cell_phone"
            docPath={docPath}
            type="tel"
            formatDisplay={formatPhone}
          />
          <InlineField
            label="Alt Phone"
            value={str(client.alt_phone)}
            fieldKey="alt_phone"
            docPath={docPath}
            type="tel"
            formatDisplay={formatPhone}
          />
          <InlineField
            label="Phone Type"
            value={str(client.phone_type)}
            fieldKey="phone_type"
            docPath={docPath}
            type="select"
            options={PHONE_TYPE_OPTIONS}
          />
          <InlineField
            label="Primary Phone"
            value={str(client.phone)}
            fieldKey="phone"
            docPath={docPath}
            type="tel"
            formatDisplay={formatPhone}
          />
          <InlineField
            label="Alt Phone Type"
            value={str(client.alt_phone_type)}
            fieldKey="alt_phone_type"
            docPath={docPath}
            type="select"
            options={PHONE_TYPE_OPTIONS}
          />
        </FieldGrid>
      </InlineSection>

      {/* Email */}
      <InlineSection title="Email" icon="email">
        <FieldGrid cols={2}>
          <InlineField
            label="Primary Email"
            value={str(client.email)}
            fieldKey="email"
            docPath={docPath}
            type="email"
          />
          <InlineField
            label="Secondary Email"
            value={str(client.secondary_email)}
            fieldKey="secondary_email"
            docPath={docPath}
            type="email"
          />
        </FieldGrid>
      </InlineSection>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InlineSection title="Primary Address" icon="home">
          <div className="space-y-3">
            <InlineField label="Street" value={str(client.address)} fieldKey="address" docPath={docPath} placeholder="Start typing address..." />
            <InlineField label="Street 2" value={str(client.address2)} fieldKey="address2" docPath={docPath} />
            <FieldGrid cols={2}>
              <InlineField label="City" value={str(client.city)} fieldKey="city" docPath={docPath} />
              <InlineField label="State" value={str(client.state)} fieldKey="state" docPath={docPath} />
            </FieldGrid>
            <FieldGrid cols={2}>
              <InlineField label="ZIP" value={str(client.zip)} fieldKey="zip" docPath={docPath} />
              <InlineField label="County" value={str(client.county)} fieldKey="county" docPath={docPath} />
            </FieldGrid>
          </div>
        </InlineSection>

        <InlineSection title="Mailing Address" icon="markunread_mailbox">
          <div className="space-y-3">
            <InlineField label="Street" value={str(client.mailing_address)} fieldKey="mailing_address" docPath={docPath} />
            <InlineField label="Street 2" value={str(client.mailing_address2)} fieldKey="mailing_address2" docPath={docPath} />
            <FieldGrid cols={2}>
              <InlineField label="City" value={str(client.mailing_city)} fieldKey="mailing_city" docPath={docPath} />
              <InlineField label="State" value={str(client.mailing_state)} fieldKey="mailing_state" docPath={docPath} />
            </FieldGrid>
            <InlineField label="ZIP" value={str(client.mailing_zip)} fieldKey="mailing_zip" docPath={docPath} />
          </div>
        </InlineSection>
      </div>

      {/* RPI Relationship */}
      <InlineSection title="RPI Relationship" icon="handshake">
        <FieldGrid cols={3}>
          <InlineField
            label="Relationship"
            value={str(client.rpi_relationship)}
            fieldKey="rpi_relationship"
            docPath={docPath}
            type="select"
            options={RELATIONSHIP_OPTIONS}
          />
          <ReadOnlyField label="Agent" value={str(client.agent_name)} />
          <ReadOnlyField label="Book of Business" value={str(client.book_of_business)} />
          <ReadOnlyField label="Source" value={str(client.source)} />
        </FieldGrid>
      </InlineSection>

      {/* Social */}
      <InlineSection title="Social Profiles" icon="share">
        <FieldGrid cols={3}>
          <InlineField label="Facebook" value={str(client.facebook_url)} fieldKey="facebook_url" docPath={docPath} placeholder="Facebook profile URL" />
          <InlineField label="LinkedIn" value={str(client.linkedin_url)} fieldKey="linkedin_url" docPath={docPath} placeholder="LinkedIn profile URL" />
          <InlineField label="Other" value={str(client.social_other)} fieldKey="social_other" docPath={docPath} placeholder="Other social URL" />
        </FieldGrid>
      </InlineSection>
    </div>
  )
}
