import type { Metadata } from 'next'
import { ActionQueue } from '@tomachina/ui'

export const metadata: Metadata = { title: 'Action Queue' }

export default function QueuePage() {
  return <ActionQueue portal="prodashx" />
}
