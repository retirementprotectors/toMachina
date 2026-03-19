import type { Metadata } from 'next'
import { LeadershipCenter, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Leadership Center' }
export default function LeadershipPage() {
  return (
    <AppWrapper appKey="leadership-center">
      <LeadershipCenter />
    </AppWrapper>
  )
}
