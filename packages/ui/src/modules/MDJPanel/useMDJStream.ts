'use client'

import { useState, useCallback, useRef } from 'react'
import type { MDJMessage, MDJPageContext } from './types'

interface UseMDJStreamOptions {
  portal: string
}

export function useMDJStream({ portal }: UseMDJStreamOptions) {
  const [messages, setMessages] = useState<MDJMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<MDJMessage[]>([])
  messagesRef.current = messages

  const sendMessage = useCallback(
    async (text: string, context?: MDJPageContext, authToken?: string) => {
      if (!text.trim() || isStreaming) return
      setError(null)

      // Add user message
      const userMsg: MDJMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      // Create placeholder assistant message for streaming
      const assistantId = crypto.randomUUID()
      const assistantMsg: MDJMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, assistantMsg])
      setIsStreaming(true)

      try {
        const controller = new AbortController()
        abortRef.current = controller

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        // Build conversation history from existing messages (excluding the current user msg + placeholder)
        const history = messagesRef.current
          .filter(m => m.id !== userMsg.id && m.id !== assistantId)
          .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

        const res = await fetch('/api/mdj/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: text.trim(),
            portal,
            conversation_id: conversationId,
            context,
            conversation_history: history,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(`MDJ responded with ${res.status}`)
        }

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
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)

              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data) as Record<string, unknown>

                if (parsed.text) {
                  fullContent += parsed.text as string
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m,
                    ),
                  )
                }

                if (parsed.conversation_id) {
                  setConversationId(parsed.conversation_id as string)
                }

                if (parsed.specialist) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, specialist: parsed.specialist as string }
                        : m,
                    ),
                  )
                }

                if (parsed.error) {
                  setError(parsed.error as string)
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }
        }

        // Finalize the message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m,
          ),
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
        setError(errorMessage)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Sorry, something went wrong: ${errorMessage}`, isStreaming: false }
              : m,
          ),
        )
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, conversationId, portal],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    messages,
    isStreaming,
    conversationId,
    error,
    sendMessage,
    clearMessages,
    stopStreaming,
  }
}
