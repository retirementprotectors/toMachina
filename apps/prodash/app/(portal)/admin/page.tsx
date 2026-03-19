import type { Metadata } from 'next'
import { AdminPanel } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Admin' }
export default function AdminPage() {
  return <AdminPanel portal="prodashx" />
}
