'use client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
  toolCall?: {
    name: string
    status: 'running' | 'completed' | 'failed'
  }
}

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-[var(--mdj-purple)] text-white rounded-br-md'
            : message.isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-bl-md'
              : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-md'
          }`}
      >
        {/* Tool call indicator */}
        {message.toolCall && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg
            bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
            <div className={`w-1.5 h-1.5 rounded-full ${
              message.toolCall.status === 'running' ? 'bg-[var(--warning)] animate-pulse'
              : message.toolCall.status === 'completed' ? 'bg-[var(--success)]'
              : 'bg-[var(--error)]'
            }`} />
            <span className="text-[var(--text-secondary)] font-medium">
              {message.toolCall.name}
            </span>
          </div>
        )}

        {/* Message content */}
        <div className={message.isStreaming && !message.content ? 'cursor-blink' : ''}>
          {message.content || (message.isStreaming ? '' : '...')}
        </div>

        {/* Streaming indicator */}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-[var(--portal-accent)] animate-pulse ml-0.5 rounded-sm" />
        )}
      </div>
    </div>
  )
}
