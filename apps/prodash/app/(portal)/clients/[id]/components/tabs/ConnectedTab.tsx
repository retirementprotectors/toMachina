'use client'

import type { Client } from '@tomachina/core'
import { formatDate, formatPhone, getAge, str } from '../../lib/formatters'
import { SectionCard, DetailField, FieldGrid, EmptyState } from '../../lib/ui-helpers'

interface ConnectedTabProps {
  client: Client
}

export function ConnectedTab({ client }: ConnectedTabProps) {
  const spouseName = [str(client.spouse_first_name), str(client.spouse_last_name)]
    .filter(Boolean)
    .join(' ')

  // Collect children from indexed fields
  const children: { name: string; index: number }[] = []
  for (let i = 1; i <= 6; i++) {
    const name = str(client[`child_${i}_name`])
    if (name) children.push({ name, index: i })
  }

  const hasConnected = Boolean(spouseName) || children.length > 0

  if (!hasConnected) {
    return <EmptyState icon="people" message="No connected family members on file." />
  }

  return (
    <div className="space-y-4">
      {/* Spouse card */}
      {spouseName && (
        <SectionCard title="Spouse" icon="favorite">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--portal-glow)] text-sm font-bold text-[var(--portal)]">
              {spouseName
                .split(' ')
                .map((w) => w.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1">
              <h4 className="mb-3 text-base font-semibold text-[var(--text-primary)]">{spouseName}</h4>
              <FieldGrid cols={3}>
                <DetailField label="Date of Birth" value={formatDate(client.spouse_dob)} />
                <DetailField label="Age" value={getAge(client.spouse_dob) ?? undefined} />
                <DetailField label="Email" value={str(client.spouse_email)} />
                <DetailField label="Phone" value={formatPhone(client.spouse_phone)} />
                <DetailField label="Occupation" value={str(client.spouse_occupation)} />
                <DetailField label="Wedding Date" value={formatDate(client.wedding_date)} />
              </FieldGrid>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Children cards */}
      {children.length > 0 && (
        <SectionCard title="Children" icon="child_care">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <div
                key={child.index}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-glow)] text-xs font-bold text-[var(--portal)]">
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{child.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">Child {child.index}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
