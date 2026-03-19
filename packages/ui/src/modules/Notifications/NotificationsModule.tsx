'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, where, orderBy, limit, writeBatch, doc } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import { useAuth } from '@tomachina/auth'
import { useRouter } from 'next/navigation'
import { AllTab } from './tabs/AllTab'
import { ContactTab } from './tabs/ContactTab'
import { AccountTab } from './tabs/AccountTab'
import { MyRPITab } from './tabs/MyRPITab'
import { DataTab } from './tabs/DataTab'
import { ApprovalsTab } from './tabs/ApprovalsTab'
import type { NotificationDoc } from './NotificationRow'
import { collection as firestoreCollection } from 'firebase/firestore'

/* ─── Types ─── */

interface NotificationsModuleProps {
  portal: string
  open: boolean
  onClose: () => void
}

type NotifTab = 'all' | 'contact' | 'account' | 'myrpi' | 'data' | 'approvals'

const TABS: Array<{ key: NotifTab; label: string; icon: string }> = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'contact', label: 'Contact', icon: 'person' },
  { key: 'account', label: 'Account', icon: 'briefcase' },
  { key: 'myrpi', label: 'MyRPI', icon: 'account_circle' },
  { key: 'data', label: 'Data', icon: 'database' },
  { key: 'approvals', label: 'Approvals', icon: 'shield' },
]

/* ─── Portal key mapping ─── */

const PORTAL_KEY_MAP: Record<string, string> = {
  prodash: 'prodashx',
  riimo: 'riimo',
  sentinel: 'sentinel',
}

/* ─── Responsive panel width classes (match CommsModule/ConnectPanel) ─── */

const PANEL_CLASSES = [
  'fixed right-0 top-0 z-50 flex h-full flex-col bg-[var(--bg-card)] shadow-2xl',
  'w-screen',
  'lg:w-[360px]',
  'min-[1400px]:w-[460px]',
].join(' ')

/* ─── Component ─── */

export function NotificationsModule({ portal, open, onClose }: NotificationsModuleProps) {
  const [activeTab, setActiveTab] = useState<NotifTab>('all')
  const { user } = useAuth()
  const router = useRouter()

  const portalKey = PORTAL_KEY_MAP[portal] || portal

  // Firestore onSnapshot for notifications
  const notifQuery = useMemo(() => {
    if (!open) return null
    const db = getDb()
    return query(
      firestoreCollection(db, 'notifications'),
      where('portal', 'in', [portalKey, 'all']),
      orderBy('created_at', 'desc'),
      limit(200)
    )
  }, [open, portalKey])

  const { data: notifications, loading } = useCollection<NotificationDoc>(
    notifQuery,
    `notifications-${portalKey}-${open}`
  )

  const handleNavigate = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  const handleMarkRead = useCallback((id: string) => {
    const db = getDb()
    const ref = doc(db, 'notifications', id)
    // Fire-and-forget — UI updates via onSnapshot
    import('firebase/firestore').then(({ updateDoc }) => {
      updateDoc(ref, { read: true }).catch(() => {})
    })
  }, [])

  const handleMarkAllRead = useCallback(() => {
    const db = getDb()
    const unread = notifications.filter((n) => !n.read)
    if (unread.length === 0) return

    const batch = writeBatch(db)
    for (const n of unread.slice(0, 500)) {
      const ref = doc(db, 'notifications', n._id || n.id)
      batch.update(ref, { read: true })
    }
    batch.commit().catch(() => {})
  }, [notifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  if (!open) return null

  const handleClose = () => {
    setActiveTab('all')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={handleClose} />

      {/* Panel */}
      <div className={PANEL_CLASSES}>
        {/* Header */}
        <div className="border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
                notifications
              </span>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h2>
              {unreadCount > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: 'var(--portal)' }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--portal)] transition-colors hover:bg-[var(--bg-hover)]"
                  title="Mark all as read"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>done_all</span>
                  Mark all read
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                title="Close panel"
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-0 px-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1 border-b-2 py-2 text-[10px] font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[var(--portal)] text-[var(--portal)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'all' && (
            <AllTab notifications={notifications} loading={loading} onNavigate={handleNavigate} onMarkRead={handleMarkRead} />
          )}
          {activeTab === 'contact' && (
            <ContactTab notifications={notifications} loading={loading} onNavigate={handleNavigate} onMarkRead={handleMarkRead} />
          )}
          {activeTab === 'account' && (
            <AccountTab notifications={notifications} loading={loading} onNavigate={handleNavigate} onMarkRead={handleMarkRead} />
          )}
          {activeTab === 'myrpi' && (
            <MyRPITab notifications={notifications} loading={loading} userId={user?.uid || ''} onNavigate={handleNavigate} onMarkRead={handleMarkRead} />
          )}
          {activeTab === 'data' && (
            <DataTab notifications={notifications} loading={loading} onNavigate={handleNavigate} onMarkRead={handleMarkRead} />
          )}
          {activeTab === 'approvals' && (
            <ApprovalsTab />
          )}
        </div>
      </div>
    </>
  )
}
