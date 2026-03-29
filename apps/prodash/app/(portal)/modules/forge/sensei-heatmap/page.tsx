import type { Metadata } from 'next'
import { SenseiHeatmap, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'SENSEI Heat Map' }
export default function SenseiHeatmapPage() {
  return (
    <AppWrapper appKey="forge">
      <SenseiHeatmap portal="prodashx" />
    </AppWrapper>
  )
}
