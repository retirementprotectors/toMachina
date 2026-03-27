'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  VoltronMode,
  VoltronMessage,
  VoltronTaskState,
  VoltronToolCall,
  VoltronPageContext,
  VoltronSseEvent,
} from './types'

/* ─── Intent classifier (keyword-first, matches discovery spec) ─── */

const DEPLOY_KEYWORDS = [
  'deploy', 'build', 'create', 'run', 'execute', 'prep', 'prepare',
  'generate', 'set up', 'onboard', 'process', 'compile', 'analyze all',
  'send to', 'schedule', 'automate', 'do the', 'handle',
]

const CHAT_KEYWORDS = [
  'what', 'who', 'when', 'where', 'how', 'tell me', 'show me',
  'list', 'find', 'lookup', 'check', 'is there', 'do we have',
]

function classifyIntent(message: string): 'task' | 'chat' {
  const lower = message.toLowerCase().trim()
  if (!lower) return 'chat'

  const deployScore = DEPLOY_KEYWORDS.filter((kw) => lower.includes(kw)).length
  const chatScore = CHAT_KEYWORDS.filter((kw) => lower.includes(kw)).length

  if (deployScore > chatScore) return 'task'
  if (chatScore > deployScore) return 'chat'
  // Tie or zero → default chat
  return 'chat'
}

/* ─── Hook ─── */

interface UseVoltronStreamOptions {
  portal: string
}

