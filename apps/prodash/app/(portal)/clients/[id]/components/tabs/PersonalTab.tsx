'use client'

import type { Client } from '@tomachina/core'
import { maskSSN, formatBirthday, formatMedicareDate, formatLicenseDate, getAge, str } from '../../lib/formatters'
import { InlineField, InlineSection, ReadOnlyField } from '../../lib/inline-edit'
import { FieldGrid } from '../../lib/ui-helpers'

interface PersonalTabProps {
  client: Client
  clientId: string
}

const MARITAL_OPTIONS = [
  { label: 'Single', value: 'Single' },
  { label: 'Married', value: 'Married' },
  { label: 'Divorced', value: 'Divorced' },
  { label: 'Widowed', value: 'Widowed' },
  { label: 'Domestic Partner', value: 'Domestic Partner' },
]

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Non-Binary', value: 'Non-Binary' },
  { label: 'Prefer Not to Say', value: 'Prefer Not to Say' },
]

const EMPLOYMENT_OPTIONS = [
  { label: 'Employed', value: 'Employed' },
  { label: 'Self-Employed', value: 'Self-Employed' },
  { label: 'Retired', value: 'Retired' },
  { label: 'Unemployed', value: 'Unemployed' },
  { label: 'Student', value: 'Student' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
].map((s) => ({ label: s, value: s }))

export function PersonalTab({ client, clientId }: PersonalTabProps) {
  const docPath = `clients/${clientId}`
  const age = getAge(client.dob)

  return (
    <div className="space-y-4">
      {/* Personal Details — DF-15: removed duplicate age display (already in header) */}
      <InlineSection title="Personal Details" icon="badge">
        <FieldGrid cols={4}>
          <InlineField label="First Name" value={str(client.first_name)} fieldKey="first_name" docPath={docPath} />
          <InlineField label="Middle Name" value={str(client.middle_name)} fieldKey="middle_name" docPath={docPath} />
          <InlineField label="Last Name" value={str(client.last_name)} fieldKey="last_name" docPath={docPath} />
          <InlineField label="Preferred Name" value={str(client.preferred_name)} fieldKey="preferred_name" docPath={docPath} />
          <InlineField label="Date of Birth" value={str(client.dob)} fieldKey="dob" docPath={docPath} type="date" formatDisplay={formatBirthday} />
          <InlineField
            label="Marital Status"
            value={str(client.marital_status)}
            fieldKey="marital_status"
            docPath={docPath}
            type="select"
            options={MARITAL_OPTIONS}
          />
          <InlineField
            label="Gender"
            value={str(client.gender)}
            fieldKey="gender"
            docPath={docPath}
            type="select"
            options={GENDER_OPTIONS}
          />
          {/* SSN — masked, read-only */}
          <ReadOnlyField label="SSN (Last 4)" value={maskSSN(client.ssn || client.ssn_last4)} mono />
        </FieldGrid>
      </InlineSection>

      {/* Employment */}
      <InlineSection title="Employment" icon="work">
        <FieldGrid cols={3}>
          <InlineField
            label="Employment Status"
            value={str(client.employment_status)}
            fieldKey="employment_status"
            docPath={docPath}
            type="select"
            options={EMPLOYMENT_OPTIONS}
          />
          <InlineField label="Occupation" value={str(client.occupation)} fieldKey="occupation" docPath={docPath} />
          {/* DF-16: Former Occupation only shows when status = Retired */}
          {str(client.employment_status).toLowerCase() === 'retired' && (
            <InlineField label="Former Occupation" value={str(client.former_occupation)} fieldKey="former_occupation" docPath={docPath} />
          )}
          <InlineField label="Annual Income" value={str(client.annual_income)} fieldKey="annual_income" docPath={docPath} type="number" />
          <InlineField label="Employer" value={str(client.employer)} fieldKey="employer" docPath={docPath} />
        </FieldGrid>
      </InlineSection>

      {/* Medicare Card Info (consolidated from removed Medicare tab) */}
      <InlineSection title="Medicare Card Info" icon="local_hospital">
        <FieldGrid cols={3}>
          <InlineField
            label="Medicare Beneficiary ID"
            value={str(client.medicare_number || client.medicare_beneficiary_id)}
            fieldKey="medicare_beneficiary_id"
            docPath={docPath}
            mono
          />
          <InlineField
            label="Part A Effective Date"
            value={str(client.part_a_effective_date)}
            fieldKey="part_a_effective_date"
            docPath={docPath}
            type="date"
            formatDisplay={formatMedicareDate}
          />
          <InlineField
            label="Part B Effective Date"
            value={str(client.part_b_effective_date)}
            fieldKey="part_b_effective_date"
            docPath={docPath}
            type="date"
            formatDisplay={formatMedicareDate}
          />
        </FieldGrid>
      </InlineSection>

      {/* Driver's License Info (consolidated from removed Financial tab) */}
      <InlineSection title="Driver's License Info" icon="badge">
        <FieldGrid cols={3}>
          <InlineField
            label="DL Number"
            value={str(client.dl_number)}
            fieldKey="dl_number"
            docPath={docPath}
            mono
          />
          <InlineField
            label="DL State"
            value={str(client.dl_state)}
            fieldKey="dl_state"
            docPath={docPath}
            type="select"
            options={US_STATES}
          />
          <InlineField
            label="DL Expiration"
            value={str(client.dl_expiration)}
            fieldKey="dl_expiration"
            docPath={docPath}
            type="date"
            formatDisplay={formatLicenseDate}
          />
        </FieldGrid>
      </InlineSection>
    </div>
  )
}
