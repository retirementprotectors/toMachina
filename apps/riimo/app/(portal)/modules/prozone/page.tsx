import type { Metadata } from 'next'
import { ProZone, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'ProZone' }
export default function ProZonePage() {
  return (
    <AppWrapper appKey="prozone">
      <ProZone portal="riimo" />
    </AppWrapper>
  )
}
