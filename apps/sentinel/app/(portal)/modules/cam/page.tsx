import type { Metadata } from 'next'
import { CamDashboard, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'CAM' }
export default function CamPage() {
  return (
    <AppWrapper appKey="cam">
      <CamDashboard portal="sentinel" />
    </AppWrapper>
  )
}
