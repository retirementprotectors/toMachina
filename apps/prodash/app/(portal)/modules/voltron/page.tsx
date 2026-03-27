import type { Metadata } from 'next'
import { VoltronApp, AppWrapper } from '@tomachina/ui'

export const metadata: Metadata = { title: 'VOLTRON' }

export default function VoltronPage() {
  return (
    <AppWrapper appKey="voltron">
      <VoltronApp portal="prodashx" />
    </AppWrapper>
  )
}
