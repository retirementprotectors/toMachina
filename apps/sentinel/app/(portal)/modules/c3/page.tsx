import type { Metadata } from 'next'
import { C3Manager, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'C3' }
export default function C3Page() {
  return (
    <AppWrapper appKey="c3">
      <C3Manager portal="sentinel" />
    </AppWrapper>
  )
}
