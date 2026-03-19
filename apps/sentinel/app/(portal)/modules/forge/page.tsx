import type { Metadata } from 'next'
import { Forge, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'FORGE' }
export default function ForgePage() {
  return (
    <AppWrapper appKey="forge">
      <Forge portal="sentinel" />
    </AppWrapper>
  )
}
