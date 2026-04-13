'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getAuth } from 'firebase/auth'
import { ChatThread } from './ChatThread'
import { ChatInput } from './ChatInput'
import { useMDJStream } from './useMDJStream'
import type { MDJPageContext } from './types'

interface MDJPanelProps {
  portal: string
  open: boolean
  onClose: () => void
}

/* ─── Responsive panel width classes (matches CommsModule/ConnectPanel/NotificationsModule) ─── */

const PANEL_RESPONSIVE_CLASSES = [
  'fixed right-0 top-0 z-50 flex h-full flex-col overflow-hidden bg-[var(--bg-card)] shadow-2xl',
  'w-[360px]',
  'min-[1400px]:w-[460px]',
  'max-sm:w-screen',
].join(' ')

/* ─── Extract page context from pathname ─── */

function usePageContext(): MDJPageContext {
  const pathname = usePathname() || '/'

  const contactMatch = pathname.match(/\/contacts\/([a-zA-Z0-9_-]+)/)
  const accountMatch = pathname.match(/\/accounts\/([a-zA-Z0-9_-]+)/)
  const pipelineMatch = pathname.match(/\/pipelines\/([a-zA-Z0-9_-]+)/)

  return {
    client_id: contactMatch?.[1],
    account_id: accountMatch?.[1],
    pipeline_key: pipelineMatch?.[1],
    page_path: pathname,
  }
}

/* ─── Main Component ─── */

export function MDJPanel({ portal, open, onClose }: MDJPanelProps) {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useMDJStream({ portal })
  const pageContext = usePageContext()
  const [authToken, setAuthToken] = useState<string | undefined>()

  // Get Firebase auth token on mount and refresh it
  useEffect(() => {
    const auth = getAuth()
    const user = auth.currentUser
    if (user) {
      user.getIdToken(true).then(setAuthToken).catch(() => {})
    }
  }, [open])

  const handleSend = useCallback(
    (text: string) => {
      // Refresh token before each send to avoid expiry
      const auth = getAuth()
      const user = auth.currentUser
      if (user) {
        user.getIdToken(true).then((token) => {
          sendMessage(text, pageContext, token)
        })
      } else {
        sendMessage(text, pageContext)
      }
    },
    [sendMessage, pageContext],
  )

  const handleNewChat = useCallback(() => {
    clearMessages()
  }, [clearMessages])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={PANEL_RESPONSIVE_CLASSES}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="material-icons-outlined"
              style={{ fontSize: '22px', color: 'var(--portal)' }}
            >
              smart_toy
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              MDJ
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              title="New conversation"
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span
                className="material-icons-outlined"
                style={{ fontSize: '18px', color: 'var(--text-muted)' }}
              >
                add_comment
              </span>
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span
                className="material-icons-outlined"
                style={{ fontSize: '18px', color: 'var(--text-muted)' }}
              >
                close
              </span>
            </button>
          </div>
        </div>

        {/* Context indicator */}
        {pageContext.client_id && (
          <div className="px-4 py-1.5 text-[10px] text-[var(--text-muted)] bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]">
            <span className="material-icons-outlined align-middle mr-1" style={{ fontSize: '12px' }}>person</span>
            Viewing client: {pageContext.client_id}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 text-xs text-red-400 bg-red-900/20 border-b border-red-800/30">
            {error}
          </div>
        )}

        {/* Chat thread */}
        <ChatThread messages={messages} />

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </>
  )
}
