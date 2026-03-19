import type { Metadata } from 'next'
import { serverFetch } from '../../../lib/server-api'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const client = await serverFetch<{ first_name?: string; last_name?: string }>(`clients/${id}`)
  const name = client?.first_name || client?.last_name
    ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()
    : null
  if (name) return { title: { absolute: `Contacts > ${name}` } }
  return { title: 'Contact' }
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
