'use client'

import { useState, useCallback } from 'react'
import { ComparisonTable } from './steps/ComparisonTable'
import { Recommendation } from './steps/Recommendation'
import { OutputGeneration } from './steps/OutputGeneration'

/* ─── Types ─── */

export type ProductLine = 'LIFE' | 'ANNUITY' | 'MEDICARE' | 'INVESTMENT'

interface QueWorkbenchProps {
  productLine: ProductLine
}

type WorkbenchStep = 'sessions' | 'client' | 'quoting' | 'comparison' | 'recommendation' | 'output'

const PRODUCT_LINE_LABELS: Record<ProductLine, { title: string; icon: string }> = {
  LIFE: { title: 'Life Insurance', icon: 'shield' },
  ANNUITY: { title: 'Annuity', icon: 'savings' },
  MEDICARE: { title: 'Medicare', icon: 'health_and_safety' },
  INVESTMENT: { title: 'Advisory', icon: 'trending_up' },
}

const STEP_ORDER: WorkbenchStep[] = ['sessions', 'client', 'quoting', 'comparison', 'recommendation', 'output']

const STEP_META: Record<WorkbenchStep, { label: string; icon: string }> = {
  sessions: { label: 'Sessions', icon: 'list_alt' },
  client: { label: 'Client Info', icon: 'person' },
  quoting: { label: 'Quoting', icon: 'request_quote' },
  comparison: { label: 'Compare', icon: 'compare_arrows' },
  recommendation: { label: 'Recommend', icon: 'thumb_up' },
  output: { label: 'Output', icon: 'auto_awesome' },
}

/* ─── Main Component ─── */

export function QueWorkbench({ productLine }: QueWorkbenchProps) {
  const [currentStep, setCurrentStep] = useState<WorkbenchStep>('sessions')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([])

  const { title, icon } = PRODUCT_LINE_LABELS[productLine]
  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  // Navigation handlers
  const goToStep = useCallback((step: WorkbenchStep) => {
    setCurrentStep(step)
  }, [])

  const handleSessionSelect = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
    setCurrentStep('client')
  }, [])

  const handleComparisonNext = useCallback((quoteIds: string[]) => {
    setSelectedQuoteIds(quoteIds)
    setCurrentStep('recommendation')
  }, [])

  const handleSessionComplete = useCallback(() => {
    setActiveSessionId(null)
    setSelectedQuoteIds([])
    setCurrentStep('sessions')
  }, [])

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="material-icons-outlined text-3xl text-[var(--portal)]">{icon}</span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)]">QUE Workbench</p>
        </div>
      </div>

      {/* Step Progress Bar */}
      {activeSessionId && (
        <div className="mb-6 flex items-center gap-1 rounded-lg bg-[var(--bg-secondary)] p-2">
          {STEP_ORDER.map((step, idx) => {
            const meta = STEP_META[step]
            const isActive = step === currentStep
            const isPast = idx < currentStepIndex
            const isFuture = idx > currentStepIndex

            return (
              <div key={step} className="flex flex-1 items-center">
                <button
                  onClick={() => isPast ? goToStep(step) : undefined}
                  disabled={isFuture}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--portal)] text-white'
                      : isPast
                        ? 'cursor-pointer text-[var(--portal)] hover:bg-[var(--bg-hover)]'
                        : 'cursor-default text-[var(--text-muted)]'
                  }`}
                >
                  <span
                    className="material-icons-outlined"
                    style={{ fontSize: '16px' }}
                  >
                    {isPast ? 'check_circle' : meta.icon}
                  </span>
                  <span className="hidden sm:inline">{meta.label}</span>
                </button>
                {idx < STEP_ORDER.length - 1 && (
                  <div className={`mx-1 h-px w-4 shrink-0 ${
                    idx < currentStepIndex ? 'bg-[var(--portal)]' : 'bg-[var(--border)]'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Step Content */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        {/* Step 1: Session List (placeholder) */}
        {currentStep === 'sessions' && (
          <SessionListPlaceholder
            productLine={productLine}
            onSelect={handleSessionSelect}
          />
        )}

        {/* Step 2: Client Info (placeholder) */}
        {currentStep === 'client' && activeSessionId && (
          <ClientInfoPlaceholder
            sessionId={activeSessionId}
            onNext={() => goToStep('quoting')}
            onBack={() => goToStep('sessions')}
          />
        )}

        {/* Step 3: Quoting (placeholder) */}
        {currentStep === 'quoting' && activeSessionId && (
          <QuotingPlaceholder
            sessionId={activeSessionId}
            productLine={productLine}
            onNext={() => goToStep('comparison')}
            onBack={() => goToStep('client')}
          />
        )}

        {/* Step 4: Comparison */}
        {currentStep === 'comparison' && activeSessionId && (
          <ComparisonTable
            sessionId={activeSessionId}
            onNext={handleComparisonNext}
            onBack={() => goToStep('quoting')}
          />
        )}

        {/* Step 5: Recommendation */}
        {currentStep === 'recommendation' && activeSessionId && (
          <Recommendation
            sessionId={activeSessionId}
            selectedQuoteIds={selectedQuoteIds}
            onNext={() => goToStep('output')}
            onBack={() => goToStep('comparison')}
          />
        )}

        {/* Step 6: Output Generation */}
        {currentStep === 'output' && activeSessionId && (
          <OutputGeneration
            sessionId={activeSessionId}
            onComplete={handleSessionComplete}
            onBack={() => goToStep('recommendation')}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Placeholder Steps (1-3) ─── */
/* These will be fully implemented in a separate builder task */

function SessionListPlaceholder({
  productLine,
  onSelect,
}: {
  productLine: ProductLine
  onSelect: (sessionId: string) => void
}) {
  const label = PRODUCT_LINE_LABELS[productLine].title

  return (
    <div className="text-center">
      <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">folder_open</span>
      <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{label} Sessions</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Session list and creation UI will be wired here. Start a new session or resume an existing one.
      </p>
      <button
        onClick={() => onSelect('demo-session-' + Date.now())}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
        Start New Session (Demo)
      </button>
    </div>
  )
}

function ClientInfoPlaceholder({
  sessionId: _sessionId,
  onNext,
  onBack,
}: {
  sessionId: string
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Client Information</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Client selection, household details, and account inventory will be captured here.
      </p>
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Continue to Quoting
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

function QuotingPlaceholder({
  sessionId: _sessionId,
  productLine,
  onNext,
  onBack,
}: {
  sessionId: string
  productLine: ProductLine
  onNext: () => void
  onBack: () => void
}) {
  const label = PRODUCT_LINE_LABELS[productLine].title

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{label} Quoting</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Product quoting engine and carrier rate pulls will run here. Results feed into the comparison step.
      </p>
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Continue to Comparison
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
