import type { Metadata } from 'next'
import { Guardian } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Guardian' }
export default function GuardianPage() {
  return <Guardian portal="SENTINEL" />
}
