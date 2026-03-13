'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { useDocument, useCollection, getDb } from '@tomachina/db'
import { collection } from 'firebase/firestore'
import type { Client, Account } from '@tomachina/core'
import { ClientHeader } from './components/ClientHeader'
import { ClientTabs, type TabKey } from './components/ClientTabs'
import { ContactTab } from './components/tabs/ContactTab'
import { PersonalTab } from './components/tabs/PersonalTab'
import { EstateTab } from './components/tabs/EstateTab'
import { AccountsTab } from './components/tabs/AccountsTab'
import { ConnectedTab } from './components/tabs/ConnectedTab'
import { ActivityTab } from './components/tabs/ActivityTab'
import { CommsTab } from './components/tabs/CommsTab'
import { PossibleDuplicates } from './components/PossibleDuplicates'

// ---------------------------------------------------------------------------
// CLIENT360 Detail Page — the heart of ProDash
// ---------------------------------------------------------------------------

export default function Client360Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: client, loading, error } = useDocument<Client>('clients', id)

  const accountsQuery = useMemo(() => collection(getDb(), 'clients', id, 'accounts'), [id])
  const { data: accounts, loading: accountsLoading } = useCollection<Account>(accountsQuery, `accounts-${id}`)

  const [activeTab, setActiveTab] = useState<TabKey>('contact')

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <BackLink />
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)]" />
            <div className="space-y-2">
              <div className="h-7 w-56 rounded bg-[var(--bg-surface)]" />
              <div className="h-4 w-32 rounded bg-[var(--bg-surface)]" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-[var(--bg-surface)]" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-[var(--bg-card)]" />
          ))}
        </div>
      </div>
    )
  }

  // --- Error / not found ---
  if (error || !client) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink />
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">
            person_off
          </span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">
            Client not found
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {error ? 'There was an error loading this client.' : 'No client exists with this ID.'}
          </p>
          <Link
            href="/clients"
            className="mt-6 rounded-lg bg-[var(--portal)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            Back to Clients
          </Link>
        </div>
      </div>
    )
  }

  // --- Tab content renderer ---
  function renderTabContent() {
    switch (activeTab) {
      case 'contact':
        return <ContactTab client={client!} clientId={id} />
      case 'personal':
        return <PersonalTab client={client!} clientId={id} />
      case 'estate':
        return <EstateTab client={client!} clientId={id} />
      case 'accounts':
        return <AccountsTab accounts={accounts} loading={accountsLoading} clientId={id} />
      case 'connected':
        return <ConnectedTab client={client!} clientId={id} />
      case 'communications':
        return <CommsTab clientId={id} client={client!} />
      case 'activity':
        return <ActivityTab clientId={id} />
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />
      <ClientHeader client={client} />
      <PossibleDuplicates client={client} clientId={id} />
      <ClientTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="min-h-[400px]">{renderTabContent()}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/clients"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]"
    >
      <span className="material-icons-outlined text-[18px]">arrow_back</span>
      Back to Clients
    </Link>
  )
}
