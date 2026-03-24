'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@tomachina/auth'
import { useRouter } from 'next/navigation'
import { fetchValidated } from '../fetchValidated'
import { AllTab } from './tabs/AllTab'
import { ContactTab } from './tabs/ContactTab'
import { AccountTab } from './tabs/AccountTab'
import { MyRPITab } from './tabs/MyRPITab'
import { DataTab } from './tabs/DataTab'
import { ApprovalsTab } from './tabs/ApprovalsTab'
import type { NotificationDoc } from './NotificationRow'

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

  // TRK-13685: Fetch notifications from API instead of direct Firestore
  const [notifications, setNotifications] = useState<NotificationDoc[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)

    async function load() {
      const result = await fetchValidated<NotificationDoc[]>(
        `/api/notifications?portal=${encodeURIComponent(portalKey)}&limit=200`
      )
      if (!cancelled) {
        setNotifications(result.success && result.data ? result.data : [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open, portalKey])

  const handleNavigate = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  const handleMarkRead = useCallback((id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n =>
      (n._id === id || n.id === id) ? { ...n, read: true } : n
    ))
    // Fire-and-forget API call
    fetchValidated(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }).catch(() => {})
  }, [])

  const handleMarkAllRead = useCallback(() => {
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    // Fire-and-forget API call
    fetchValidated(`/api/notifications/read-all?portal=${encodeURIComponent(portalKey)}`, {
      method: 'POST',
    }).catch(() => {})
  }, [notifications, portalKey])

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
      {/* Backdrop — mobile only (TRK-13677: push-not-overlay removes backdrop on desktop) */}
      <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={handleClose} />

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

          {/* CP13: Tab bar — matches CommsModule/ConnectPanel pattern (44px, border-b-2) */}
          <div className="flex items-center gap-0 px-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 h-[44px] text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[var(--portal)] text-[var(--portal)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
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
