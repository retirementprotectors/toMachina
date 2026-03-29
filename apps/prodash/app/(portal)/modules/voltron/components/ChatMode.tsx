'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@tomachina/ui'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatModeProps {
  /** The initial user message that triggered chat mode */
  initialMessage: string
  /** Called when user wants to go back to input */
  onReset: () => void
  /** Specialist label, if known */
  specialist?: string
}

/**
 * VOLTRON Mode 2 — Chat Bubble Interface
 *
 * Single-turn Q&A using the existing /api/mdj/chat SSE endpoint.
 * Displays conversation as chat bubbles with specialist indicator.
 */
export function ChatMode({ initialMessage, onReset, specialist }: ChatModeProps) {
  const { showToast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Send message to chat endpoint and stream response
  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || streaming) return

      const userMsg: ChatMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMsg])
      setStreaming(true)

      // Add placeholder assistant message
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        // Build conversation history for context
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await fetchWithAuth('/api/mdj/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.trim(),
            portal: 'prodash',
            conversation_history: history,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          showToast(`Chat error: ${res.status}`, 'error')
          setStreaming(false)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          showToast('No response stream', 'error')
          setStreaming(false)
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const payload = trimmed.slice(6)

            if (payload === '[DONE]') {
              break
            }

            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>
              if (typeof parsed.text === 'string') {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.text,
                    }
                  }
                  return updated
                })
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          showToast('Chat connection failed', 'error')
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [messages, streaming, showToast]
  )

  // Fire initial message on mount
  useEffect(() => {
    if (initialMessage) {
      sendMessage(initialMessage)
    }
    // Only fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleFollowUp = useCallback(() => {
    if (!inputValue.trim() || streaming) return
    sendMessage(inputValue.trim())
    setInputValue('')
  }, [inputValue, streaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleFollowUp()
      }
    },
    [handleFollowUp]
  )

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Specialist indicator */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[18px] text-[var(--portal)]">
            smart_toy
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {specialist || 'VOLTRON Chat'}
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors"
        >
          ← New input
        </button>
      </div>

      {/* Chat bubbles */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-4"
      >
        {messages.map((msg, i) => (
          <div
            key={`${msg.role}-${i}`}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[var(--portal)] text-white rounded-br-sm'
                  : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-sm'
              }`}
            >
              {msg.content || (
                <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                  <span className="material-icons-outlined text-[14px] animate-spin">
                    sync
                  </span>
                  Thinking...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Follow-up input */}
      <div className="mt-3 relative rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors focus-within:border-[var(--portal)]">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          placeholder="Ask a follow-up..."
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-2.5 pr-12 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleFollowUp}
          disabled={streaming || !inputValue.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-lg bg-[var(--portal)] p-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <span className="material-icons-outlined text-[16px]">send</span>
        </button>
      </div>
    </div>
  )
}
