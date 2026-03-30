import type { Metadata } from 'next'
import { Forge, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'The Dojo' }
export default function ForgePage() {
  return (
    <AppWrapper appKey="forge">
      <Forge portal="prodashx" />
    </AppWrapper>
  )
}
