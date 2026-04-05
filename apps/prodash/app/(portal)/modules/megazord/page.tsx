import type { Metadata } from 'next'
import { MegazordCommandCenter, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'MEGAZORD' }
export default function MegazordPage() {
  return (
    <AppWrapper appKey="megazord">
      <MegazordCommandCenter portal="prodashx" />
    </AppWrapper>
  )
}
