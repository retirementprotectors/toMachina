import type { Metadata } from 'next'
import { CommsCenter, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Communications' }
export default function CommsPage() {
  return (
    <AppWrapper appKey="comms">
      <CommsCenter portal="riimo" />
    </AppWrapper>
  )
}
