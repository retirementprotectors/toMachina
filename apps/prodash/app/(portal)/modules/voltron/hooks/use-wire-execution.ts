'use client'

import { useCallback, useRef, useState } from 'react'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'
import type {
  ExecutionPhase,
  VoltronArtifact,
  VoltronSSEEvent,
  VoltronWireResult,
  WireExecutionState,
} from '../types'

const INITIAL_STATE: WireExecutionState = {
  phase: 'idle',
  execution_id: null,
  wire_id: null,
  stages: [],
  current_stage: null,
  artifacts: [],
  error: null,
  result: null,
  simulation: false,
}

/**
 * Manages VOLTRON wire execution lifecycle with real-time SSE progress.
 *
 * Flow:
 *  1. POST /api/voltron/wire/execute → returns { execution_id }
 *  2. GET  /api/voltron/wire/:id/stream (SSE) → stage_start, stage_complete, ...
 *  3. POST /api/voltron/wire/:id/approve → resumes after approval gate
 */
export function useWireExecution() {
  const [state, setState] = useState<WireExecutionState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  /** Abort any active SSE fetch connection */
  const closeStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  /** Reset to idle state */
  const reset = useCallback(() => {
    closeStream()
    setState(INITIAL_STATE)
  }, [closeStream])

  /** Connect to SSE stream for real-time updates */
  const connectStream = useCallback(
    (executionId: string) => {
      closeStream()

      // Fetch-based SSE reader — supports Firebase Auth headers (EventSource cannot)
      const streamUrl = `/api/voltron/wire/${executionId}/stream`

      const processEvent = (event: VoltronSSEEvent) => {
        setState((prev) => {
          const next = { ...prev }

          switch (event.type) {
            case 'stage_start':
              // event.stage is a VoltronStageResult object; extract the string ID
              next.current_stage = event.stage?.stage ?? null
              next.phase = 'executing'
              break

            case 'stage_complete': {
              next.current_stage = null
              if (event.stage) {
                // Backend already built the full VoltronStageResult — use it directly
                next.stages = [...prev.stages, event.stage]
              }
              if (event.artifacts) {
                next.artifacts = event.artifacts
              }
              break
            }

            case 'stage_error': {
              if (event.stage) {
                // Backend already built the full VoltronStageResult — use it directly
                next.stages = [...prev.stages, event.stage]
              }
              next.current_stage = null
              next.phase = 'error'
              next.error = event.stage?.error ?? event.error ?? 'Stage execution failed'
              break
            }

            case 'approval_required':
              next.phase = 'approval_pending'
              // event.stage is a VoltronStageResult object; extract the string ID
              next.current_stage = event.stage?.stage ?? null
              break

            case 'wire_complete':
              next.phase = 'complete'
              next.current_stage = null
              next.result = event.result ?? null
              if (event.result?.artifacts) {
                next.artifacts = event.result.artifacts
              }
              break

            case 'wire_error':
              next.phase = 'error'
              next.current_stage = null
              next.error = event.error ?? 'Wire execution failed'
              break
          }

          return next
        })
      }

      // Fetch-based SSE reader (supports auth headers)
      // Abort any lingering connection before creating a new one
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      fetchWithAuth(streamUrl, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            setState((prev) => ({
              ...prev,
              phase: 'error',
              error: `Stream failed: HTTP ${response.status}`,
            }))
            return
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6)) as VoltronSSEEvent
                  processEvent(event)
                } catch {
                  // Skip malformed SSE data
                }
              }
            }
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return
          setState((prev) => ({
            ...prev,
            phase: 'error',
            error: err instanceof Error ? err.message : 'Stream connection lost',
          }))
        })
    },
    [closeStream]
  )

  /** Execute a wire */
  const execute = useCallback(
    async (wireId: string, clientId: string, params: Record<string, unknown> = {}, simulation = false) => {
      reset()
      setState((prev) => ({
        ...prev,
        phase: 'executing',
        wire_id: wireId,
        simulation,
      }))

      try {
        const res = await fetchWithAuth('/api/voltron/wire/execute', {
          method: 'POST',
          body: JSON.stringify({
            wire_id: wireId,
            client_id: clientId,
            params,
            simulation,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          setState((prev) => ({
            ...prev,
            phase: 'error',
            error: body.error || `Execution failed: HTTP ${res.status}`,
          }))
          return
        }

        const body = await res.json()
        if (!body.success || !body.data?.execution_id) {
          setState((prev) => ({
            ...prev,
            phase: 'error',
            error: body.error || 'No execution_id returned',
          }))
          return
        }

        const executionId = body.data.execution_id as string
        setState((prev) => ({ ...prev, execution_id: executionId }))

        // Connect to SSE for real-time progress
        connectStream(executionId)
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: err instanceof Error ? err.message : 'Failed to start execution',
        }))
      }
    },
    [reset, connectStream]
  )

  /** Approve a pending gate */
  const approve = useCallback(async () => {
    if (!state.execution_id) return

    try {
      const res = await fetchWithAuth(
        `/api/voltron/wire/${state.execution_id}/approve`,
        { method: 'POST', body: JSON.stringify({ approved: true }) }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: body.error || 'Approval failed',
        }))
        return
      }

      setState((prev) => ({ ...prev, phase: 'executing' }))
      // SSE stream continues automatically after approval
    } catch (err) {
      setState((prev) => ({
        ...prev,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Approval request failed',
      }))
    }
  }, [state.execution_id])

  /** Reject a pending gate */
  const reject = useCallback(async () => {
    if (!state.execution_id) return

    try {
      await fetchWithAuth(
        `/api/voltron/wire/${state.execution_id}/approve`,
        { method: 'POST', body: JSON.stringify({ approved: false }) }
      )
      reset()
    } catch {
      reset()
    }
  }, [state.execution_id, reset])

  return {
    ...state,
    execute,
    approve,
    reject,
    reset,
  }
}
