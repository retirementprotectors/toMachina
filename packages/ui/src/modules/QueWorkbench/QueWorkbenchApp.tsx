'use client'

import { useState, useCallback } from 'react'
import { WizardProgress } from './shared/WizardProgress'
import { QueSessionList } from './QueSessionList'
import { ClientSnapshot } from './steps/ClientSnapshot'
import { QuoteParameters } from './steps/QuoteParameters'
import { QuoteResults } from './steps/QuoteResults'
import { ComparisonStep } from './steps/ComparisonStep'
import { RecommendationStep } from './steps/RecommendationStep'
import { OutputGeneration } from './steps/OutputGeneration'
import { WIZARD_STEPS, type QueProductLine, type WizardState, type WizardStep } from './types'

interface QueWorkbenchAppProps {
  productLine: QueProductLine
}

type ViewMode = 'list' | 'wizard'

const INITIAL_WIZARD_STATE: WizardState = {
  currentStep: 'client_snapshot',
  sessionId: null,
  householdId: null,
  productLine: 'MEDICARE',
  completedSteps: [],
}

export default function QueWorkbenchApp({ productLine }: QueWorkbenchAppProps) {
  const [view, setView] = useState<ViewMode>('list')
  const [wizardState, setWizardState] = useState<WizardState>({
    ...INITIAL_WIZARD_STATE,
    productLine,
  })

  /* ── Session selection ── */

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setWizardState({
        ...INITIAL_WIZARD_STATE,
        productLine,
        sessionId,
      })
      setView('wizard')
    },
    [productLine],
  )

  const handleNewSession = useCallback(() => {
    setWizardState({
      ...INITIAL_WIZARD_STATE,
      productLine,
    })
    setView('wizard')
  }, [productLine])

  const handleBackToList = useCallback(() => {
    setView('list')
    setWizardState({
      ...INITIAL_WIZARD_STATE,
      productLine,
    })
  }, [productLine])

  /* ── Step navigation ── */

  const advanceStep = useCallback(() => {
    setWizardState((prev) => {
      const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === prev.currentStep)
      const nextStep = WIZARD_STEPS[currentIndex + 1]
      if (!nextStep) return prev
      return {
        ...prev,
        completedSteps: prev.completedSteps.includes(prev.currentStep)
          ? prev.completedSteps
          : [...prev.completedSteps, prev.currentStep],
        currentStep: nextStep.id,
      }
    })
  }, [])

  const goBack = useCallback(() => {
    setWizardState((prev) => {
      const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === prev.currentStep)
      const prevStep = WIZARD_STEPS[currentIndex - 1]
      if (!prevStep) return prev
      return { ...prev, currentStep: prevStep.id }
    })
  }, [])

  const goToStep = useCallback((step: WizardStep) => {
    setWizardState((prev) => {
      if (!prev.completedSteps.includes(step)) return prev
      return { ...prev, currentStep: step }
    })
  }, [])

  const updateSessionId = useCallback((sessionId: string) => {
    setWizardState((prev) => ({ ...prev, sessionId }))
  }, [])

  /* ── Render ── */

  if (view === 'list') {
    return (
      <div className="h-full bg-[var(--bg-surface)]">
        <QueSessionList
          productLine={productLine}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
      </div>
    )
  }

  const renderStep = () => {
    const sid = wizardState.sessionId

    switch (wizardState.currentStep) {
      case 'client_snapshot':
        return (
          <ClientSnapshot
            sessionId={sid}
            productLine={productLine}
            onNext={advanceStep}
            onSessionCreated={updateSessionId}
          />
        )
      case 'quote_parameters':
        return sid ? (
          <QuoteParameters
            sessionId={sid}
            productLine={productLine}
            onNext={advanceStep}
            onBack={goBack}
          />
        ) : null
      case 'quote_results':
        return sid ? (
          <QuoteResults
            sessionId={sid}
            productLine={productLine}
            onNext={advanceStep}
            onBack={goBack}
          />
        ) : null
      case 'comparison':
        return sid ? (
          <ComparisonStep
            sessionId={sid}
            onNext={advanceStep}
            onBack={goBack}
          />
        ) : null
      case 'recommendation':
        return sid ? (
          <RecommendationStep
            sessionId={sid}
            productLine={productLine}
            onNext={advanceStep}
            onBack={goBack}
          />
        ) : null
      case 'output_generation':
        return sid ? (
          <OutputGeneration
            sessionId={sid}
            onBack={goBack}
            onComplete={handleBackToList}
          />
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-6 py-3">
        <button
          type="button"
          onClick={handleBackToList}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Sessions
        </button>
        <span className="text-xs text-[var(--text-muted)]">|</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {wizardState.sessionId ? `Session ${wizardState.sessionId.slice(0, 8)}...` : 'New Session'}
        </span>
      </div>

      {/* Wizard progress */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <WizardProgress
          currentStep={wizardState.currentStep}
          completedSteps={wizardState.completedSteps}
          onStepClick={goToStep}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {renderStep()}
      </div>
    </div>
  )
}
