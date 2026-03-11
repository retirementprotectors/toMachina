'use client'

import type { Client } from '@tomachina/core'
import { str } from '../../lib/formatters'
import { SectionCard, DetailField, EditableField, FieldGrid } from '../../lib/ui-helpers'

interface HealthTabProps {
  client: Client
  editing?: boolean
  editData?: Record<string, unknown>
  onFieldChange?: (key: string, value: string) => void
}

export function HealthTab({ client, editing = false, editData = {}, onFieldChange }: HealthTabProps) {
  const ev = (key: string) => (editData[key] !== undefined ? String(editData[key]) : undefined)

  return (
    <div className="space-y-4">
      {/* Tobacco */}
      <SectionCard title="Tobacco Use" icon="smoke_free">
        <FieldGrid cols={3}>
          {editing ? (
            <EditableField label="Tobacco User" value={str(client.tobacco_user)} fieldKey="tobacco_user" editing={editing} editValue={ev('tobacco_user')} onChange={onFieldChange} type="select" options={[{label:'Yes',value:'Yes'},{label:'No',value:'No'}]} />
          ) : (
            <TobaccoIndicator value={client.tobacco_user} />
          )}
          {editing ? (
            <EditableField label="Tobacco Type" value={str(client.tobacco_type)} fieldKey="tobacco_type" editing={editing} editValue={ev('tobacco_type')} onChange={onFieldChange} />
          ) : (
            <DetailField label="Tobacco Type" value={str(client.tobacco_type)} />
          )}
          {editing ? (
            <EditableField label="Frequency" value={str(client.tobacco_frequency)} fieldKey="tobacco_frequency" editing={editing} editValue={ev('tobacco_frequency')} onChange={onFieldChange} />
          ) : (
            <DetailField label="Frequency" value={str(client.tobacco_frequency)} />
          )}
        </FieldGrid>
      </SectionCard>

      {/* Physical */}
      <SectionCard title="Physical" icon="monitor_weight">
        <FieldGrid cols={2}>
          {editing ? (
            <EditableField label="Height" value={formatHeight(client.height)} fieldKey="height" editing={editing} editValue={ev('height')} onChange={onFieldChange} />
          ) : (
            <DetailField label="Height" value={formatHeight(client.height)} />
          )}
          {editing ? (
            <EditableField label="Weight" value={formatWeight(client.weight)} fieldKey="weight" editing={editing} editValue={ev('weight')} onChange={onFieldChange} />
          ) : (
            <DetailField label="Weight" value={formatWeight(client.weight)} />
          )}
        </FieldGrid>
      </SectionCard>

      {/* Conditions */}
      <SectionCard title="Health Conditions" icon="medical_information">
        <div className="space-y-4">
          {editing ? (
            <>
              <EditableField label="Health Conditions" value={str(client.health_conditions)} fieldKey="health_conditions" editing={editing} editValue={ev('health_conditions')} onChange={onFieldChange} />
              <EditableField label="Family History" value={str(client.family_history)} fieldKey="family_history" editing={editing} editValue={ev('family_history')} onChange={onFieldChange} />
              <EditableField label="Recent Concerns" value={str(client.recent_concerns)} fieldKey="recent_concerns" editing={editing} editValue={ev('recent_concerns')} onChange={onFieldChange} />
            </>
          ) : (
            <>
              <ConditionBlock label="Health Conditions" value={str(client.health_conditions)} />
              <ConditionBlock label="Family History" value={str(client.family_history)} />
              <ConditionBlock label="Recent Concerns" value={str(client.recent_concerns)} />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TobaccoIndicator({ value }: { value: unknown }) {
  const raw = str(value).toLowerCase()
  const isUser = raw === 'yes' || raw === 'true' || raw === '1'
  const isNonUser = raw === 'no' || raw === 'false' || raw === '0'

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Tobacco User</dt>
      <dd className="mt-1">
        {isUser ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-400">
            <span className="material-icons-outlined text-[14px]">warning</span>
            Yes
          </span>
        ) : isNonUser ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-400">
            <span className="material-icons-outlined text-[14px]">check_circle</span>
            No
          </span>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">&mdash;</span>
        )}
      </dd>
    </div>
  )
}

function ConditionBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1.5">
        {value ? (
          <p className="rounded-lg bg-[var(--bg-surface)] p-3 text-sm leading-relaxed text-[var(--text-primary)]">
            {value}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">&mdash;</p>
        )}
      </dd>
    </div>
  )
}

function formatHeight(raw: unknown): string {
  if (!raw) return ''
  const val = str(raw)
  // If it is already formatted (e.g., 5 foot 10), pass through
  if (val.includes("'") || val.includes('ft')) return val
  // If numeric (inches), convert
  const inches = parseInt(val, 10)
  if (!isNaN(inches) && inches > 0) {
    const ft = Math.floor(inches / 12)
    const rem = inches % 12
    return `${ft}'${rem}"`
  }
  return val
}

function formatWeight(raw: unknown): string {
  if (!raw) return ''
  const val = str(raw)
  const num = parseFloat(val)
  if (!isNaN(num)) return `${Math.round(num)} lbs`
  return val
}
