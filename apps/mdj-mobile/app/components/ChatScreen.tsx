'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getAuth } from 'firebase/auth'
import { MessageBubble, type ChatMessage } from './MessageBubble'
import { QuickActions } from './QuickActions'

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    // Create placeholder assistant message for streaming
    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const auth = getAuth()
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      const res = await fetch('/api/mdj/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text.trim(),
          portal: 'mdj-mobile',
        }),
      })

      if (!res.ok) {
        throw new Error(`MDJ responded with ${res.status}`)
      }

      // Handle SSE streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.text) {
                  fullContent += data.text
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: fullContent }
                        : m
                    )
                  )
                }
                if (data.tool) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, toolCall: { name: data.tool, status: data.status ?? 'running' } }
                        : m
                    )
                  )
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }
        }
      }

      // Mark streaming complete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      )
    } catch {
      // Show error in assistant bubble
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Unable to reach MDJ. Check your connection and try again.', isStreaming: false, isError: true }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 safe-top
        bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--mdj-purple)] to-[#4c1d95]
          flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">M</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">My Digital Josh</h1>
          <p className="text-[var(--text-muted)] text-[11px]">
            {isStreaming ? 'Thinking...' : 'AI Sales Assistant'}
          </p>
        </div>
        <div className="w-2 h-2 rounded-full bg-[var(--success)]" title="Online" />
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--mdj-purple)] to-[#4c1d95]
              flex items-center justify-center shadow-lg shadow-purple-900/20">
              <span className="text-white text-3xl font-extrabold">M</span>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold mb-1">Hey there</h2>
              <p className="text-[var(--text-secondary)] text-sm">
                Ask me anything about clients, pipeline, quotes, or tasks.
              </p>
            </div>
            <QuickActions onSelect={handleQuickAction} />
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
          bg-[var(--bg-secondary)] border-t border-[var(--border)]"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask MDJ anything..."
          rows={1}
          className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm
            bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)]
            focus:outline-none focus:border-[var(--mdj-purple)] focus:ring-1 focus:ring-[var(--mdj-purple-glow)]
            max-h-32"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="w-11 h-11 rounded-2xl bg-[var(--mdj-purple)] text-white
            flex items-center justify-center shrink-0
            disabled:opacity-30 disabled:cursor-not-allowed
            active:scale-95 transition-transform"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  )
}
