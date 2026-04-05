import type { Metadata } from 'next'
import { AtlasRegistry, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'ATLAS' }
export default function AtlasPage() {
  return (
    <AppWrapper appKey="atlas">
      <AtlasRegistry portal="prodashx" />
    </AppWrapper>
  )
}
