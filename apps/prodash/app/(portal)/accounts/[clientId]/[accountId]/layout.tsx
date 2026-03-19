import type { Metadata } from 'next'
import { serverFetch } from '../../../../lib/server-api'

type Props = { params: Promise<{ clientId: string; accountId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { clientId, accountId } = await params
  const [client, account] = await Promise.all([
    serverFetch<{ first_name?: string; last_name?: string }>(`clients/${clientId}`),
    serverFetch<{ carrier?: string; product_name?: string; account_number?: string }>(`accounts/${clientId}/${accountId}`),
  ])
  const name = client?.first_name || client?.last_name
    ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()
    : null
  const label = account?.carrier || account?.product_name || account?.account_number || null
  if (name && label) return { title: { absolute: `${name} > ${label}` } }
  if (name) return { title: { absolute: `${name} > Account` } }
  if (label) return { title: { absolute: label } }
  return { title: 'Account Detail' }
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
