'use client'

import { useCallback, useState } from 'react'
import { useToast } from '@tomachina/ui'
import { VoltronInput } from './components/VoltronInput'
import { VoltronMode1 } from './voltron-mode1'
import { ChatMode } from './components/ChatMode'
import { useIntentClassifier, type IntentResult } from './hooks/use-intent-classifier'

type ActiveMode = 'idle' | 'deploy' | 'chat'

/**
 * VOLTRON Dual-Mode Orchestrator
 *
 * TRK-13861: Wires intent classifier into ProDashX.
 * Every submission runs through classifyIntent() before routing:
 *   - deploy-intent → Mode 1 (task/wire flow)
 *   - chat-intent   → Mode 2 (chat bubble)
 * User never sees a mode toggle. Intent classifier result is logged (non-PHI).
 */
export function VoltronDualMode() {
  const { showToast } = useToast()
  const { classifyIntent } = useIntentClassifier()

  const [activeMode, setActiveMode] = useState<ActiveMode>('idle')
  const [lastClassification, setLastClassification] = useState<IntentResult | null>(null)
  const [chatMessage, setChatMessage] = useState<string>('')

  const handleSubmit = useCallback(
    (message: string) => {
      // Classify intent on every submission
      const result = classifyIntent(message)

      // Log classification result (non-PHI: no message content, only mode + confidence)
      console.info('[VOLTRON Intent]', {
        mode: result.mode,
        confidence: result.confidence,
        reasoning: result.reasoning,
        model_used: result.model_used,
        input_length: message.length,
        timestamp: new Date().toISOString(),
      })

      setLastClassification(result)

      if (result.mode === 'deploy') {
        setActiveMode('deploy')
        showToast('Routing to task engine...', 'info')
      } else {
        setChatMessage(message)
        setActiveMode('chat')
      }
    },
    [classifyIntent, showToast]
  )

  const handleReset = useCallback(() => {
    setActiveMode('idle')
    setLastClassification(null)
    setChatMessage('')
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-page-title flex items-center gap-2">
          <span className="material-icons-outlined text-[28px] text-[var(--portal)]">bolt</span>
          VOLTRON
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Ask a question or deploy a task — VOLTRON routes automatically.
        </p>
      </div>

      {/* Shared input — visible when idle */}
      {activeMode === 'idle' && (
        <VoltronInput onSubmit={handleSubmit} />
      )}

      {/* Mode indicator — visible after classification */}
      {lastClassification && activeMode !== 'idle' && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              lastClassification.mode === 'deploy'
                ? 'bg-[var(--success)]'
                : 'bg-[var(--portal)]'
            }`}
          />
          {lastClassification.mode === 'deploy' ? 'Task Mode' : 'Chat Mode'} ·{' '}
          {Math.round(lastClassification.confidence * 100)}% confidence ·{' '}
          {lastClassification.model_used}
          <button
            type="button"
            onClick={handleReset}
            className="ml-2 text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Mode 1: Deploy / Task Flow */}
      {activeMode === 'deploy' && <VoltronMode1 />}

      {/* Mode 2: Chat Bubble */}
      {activeMode === 'chat' && chatMessage && (
        <ChatMode initialMessage={chatMessage} onReset={handleReset} />
      )}
    </div>
  )
}
