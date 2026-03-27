'use client'

import { useRef, useEffect } from 'react'
import type { VoltronMessage } from './types'

/* ─── Message Bubble ─── */

function MessageBubble({ message }: { message: VoltronMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#7c5cfc] text-white'
            : 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
        }`}
      >
        {/* Specialist indicator */}
        {!isUser && message.specialist && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#a855f7]">
            {message.specialist}
          </div>
        )}

        {/* Content with streaming cursor */}
        <span className="whitespace-pre-wrap">{message.content}</span>
        {message.isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-[#7c5cfc]" />
        )}
      </div>
    </div>
  )
}

/* ─── Chat View ─── */

interface ChatViewProps {
  messages: VoltronMessage[]
}

export function ChatView({ messages }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="text-center">
          <span
            className="material-icons-outlined mb-3 block"
            style={{ fontSize: '48px', color: '#7c5cfc', opacity: 0.3 }}
          >
            smart_toy
          </span>
          <p className="mb-1 text-sm font-medium text-[var(--text-secondary)]">
            VOLTRON
          </p>
          <p className="max-w-[280px] text-xs text-[var(--text-muted)]">
            Ask me anything about clients, accounts, pipelines, or just tell me what you need done.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
