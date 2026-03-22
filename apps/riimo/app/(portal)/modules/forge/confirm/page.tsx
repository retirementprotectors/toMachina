import type { Metadata } from 'next'
import { ForgeConfirmWalkthrough, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'FORGE — Confirm Walkthrough' }
export default function ForgeConfirmPage() {
  return (
    <AppWrapper appKey="forge">
      <ForgeConfirmWalkthrough portal="riimo" />
    </AppWrapper>
  )
}
