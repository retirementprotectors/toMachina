'use client'

import type { MDJMessage } from './types'

interface MessageBubbleProps {
  message: MDJMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--portal)] text-white rounded-br-md'
            : 'bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-bl-md'
        }`}
      >
        {message.specialist && !isUser && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--portal)] mb-1 opacity-70">
            {message.specialist}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--portal)] animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  )
}
