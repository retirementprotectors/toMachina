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

  return (
    <div className="space-y-4">
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
