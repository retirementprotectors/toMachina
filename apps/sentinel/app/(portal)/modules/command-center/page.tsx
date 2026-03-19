import type { Metadata } from 'next'
import { CommandCenter, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Command Center' }
export default function CommandCenterPage() {
  return (
    <AppWrapper appKey="command-center">
      <CommandCenter portal="sentinel" />
    </AppWrapper>
  )
}
