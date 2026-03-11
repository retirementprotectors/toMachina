'use client'

import type { Client } from '@tomachina/core'
import { yesNo } from '../../lib/formatters'
import { SectionCard, YesNoIndicator, EditableField } from '../../lib/ui-helpers'

interface EstateTabProps {
  client: Client
  editing?: boolean
  editData?: Record<string, unknown>
  onFieldChange?: (key: string, value: string) => void
}

const YES_NO_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Not specified', value: '' },
]

export function EstateTab({ client, editing = false, editData = {}, onFieldChange }: EstateTabProps) {
  const ev = (key: string) => (editData[key] !== undefined ? String(editData[key]) : undefined)

  if (editing) {
    return (
      <div className="space-y-4">
        <SectionCard title="Estate Planning" icon="gavel">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <EditableField label="Has Trust" value={yesNo(client.has_trust)} fieldKey="has_trust" editing={editing} editValue={ev('has_trust')} onChange={onFieldChange} type="select" options={YES_NO_OPTIONS} />
            <EditableField label="Will Exists" value={yesNo(client.will_exists)} fieldKey="will_exists" editing={editing} editValue={ev('will_exists')} onChange={onFieldChange} type="select" options={YES_NO_OPTIONS} />
            <EditableField label="Financial POA" value={yesNo(client.financial_poa)} fieldKey="financial_poa" editing={editing} editValue={ev('financial_poa')} onChange={onFieldChange} type="select" options={YES_NO_OPTIONS} />
            <EditableField label="Healthcare POA" value={yesNo(client.healthcare_poa)} fieldKey="healthcare_poa" editing={editing} editValue={ev('healthcare_poa')} onChange={onFieldChange} type="select" options={YES_NO_OPTIONS} />
            <EditableField label="Beneficiary Deed" value={yesNo(client.beneficiary_deed)} fieldKey="beneficiary_deed" editing={editing} editValue={ev('beneficiary_deed')} onChange={onFieldChange} type="select" options={YES_NO_OPTIONS} />
          </div>
        </SectionCard>
      </div>
    )
  }

  // Completeness score
  const items = [
    { key: 'has_trust', label: 'Has Trust' },
    { key: 'will_exists', label: 'Will Exists' },
    { key: 'financial_poa', label: 'Financial POA' },
    { key: 'healthcare_poa', label: 'Healthcare POA' },
    { key: 'beneficiary_deed', label: 'Beneficiary Deed' },
  ]
  const yesCount = items.filter((item) => yesNo(client[item.key]) === 'Yes').length
  const specifiedCount = items.filter((item) => yesNo(client[item.key]) !== '').length
  const completeness = specifiedCount > 0 ? Math.round((yesCount / items.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Completeness Score */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Estate Planning Completeness</p>
            <p className="text-xs text-[var(--text-muted)]">{yesCount} of {items.length} documents in place</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-32 overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completeness}%`,
                  backgroundColor: completeness >= 80 ? 'var(--success)' : completeness >= 40 ? 'var(--warning)' : 'var(--error)',
                }}
              />
            </div>
            <span className={`text-lg font-bold ${completeness >= 80 ? 'text-emerald-400' : completeness >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {completeness}%
            </span>
          </div>
        </div>

        {/* Missing items alert */}
        {completeness < 100 && (
          <div className="mt-3 rounded-md bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <span className="material-icons-outlined text-[14px]">warning</span>
              Missing: {items.filter((item) => yesNo(client[item.key]) !== 'Yes').map((item) => item.label).join(', ')}
            </div>
          </div>
        )}
      </div>

      <SectionCard title="Estate Planning" icon="gavel">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <YesNoIndicator label="Has Trust" value={yesNo(client.has_trust)} />
          <YesNoIndicator label="Will Exists" value={yesNo(client.will_exists)} />
          <YesNoIndicator label="Financial POA" value={yesNo(client.financial_poa)} />
          <YesNoIndicator label="Healthcare POA" value={yesNo(client.healthcare_poa)} />
          <YesNoIndicator label="Beneficiary Deed" value={yesNo(client.beneficiary_deed)} />
        </div>
      </SectionCard>
    </div>
  )
}
