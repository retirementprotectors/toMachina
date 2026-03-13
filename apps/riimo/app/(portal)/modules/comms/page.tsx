import { CommsCenter, AppWrapper } from '@tomachina/ui'

export default function CommsPage() {
  return (
    <AppWrapper appKey="comms">
      <CommsCenter portal="riimo" />
    </AppWrapper>
  )
}
