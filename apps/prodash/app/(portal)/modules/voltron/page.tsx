import type { Metadata } from 'next'
import { AppWrapper } from '@tomachina/ui'
import { VoltronMode1 } from './voltron-mode1'

export const metadata: Metadata = { title: 'VOLTRON' }

export default function VoltronPage() {
  return (
    <AppWrapper appKey="voltron">
      <VoltronMode1 />
    </AppWrapper>
  )
}
