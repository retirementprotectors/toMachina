import type { Metadata } from 'next'
import { ForgeAudit, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'FORGE Audit' }
export default function ForgeAuditPage() {
  return (
    <AppWrapper appKey="forge">
      <ForgeAudit portal="prodashx" />
    </AppWrapper>
  )
}
