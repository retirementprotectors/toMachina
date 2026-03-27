'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getAuth } from 'firebase/auth'
import { useToast } from '../../components/Toast'
import { useVoltronStream } from './useVoltronStream'
import { TaskView } from './TaskView'
import { ChatView } from './ChatView'
import type { VoltronPageContext } from './types'

/* ─── Extract page context from pathname ─── */

function usePageContext(): VoltronPageContext {
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

/* ─── VoltronApp ─── */

interface VoltronAppProps {
  portal: string
}

export function VoltronApp({ portal }: VoltronAppProps) {
  const {
    mode,
    messages,
    taskState,
    isStreaming,
    error,
    send,
    approveAction,
    rejectAction,
    reset,
    stopStreaming,
  } = useVoltronStream({ portal })

  const pageContext = usePageContext()
  const { showToast } = useToast()
  const [input, setInput] = useState('')

  /* ─── Show errors via toast (no alert/confirm/prompt) ─── */

  useEffect(() => {
    if (error) {
      showToast(error, 'error')
    }
  }, [error, showToast])

  /* ─── Auth token helper ─── */

  const getAuthToken = useCallback(async (): Promise<string | undefined> => {
    try {
      const auth = getAuth()
      const user = auth.currentUser
      if (user) return await user.getIdToken()
    } catch {
      // silently fall back to no token
    }
    return undefined
  }, [])

  /* ─── Submit handler ─── */

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')

    const token = await getAuthToken()
    send(text, pageContext, token)
  }, [input, isStreaming, getAuthToken, send, pageContext])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  /* ─── Approval handlers ─── */

  const handleApprove = useCallback(
    async (callId: string) => {
      if (!taskState?.sessionId) return
      const token = await getAuthToken()
      await approveAction(taskState.sessionId, callId, token)
    },
    [taskState, getAuthToken, approveAction],
  )

  const handleReject = useCallback(
    async (callId: string) => {
      if (!taskState?.sessionId) return
      const token = await getAuthToken()
      await rejectAction(taskState.sessionId, callId, token)
    },
    [taskState, getAuthToken, rejectAction],
  )

  /* ─── Mode label for header ─── */

  const modeLabel =
    mode === 'task' ? 'Task Mode' : mode === 'chat' ? 'Chat Mode' : null

  const modeIcon =
    mode === 'task' ? 'rocket_launch' : mode === 'chat' ? 'chat' : null

  return (
    <div className="flex h-full flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="material-icons-outlined"
            style={{ fontSize: '26px', color: '#7c5cfc' }}
          >
            smart_toy
          </span>
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)]">VOLTRON</h1>
            <p className="text-[11px] text-[var(--text-muted)]">Autonomous Agent OS</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active mode indicator */}
          {modeLabel && modeIcon && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(124,92,252,0.12)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px', color: '#7c5cfc' }}>
                {modeIcon}
              </span>
              <span className="text-[11px] font-semibold text-[#7c5cfc]">{modeLabel}</span>
            </div>
          )}

          {/* Stop streaming */}
          {isStreaming && (
            <button
              onClick={stopStreaming}
              title="Stop"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>
                stop_circle
              </span>
            </button>
          )}

          {/* Reset */}
          {mode !== 'idle' && !isStreaming && (
            <button
              onClick={reset}
              title="New conversation"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)' }}>
                add_comment
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Content area — mode-dependent view */}
      {mode === 'idle' && (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <span
              className="material-icons-outlined mb-4 block"
              style={{ fontSize: '64px', color: '#7c5cfc', opacity: 0.2 }}
            >
              smart_toy
            </span>
            <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
              What would you like to do?
            </h2>
            <p className="mb-1 text-sm text-[var(--text-secondary)]">
              Type a goal to deploy a task, or ask a question to start a conversation.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              VOLTRON will automatically route to the right mode.
            </p>
          </div>
        </div>
      )}

      {mode === 'task' && taskState && (
        <TaskView
          taskState={taskState}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {mode === 'chat' && <ChatView messages={messages} />}

      {/* Single input field — always visible */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'VOLTRON is working...'
                : 'Tell VOLTRON what to do, or ask a question...'
            }
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[#7c5cfc] focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={isStreaming || !input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-30"
            style={{ background: '#7c5cfc' }}
            title="Send"
          >
            <span className="material-icons-outlined text-white" style={{ fontSize: '18px' }}>
              send
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
