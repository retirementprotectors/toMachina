'use client'

import type { Client } from '@tomachina/core'
import { maskSSN, formatDate, getAge, str } from '../../lib/formatters'
import { SectionCard, DetailField, FieldGrid } from '../../lib/ui-helpers'

interface PersonalTabProps {
  client: Client
}

export function PersonalTab({ client }: PersonalTabProps) {
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
      {/* Identity */}
      <SectionCard title="Identity" icon="badge">
        <FieldGrid cols={4}>
          <DetailField label="First Name" value={str(client.first_name)} />
          <DetailField label="Middle Name" value={str(client.middle_name)} />
          <DetailField label="Last Name" value={str(client.last_name)} />
          <DetailField label="Preferred Name" value={str(client.preferred_name)} />
          <DetailField label="Date of Birth" value={formatDate(client.dob)} />
          <DetailField label="Age" value={getAge(client.dob) ?? undefined} />
          <DetailField label="Gender" value={str(client.gender)} />
          <DetailField label="Marital Status" value={str(client.marital_status)} />
        </FieldGrid>
      </SectionCard>

      {/* Government IDs */}
      <SectionCard title="Government IDs" icon="lock">
        <FieldGrid cols={2}>
          <DetailField label="SSN" value={maskSSN(client.ssn || client.ssn_last4)} mono />
          <DetailField label="Medicare Number" value={str(client.medicare_number)} mono />
        </FieldGrid>
      </SectionCard>

      {/* Employment */}
      <SectionCard title="Employment" icon="work">
        <FieldGrid cols={3}>
          <DetailField label="Employment Status" value={str(client.employment_status)} />
          <DetailField label="Occupation" value={str(client.occupation)} />
          <DetailField label="Former Occupation" value={str(client.former_occupation)} />
          <DetailField label="Employer" value={str(client.employer)} />
          <DetailField label="Annual Income" value={str(client.annual_income)} />
        </FieldGrid>
      </SectionCard>

      {/* Spouse */}
      <SectionCard title="Spouse" icon="favorite">
        {spouseName ? (
          <FieldGrid cols={3}>
            <DetailField label="Name" value={spouseName} />
            <DetailField label="Date of Birth" value={formatDate(client.spouse_dob)} />
            <DetailField
              label="Age"
              value={getAge(client.spouse_dob) ?? undefined}
            />
            <DetailField label="Email" value={str(client.spouse_email)} />
            <DetailField label="Phone" value={str(client.spouse_phone)} />
            <DetailField label="Occupation" value={str(client.spouse_occupation)} />
            <DetailField label="Wedding Date" value={formatDate(client.wedding_date)} />
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
