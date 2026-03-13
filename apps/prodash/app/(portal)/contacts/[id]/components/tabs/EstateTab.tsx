'use client'

import type { Client } from '@tomachina/core'
import { yesNo, str } from '../../lib/formatters'
import { InlineField, InlineSection } from '../../lib/inline-edit'
import { YesNoIndicator } from '../../lib/ui-helpers'

interface EstateTabProps {
  client: Client
  clientId: string
}

const YES_NO_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
  { label: 'Not specified', value: '' },
]

const TRUST_TYPE_OPTIONS = [
  { label: 'Revocable Living Trust', value: 'Revocable Living Trust' },
  { label: 'Irrevocable Trust', value: 'Irrevocable Trust' },
  { label: 'Testamentary Trust', value: 'Testamentary Trust' },
  { label: 'Other', value: 'Other' },
]

const WILL_TYPE_OPTIONS = [
  { label: 'Simple Will', value: 'Simple Will' },
  { label: 'Pour-Over Will', value: 'Pour-Over Will' },
  { label: 'Testamentary Trust Will', value: 'Testamentary Trust Will' },
  { label: 'Other', value: 'Other' },
]

export function EstateTab({ client, clientId }: EstateTabProps) {
  const docPath = `clients/${clientId}`

  // Completeness score
  const items = [
    { key: 'has_trust', label: 'Has Trust' },
    { key: 'will_exists', label: 'Will Exists' },
    { key: 'financial_poa', label: 'Financial POA' },
    { key: 'healthcare_poa', label: 'Healthcare POA' },
    { key: 'beneficiary_deed', label: 'Beneficiary Deed' },
  ]
  const yesCount = items.filter((item) => yesNo(client[item.key]) === 'Yes').length
  const completeness = Math.round((yesCount / items.length) * 100)

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

        {completeness < 100 && (
          <div className="mt-3 rounded-md bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <span className="material-icons-outlined text-[14px]">warning</span>
              Missing: {items.filter((item) => yesNo(client[item.key]) !== 'Yes').map((item) => item.label).join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Trust */}
      <InlineSection title="Trust" icon="gavel">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <InlineField
            label="Has Trust"
            value={yesNo(client.has_trust)}
            fieldKey="has_trust"
            docPath={docPath}
            type="select"
            options={YES_NO_OPTIONS}
          />
          <InlineField
            label="Trust Type"
            value={str(client.trust_type)}
            fieldKey="trust_type"
            docPath={docPath}
            type="select"
            options={TRUST_TYPE_OPTIONS}
          />
          <InlineField label="Trust Name" value={str(client.trust_name)} fieldKey="trust_name" docPath={docPath} />
          <InlineField label="Trust Date" value={str(client.trust_date)} fieldKey="trust_date" docPath={docPath} type="date" />
        </div>
      </InlineSection>

      {/* POA + Will */}
      <InlineSection title="Power of Attorney & Will" icon="description">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <InlineField
            label="Financial POA"
            value={yesNo(client.financial_poa)}
            fieldKey="financial_poa"
            docPath={docPath}
            type="select"
            options={YES_NO_OPTIONS}
          />
          <InlineField label="Financial POA Name" value={str(client.financial_poa_name)} fieldKey="financial_poa_name" docPath={docPath} />
          <InlineField
            label="Healthcare POA"
            value={yesNo(client.healthcare_poa)}
            fieldKey="healthcare_poa"
            docPath={docPath}
            type="select"
            options={YES_NO_OPTIONS}
          />
          <InlineField label="Healthcare POA Name" value={str(client.healthcare_poa_name)} fieldKey="healthcare_poa_name" docPath={docPath} />
          <InlineField
            label="Beneficiary Deed"
            value={yesNo(client.beneficiary_deed)}
            fieldKey="beneficiary_deed"
            docPath={docPath}
            type="select"
            options={YES_NO_OPTIONS}
          />
          <InlineField
            label="Will Exists"
            value={yesNo(client.will_exists)}
            fieldKey="will_exists"
            docPath={docPath}
            type="select"
            options={YES_NO_OPTIONS}
          />
          <InlineField
            label="Will Type"
            value={str(client.will_type)}
            fieldKey="will_type"
            docPath={docPath}
            type="select"
            options={WILL_TYPE_OPTIONS}
          />
        </div>
      </InlineSection>
    </div>
  )
}
