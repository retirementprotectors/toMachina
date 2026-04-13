import type { Metadata } from 'next'
import { AdminGuard } from './guard'
export const metadata: Metadata = { title: 'Admin' }
export default function AdminPage() {
  return <AdminGuard />
}
