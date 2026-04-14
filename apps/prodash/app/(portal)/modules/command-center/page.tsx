import type { Metadata } from 'next'
import { CommandCenterPage, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Command Center' }
export default function CommandCenterRoute() {
  return (
    <AppWrapper appKey="voltron">
      <CommandCenterPage portal="prodashx" />
    </AppWrapper>
  )
}
