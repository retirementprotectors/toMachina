'use client'

import { useState, useCallback, useEffect } from 'react'
import { doc, updateDoc, collection, getDocs, query, limit } from 'firebase/firestore'
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

// Item 3 (FIX-8): BoB options are fetched dynamically from Firestore
// instead of being hardcoded. See useEffect in ContactTab below.

const CLASSIFICATION_OPTIONS = [
  { label: 'Client', value: 'Client' },
  { label: 'Prospect', value: 'Prospect' },
  { label: 'Lead', value: 'Lead' },
  { label: 'Affiliate', value: 'Affiliate' },
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

function ValidationDot({ status }: { status: string }) {
  if (!status) return null
  const s = status.toLowerCase()
  const color = s === 'valid' ? 'bg-emerald-400' : s === 'invalid' ? 'bg-red-400' : 'bg-amber-400'
  const label = s === 'valid' ? 'Valid' : s === 'invalid' ? 'Invalid' : 'Unknown'
  return (
    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} title={label} />
  )
}

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
  // Lookup map: user_id UUID -> "First Last" for resolving the current agent display name
  const [userNameMap, setUserNameMap] = useState<Map<string, string>>(new Map())
  // Item 3 (FIX-8): Dynamic BoB options fetched from Firestore
  const [bobOptions, setBobOptions] = useState<{ label: string; value: string }[]>([])

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(getDb(), 'users'))
        const nameMap = new Map<string, string>()
        const opts: { label: string; value: string }[] = []
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>
          const last = String(data.last_name || '').trim()
          const first = String(data.first_name || '').trim()
          const userId = String(data.user_id || '').trim()
          const email = String(data.email || d.id).trim()
          const label = first && last ? `${first} ${last}` : first || last || email

          // Build name map for display resolution (all users)
          if (userId) nameMap.set(userId, label)
          nameMap.set(email, label) // fallback by email/doc ID

          // Agent dropdown: only users with is_agent: true and active status
          const isAgent = Boolean(data.is_agent)
          const status = String(data.status || '').toLowerCase()
          if (isAgent && status === 'active' && userId) {
            opts.push({ label, value: userId })
          }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label))
        setAgentOptions(opts)
        setUserNameMap(nameMap)
      } catch {
        // Non-critical — agent dropdown stays empty
      }
    }
    fetchUsers()
  }, [])

  // Item 3 (FIX-8): Fetch unique book_of_business values from clients collection
  useEffect(() => {
    async function fetchBobs() {
      try {
        const snap = await getDocs(query(collection(getDb(), 'clients'), limit(5000)))
        const bobs = new Set<string>()
        snap.forEach((d) => {
          const bob = d.data().book_of_business
          if (bob && typeof bob === 'string') bobs.add(bob)
        })
        const sorted = Array.from(bobs).sort()
        setBobOptions(sorted.map((b) => ({ label: b, value: b })))
      } catch {
        // Non-critical — BoB dropdown stays empty
      }
    }
    fetchBobs()
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
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <InlineField
                label="Primary Phone"
                value={str(client.phone)}
                fieldKey="phone"
                docPath={docPath}
                type="tel"
                formatDisplay={formatPhone}
              />
            </div>
            <ValidationDot status={str(client.phone_valid)} />
          </div>
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
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <InlineField
                label="Primary Email"
                value={str(client.email)}
                fieldKey="email"
                docPath={docPath}
                type="email"
              />
            </div>
            <ValidationDot status={str(client.email_valid)} />
          </div>
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
            {(str(client.zone_id) || str(client.territory_id)) && (
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                {str(client.territory_id) && <span>Territory: <strong className="text-[var(--text-primary)]">{str(client.territory_id)}</strong></span>}
                {str(client.zone_id) && <span>Zone: <strong className="text-[var(--text-primary)]">{str(client.zone_id)}</strong></span>}
              </div>
            )}
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
            <InlineField label="County" value={str(client.mailing_county)} fieldKey="mailing_county" docPath={docPath} />
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
            value={str(client.assigned_user_id || client.agent_id || '')}
            fieldKey="assigned_user_id"
            docPath={docPath}
            type="select"
            options={agentOptions}
            formatDisplay={(val) => {
              if (!val) return ''
              // Resolve UUID or legacy ID to display name
              const name = userNameMap.get(val) || str(client.agent_name) || val
              // Reverse "Last, First" → "First Last" for legacy data
              if (name.includes(',')) {
                const [last, first] = name.split(',').map(s => s.trim())
                if (first && last) return `${first} ${last}`
              }
              return name
            }}
          />
          <InlineField
            label="Book of Business"
            value={str(client.book_of_business)}
            fieldKey="book_of_business"
            docPath={docPath}
            type="select"
            options={bobOptions}
          />
          <InlineField
            label="Source"
            value={str(client.source)}
            fieldKey="source"
            docPath={docPath}
            type="select"
            options={SOURCE_OPTIONS}
          />
          <InlineField
            label="Classification"
            value={str(client.client_classification)}
            fieldKey="client_classification"
            docPath={docPath}
            type="select"
            options={CLASSIFICATION_OPTIONS}
          />
          <InlineField
            label="Country"
            value={str(client.country)}
            fieldKey="country"
            docPath={docPath}
          />
          {str(client.cof_member_id) && (
            <InlineField
              label="CoF Member ID"
              value={str(client.cof_member_id)}
              fieldKey="cof_member_id"
              docPath={docPath}
              mono
            />
          )}
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
