import type { Metadata } from 'next'
import { DexDocCenter, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'DEX' }
export default function DexPage() {
  return (
    <AppWrapper appKey="dex">
      <DexDocCenter portal="prodashx" />
    </AppWrapper>
  )
}
