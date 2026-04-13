import type { Metadata } from 'next'
import { PageGuard } from './guard'
export const metadata: Metadata = { title: 'Guardian' }
export default function GuardianPage() {
  return <PageGuard />
}
