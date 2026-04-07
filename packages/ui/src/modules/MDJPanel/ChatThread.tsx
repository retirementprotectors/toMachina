'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import type { MDJMessage } from './types'

interface ChatThreadProps {
  messages: MDJMessage[]
}

export function ChatThread({ messages }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="text-center">
          <span
            className="material-icons-outlined block mb-3"
            style={{ fontSize: '48px', color: 'var(--portal)', opacity: 0.3 }}
          >
            smart_toy
          </span>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">
            MDJ
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-[240px]">
            Ask me anything about clients, accounts, pipelines, quotes, or just tell me what you need done.
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
