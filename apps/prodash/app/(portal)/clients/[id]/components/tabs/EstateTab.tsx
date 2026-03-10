'use client'

import type { Client } from '@tomachina/core'
import { yesNo } from '../../lib/formatters'
import { SectionCard, YesNoIndicator } from '../../lib/ui-helpers'

interface EstateTabProps {
  client: Client
}

export function EstateTab({ client }: EstateTabProps) {
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
