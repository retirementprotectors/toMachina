'use client'

import type { Client } from '@tomachina/core'
import { maskSSN, formatDate, getAge, str } from '../../lib/formatters'
import { SectionCard, DetailField, EditableField, FieldGrid } from '../../lib/ui-helpers'

interface PersonalTabProps {
  client: Client
  editing?: boolean
  editData?: Record<string, unknown>
  onFieldChange?: (key: string, value: string) => void
}

export function PersonalTab({ client, editing = false, editData = {}, onFieldChange }: PersonalTabProps) {
  const ev = (key: string) => (editData[key] !== undefined ? String(editData[key]) : undefined)
  const spouseName = [str(client.spouse_first_name), str(client.spouse_last_name)]
    .filter(Boolean)
    .join(' ')

  // Collect children names from indexed fields (child_1_name through child_6_name)
  const children: string[] = []
  for (let i = 1; i <= 6; i++) {
    const name = str(client[`child_${i}_name`])
    if (name) children.push(name)
  }

  return (
    <div className="space-y-4">
      {/* Identity — with prominent age display */}
      <SectionCard title="Identity" icon="badge">
        {!editing && getAge(client.dob) && (
          <div className="mb-4 flex items-center gap-4 rounded-lg bg-[var(--bg-surface)] px-4 py-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--portal-glow)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--portal)' }}>{getAge(client.dob)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(client.dob)}</p>
              <p className="text-xs text-[var(--text-muted)]">Date of Birth &middot; Age {getAge(client.dob)}</p>
            </div>
          </div>
        )}
        <FieldGrid cols={4}>
          <EditableField label="First Name" value={str(client.first_name)} fieldKey="first_name" editing={editing} editValue={ev('first_name')} onChange={onFieldChange} />
          <EditableField label="Middle Name" value={str(client.middle_name)} fieldKey="middle_name" editing={editing} editValue={ev('middle_name')} onChange={onFieldChange} />
          <EditableField label="Last Name" value={str(client.last_name)} fieldKey="last_name" editing={editing} editValue={ev('last_name')} onChange={onFieldChange} />
          <EditableField label="Preferred Name" value={str(client.preferred_name)} fieldKey="preferred_name" editing={editing} editValue={ev('preferred_name')} onChange={onFieldChange} />
          {editing && <EditableField label="Date of Birth" value={formatDate(client.dob)} fieldKey="dob" editing={editing} editValue={ev('dob')} onChange={onFieldChange} type="date" />}
          {editing && <DetailField label="Age" value={getAge(client.dob) ?? undefined} />}
          <EditableField label="Gender" value={str(client.gender)} fieldKey="gender" editing={editing} editValue={ev('gender')} onChange={onFieldChange} type="select" options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
          <EditableField label="Marital Status" value={str(client.marital_status)} fieldKey="marital_status" editing={editing} editValue={ev('marital_status')} onChange={onFieldChange} type="select" options={[{ label: 'Single', value: 'Single' }, { label: 'Married', value: 'Married' }, { label: 'Divorced', value: 'Divorced' }, { label: 'Widowed', value: 'Widowed' }]} />
        </FieldGrid>
      </SectionCard>

      {/* Government IDs — SSN is NEVER editable */}
      <SectionCard title="Government IDs" icon="lock">
        <FieldGrid cols={2}>
          <DetailField label="SSN" value={maskSSN(client.ssn || client.ssn_last4)} mono />
          <DetailField label="Medicare Number" value={str(client.medicare_number)} mono />
        </FieldGrid>
      </SectionCard>

      {/* Employment */}
      <SectionCard title="Employment" icon="work">
        <FieldGrid cols={3}>
          <EditableField label="Employment Status" value={str(client.employment_status)} fieldKey="employment_status" editing={editing} editValue={ev('employment_status')} onChange={onFieldChange} type="select" options={[{ label: 'Employed', value: 'Employed' }, { label: 'Retired', value: 'Retired' }, { label: 'Self-Employed', value: 'Self-Employed' }, { label: 'Unemployed', value: 'Unemployed' }]} />
          <EditableField label="Occupation" value={str(client.occupation)} fieldKey="occupation" editing={editing} editValue={ev('occupation')} onChange={onFieldChange} />
          <EditableField label="Former Occupation" value={str(client.former_occupation)} fieldKey="former_occupation" editing={editing} editValue={ev('former_occupation')} onChange={onFieldChange} />
          <EditableField label="Employer" value={str(client.employer)} fieldKey="employer" editing={editing} editValue={ev('employer')} onChange={onFieldChange} />
          <EditableField label="Annual Income" value={str(client.annual_income)} fieldKey="annual_income" editing={editing} editValue={ev('annual_income')} onChange={onFieldChange} />
        </FieldGrid>
      </SectionCard>

      {/* Spouse */}
      <SectionCard title="Spouse" icon="favorite">
        {editing || spouseName ? (
          <FieldGrid cols={3}>
            <EditableField label="First Name" value={str(client.spouse_first_name)} fieldKey="spouse_first_name" editing={editing} editValue={ev('spouse_first_name')} onChange={onFieldChange} />
            <EditableField label="Last Name" value={str(client.spouse_last_name)} fieldKey="spouse_last_name" editing={editing} editValue={ev('spouse_last_name')} onChange={onFieldChange} />
            <EditableField label="Date of Birth" value={formatDate(client.spouse_dob)} fieldKey="spouse_dob" editing={editing} editValue={ev('spouse_dob')} onChange={onFieldChange} type="date" />
            <DetailField label="Age" value={getAge(client.spouse_dob) ?? undefined} />
            <EditableField label="Email" value={str(client.spouse_email)} fieldKey="spouse_email" editing={editing} editValue={ev('spouse_email')} onChange={onFieldChange} type="email" />
            <EditableField label="Phone" value={str(client.spouse_phone)} fieldKey="spouse_phone" editing={editing} editValue={ev('spouse_phone')} onChange={onFieldChange} type="tel" />
            <EditableField label="Occupation" value={str(client.spouse_occupation)} fieldKey="spouse_occupation" editing={editing} editValue={ev('spouse_occupation')} onChange={onFieldChange} />
            <EditableField label="Wedding Date" value={formatDate(client.wedding_date)} fieldKey="wedding_date" editing={editing} editValue={ev('wedding_date')} onChange={onFieldChange} type="date" />
          </FieldGrid>
        ) : (
          <p className="text-sm text-[var(--text-muted)] italic">No spouse on file</p>
        )}
      </SectionCard>

      {/* Children */}
      <SectionCard title="Children" icon="child_care">
        {children.length > 0 ? (
          <div className="space-y-2">
            <DetailField
              label="Has Children"
              value={str(client.has_children) || 'Yes'}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {children.map((name, i) => (
                <span
                  key={i}
                  className="rounded-full border border-[var(--border-medium)] px-3 py-1 text-sm text-[var(--text-primary)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <FieldGrid cols={2}>
            <DetailField label="Has Children" value={str(client.has_children) || 'Not specified'} />
          </FieldGrid>
        )}
      </SectionCard>
    </div>
  )
}
