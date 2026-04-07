import type { Metadata } from 'next'
import { AppWrapper, CommandCenterPage } from '@tomachina/ui'

export const metadata: Metadata = { title: 'VOLTRON' }

export default function VoltronPage() {
  return (
    <AppWrapper appKey="voltron">
      <CommandCenterPage portal="prodash" />
    </AppWrapper>
  )
}