export function useVoltronStream({ portal }: UseVoltronStreamOptions) {
  const [mode, setMode] = useState<VoltronMode>('idle')
  const [messages, setMessages] = useState<VoltronMessage[]>([])
  const [taskState, setTaskState] = useState<VoltronTaskState | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* ─── Task Mode (Mode 1) — POST /api/voltron/deploy → SSE stream ─── */

  const startTask = useCallback(
    async (goal: string, context: VoltronPageContext, authToken?: string) => {
      setError(null)
      setMode('task')
      setIsStreaming(true)

      const newTask: VoltronTaskState = {
        sessionId: null,
        goal,
        toolCalls: [],
        resultText: '',
        status: 'running',
      }
      setTaskState(newTask)

      try {
        const controller = new AbortController()
        abortRef.current = controller

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        // POST /api/voltron/deploy → 202 + session_id
        const res = await fetch('/api/voltron/deploy', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            goal,
            user_context: { portal, page_path: context.page_path },
            client_id: context.client_id,
            page_path: context.page_path,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(`Deploy responded with ${res.status}`)
        }

        const deployResult = (await res.json()) as { session_id?: string }
        const sessionId = deployResult.session_id
        if (!sessionId) throw new Error('No session_id returned')

        setTaskState((prev) => (prev ? { ...prev, sessionId } : prev))

        // GET /api/voltron/stream/:sessionId → SSE
        const streamRes = await fetch(`/api/voltron/stream/${sessionId}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          signal: controller.signal,
        })

        if (!streamRes.ok) throw new Error(`Stream responded with ${streamRes.status}`)

        const reader = streamRes.body?.getReader()
        const decoder = new TextDecoder()

        if (reader) {
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') {
                setTaskState((prev) =>
                  prev ? { ...prev, status: 'done' } : prev,
                )
                continue
              }

              try {
                const event = JSON.parse(data) as VoltronSseEvent
                handleTaskEvent(event)
              } catch {
                // skip malformed JSON
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const msg = err instanceof Error ? err.message : 'Task failed'
        setError(msg)
        setTaskState((prev) =>
          prev ? { ...prev, status: 'error', error: msg } : prev,
        )
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [portal],
  )

  const handleTaskEvent = useCallback((event: VoltronSseEvent) => {
    switch (event.type) {
      case 'text':
        setTaskState((prev) =>
          prev ? { ...prev, resultText: prev.resultText + (event.text || '') } : prev,
        )
        break

      case 'tool_call': {
        const tc: VoltronToolCall = {
          call_id: event.call_id || event.tool_use_id || crypto.randomUUID(),
          tool_name: event.tool_name || 'unknown',
          tool_input: event.tool_input || {},
          status: 'running',
        }
        setTaskState((prev) =>
          prev ? { ...prev, toolCalls: [...prev.toolCalls, tc] } : prev,
        )
        break
      }

      case 'tool_result':
        setTaskState((prev) => {
          if (!prev) return prev
          const updated = prev.toolCalls.map((tc) =>
            tc.call_id === (event.call_id || event.tool_use_id)
              ? { ...tc, status: 'completed' as const, tool_result: event.result }
              : tc,
          )
          return { ...prev, toolCalls: updated }
        })
        break

      case 'approval_required':
        setTaskState((prev) => {
          if (!prev) return prev
          const updated = prev.toolCalls.map((tc) =>
            tc.call_id === (event.call_id || event.tool_use_id)
              ? { ...tc, status: 'pending' as const, requires_approval: true }
              : tc,
          )
          return { ...prev, toolCalls: updated, status: 'approval_required' }
        })
        break

      case 'error':
        setError(event.error || 'Unknown error')
        setTaskState((prev) =>
          prev ? { ...prev, status: 'error', error: event.error } : prev,
        )
        break

      case 'done':
        setTaskState((prev) =>
          prev ? { ...prev, status: 'done' } : prev,
        )
        break
    }
  }, [])

  /* ─── Chat Mode (Mode 2) — POST /api/mdj/chat (existing) ─── */

  const sendChat = useCallback(
    async (text: string, context: VoltronPageContext, authToken?: string) => {
      if (!text.trim() || isStreaming) return
      setError(null)
      setMode('chat')

      const userMsg: VoltronMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      const assistantId = crypto.randomUUID()
      const assistantMsg: VoltronMessage = {
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

        const history = messages
          .filter((m) => m.id !== userMsg.id && m.id !== assistantId)
          .map((m) => ({ role: m.role, content: m.content }))

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

        if (!res.ok) throw new Error(`Chat responded with ${res.status}`)

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
                // skip malformed JSON
              }
            }
          }
        }

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
    [isStreaming, conversationId, portal, messages],
  )

  /* ─── Unified send: classifies intent, routes to task or chat ─── */

  const send = useCallback(
    (text: string, context: VoltronPageContext, authToken?: string) => {
      const intent = classifyIntent(text)
      if (intent === 'task') {
        void startTask(text, context, authToken)
      } else {
        void sendChat(text, context, authToken)
      }
    },
    [startTask, sendChat],
  )

  /* ─── Approval actions ─── */

  const approveAction = useCallback(
    async (sessionId: string, callId: string, authToken?: string) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        await fetch(`/api/voltron/approve/${sessionId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ call_id: callId }),
        })

        setTaskState((prev) => {
          if (!prev) return prev
          const updated = prev.toolCalls.map((tc) =>
            tc.call_id === callId ? { ...tc, status: 'running' as const, requires_approval: false } : tc,
          )
          return { ...prev, toolCalls: updated, status: 'running' }
        })
      } catch {
        setError('Failed to approve action')
      }
    },
    [],
  )

  const rejectAction = useCallback(
    async (sessionId: string, callId: string, authToken?: string) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        await fetch(`/api/voltron/reject/${sessionId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ call_id: callId }),
        })

        setTaskState((prev) => {
          if (!prev) return prev
          const updated = prev.toolCalls.map((tc) =>
            tc.call_id === callId ? { ...tc, status: 'failed' as const } : tc,
          )
          return { ...prev, toolCalls: updated, status: 'running' }
        })
      } catch {
        setError('Failed to reject action')
      }
    },
    [],
  )

  /* ─── Reset ─── */

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMode('idle')
    setMessages([])
    setTaskState(null)
    setIsStreaming(false)
    setError(null)
    setConversationId(null)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
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
  }
}
