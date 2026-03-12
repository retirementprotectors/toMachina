import { CommandCenter, AppWrapper } from '@tomachina/ui'

export default function CommandCenterPage() {
  return (
    <AppWrapper appKey="command-center">
      <CommandCenter portal="sentinel" />
    </AppWrapper>
  )
}
