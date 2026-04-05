import type { Metadata } from 'next'
import { CommandCenterPage, AppWrapper } from '@tomachina/ui'

export const metadata: Metadata = { title: 'VOLTRON Command Center' }

export default function VoltronCommandCenterPage() {
  return (
    <AppWrapper appKey="voltron">
      <CommandCenterPage portal="riimo" />
    </AppWrapper>
  )
}
