import type { Metadata } from 'next'
import { MusashiCommandCenter, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'MUSASHI' }
export default function MusashiPage() {
  return (
    <AppWrapper appKey="musashi">
      <MusashiCommandCenter portal="sentinel" />
    </AppWrapper>
  )
}
