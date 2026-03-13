'use client'

import { useState, useCallback, useEffect } from 'react'
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client } from '@tomachina/core'
import { formatPhone, str } from '../../lib/formatters'
import { InlineField, InlineSection } from '../../lib/inline-edit'
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

const BOOK_OF_BUSINESS_OPTIONS = [
  { label: 'RPI', value: 'RPI' },
  { label: 'Sprenger', value: 'Sprenger' },
  { label: 'McCormick', value: 'McCormick' },
  { label: 'Gradient', value: 'Gradient' },
  { label: 'Signal', value: 'Signal' },
  { label: 'Other', value: 'Other' },
]

const SOURCE_OPTIONS = [
  { label: 'Referral', value: 'Referral' },
  { label: 'Marketing', value: 'Marketing' },
  { label: 'Website', value: 'Website' },
  { label: 'Walk-In', value: 'Walk-In' },
  { label: 'Transfer', value: 'Transfer' },
  { label: 'Seminar', value: 'Seminar' },
  { label: 'Mailer', value: 'Mailer' },
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
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
        active
          ? 'bg-red-500/15 text-red-400'
          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
      }`}
      title={`${active ? 'Remove' : 'Set'} Do Not Contact — ${label}`}
    >
      <span className="material-icons-outlined text-[13px]">
        {icon}
      </span>
      {label}
      {saving && (
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
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
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
        anyActive
          ? 'border-red-500/30 bg-red-500/[0.04]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
      }`}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`material-icons-outlined text-[15px] ${anyActive ? 'text-red-400' : 'text-[var(--text-muted)]'}`}
        >
          do_not_disturb
        </span>
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${anyActive ? 'text-red-400' : 'text-[var(--text-muted)]'}`}
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

  const [agentOptions, setAgentOptions] = useState<{ label: string; value: string }[]>([])

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(getDb(), 'users'))
        const opts = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          const last = String(data.last_name || '').trim()
          const first = String(data.first_name || '').trim()
          const email = String(data.email || d.id).trim()
          const label = last && first ? `${last}, ${first}` : first || email
          return { label, value: email }
        })
        opts.sort((a, b) => a.label.localeCompare(b.label))
        setAgentOptions(opts)
      } catch {
        // Non-critical — agent dropdown stays empty
      }
    }
    fetchUsers()
  }, [])

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
          <InlineField
            label="Agent"
            value={str(client.agent_name)}
            fieldKey="agent_name"
            docPath={docPath}
            type="select"
            options={agentOptions}
          />
          <InlineField
            label="Book of Business"
            value={str(client.book_of_business)}
            fieldKey="book_of_business"
            docPath={docPath}
            type="select"
            options={BOOK_OF_BUSINESS_OPTIONS}
          />
          <InlineField
            label="Source"
            value={str(client.source)}
            fieldKey="source"
            docPath={docPath}
            type="select"
            options={SOURCE_OPTIONS}
          />
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
