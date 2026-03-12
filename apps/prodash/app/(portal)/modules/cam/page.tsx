import { CamDashboard, AppWrapper } from '@tomachina/ui'

export default function CamPage() {
  return (
    <AppWrapper appKey="cam">
      <CamDashboard portal="prodashx" />
    </AppWrapper>
  )
}
