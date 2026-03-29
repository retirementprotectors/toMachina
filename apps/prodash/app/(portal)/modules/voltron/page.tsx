import type { Metadata } from 'next'
import { AppWrapper } from '@tomachina/ui'
import { VoltronDualMode } from './voltron-dual-mode'

export const metadata: Metadata = { title: 'VOLTRON' }

export default function VoltronPage() {
  return (
    <AppWrapper appKey="voltron">
      <VoltronDualMode />
    </AppWrapper>
  )
}
