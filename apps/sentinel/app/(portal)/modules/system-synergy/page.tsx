import type { Metadata } from 'next'
import { SystemSynergy, AppWrapper } from '@tomachina/ui'

export const metadata: Metadata = { title: 'System Synergy' }

export default function SystemSynergyPage() {
  return (
    <AppWrapper appKey="system-synergy">
      <SystemSynergy portal="sentinel" />
    </AppWrapper>
  )
}
