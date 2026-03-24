'use client'

import { useMemo } from 'react'
import {
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
} from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections, getDb } from '@tomachina/db/src/firestore'

/* ─── Types ─── */

interface ConversationDoc {
  _id: string
  id: string
  title?: string
  specialist_id?: string
  last_message_at?: { seconds: number; nanoseconds: number }
  status: string
  user_email: string
  portal: string
}

interface ConversationListProps {
  open: boolean
  onClose: () => void
  userEmail: string
  onSelect: (convId: string) => void
  onNew: () => void
  activeConversationId: string | null
}

/* ─── Relative Time Helper ─── */

function relativeTime(ts: { seconds: number; nanoseconds: number } | undefined): string {
  if (!ts) return ''
  const diff = Date.now() - ts.seconds * 1000
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/* ─── Specialist Icon Map ─── */

const SPECIALIST_ICONS: Record<string, string> = {
  'mdj-general': 'smart_toy',
  'mdj-medicare': 'health_and_safety',
  'mdj-securities': 'account_balance',
  'mdj-service': 'support_agent',
  'mdj-david': 'handshake',
  'mdj-ops': 'settings_suggest',
}

/* ─── Component ─── */

export function ConversationList({
  open,
  onClose,
  userEmail,
  onSelect,
  onNew,
  activeConversationId,
}: ConversationListProps) {
  const q = useMemo(
    () =>
      userEmail
        ? query(
            collections.mdjConversations(),
            where('user_email', '==', userEmail),
            where('status', '==', 'active'),
            orderBy('last_message_at', 'desc'),
            limit(20)
          )
        : null,
    [userEmail]
  )

  const { data: conversations } = useCollection<ConversationDoc>(q, 'mdj-conversations')

  const archiveConversation = async (convId: string) => {
    try {
      const db = getDb()
      await updateDoc(doc(db, 'mdj_conversations', convId), { status: 'archived' })
    } catch (err) {
      console.error('Failed to archive conversation:', err)
    }
  }

  return (
    <div
      className={`absolute inset-0 z-20 transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } bg-[var(--bg-primary)] flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold">Conversations</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onNew}
            className="text-xs px-2 py-1 rounded bg-[var(--portal)] text-white hover:opacity-90"
          >
            + New
          </button>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {(!conversations || conversations.length === 0) && (
          <p className="text-center text-sm text-[var(--text-secondary)] mt-8">
            No conversations yet
          </p>
        )}
        {conversations?.map((conv) => (
          <div
            key={conv._id}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] ${
              conv._id === activeConversationId ? 'bg-[var(--bg-secondary)]' : ''
            }`}
            onClick={() => onSelect(conv._id)}
          >
            <span className="material-symbols-outlined text-lg text-[var(--text-secondary)]">
              {SPECIALIST_ICONS[conv.specialist_id || 'mdj-general'] || 'smart_toy'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {conv.title || 'Untitled conversation'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {relativeTime(conv.last_message_at)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                archiveConversation(conv._id)
              }}
              className="text-[var(--text-secondary)] hover:text-red-500 p-1"
              title="Archive"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
