'use client'

import { WIZARD_STEPS, type WizardStep } from '../types'

interface WizardProgressProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  onStepClick: (step: WizardStep) => void
}

export function WizardProgress({ currentStep, completedSteps, onStepClick }: WizardProgressProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex w-full items-center justify-between px-4 py-4">
      {WIZARD_STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id)
        const isCurrent = step.id === currentStep
        const isClickable = isCompleted
        const isUpcoming = !isCompleted && !isCurrent

        return (
          <div key={step.id} className="flex flex-1 items-center">
            {/* Step circle + label */}
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1.5 ${
                isClickable ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-default'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                  isCompleted
                    ? 'text-white'
                    : isCurrent
                      ? 'text-white shadow-md'
                      : 'border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                }`}
                style={
                  isCompleted
                    ? { background: 'var(--portal)', opacity: 0.8 }
                    : isCurrent
                      ? { background: 'var(--portal)' }
                      : undefined
                }
              >
                {isCompleted ? (
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isCurrent
                    ? 'text-[var(--text-primary)]'
                    : isCompleted
                      ? 'text-[var(--text-secondary)]'
                      : 'text-[var(--text-muted)]'
                }`}
              >
                {step.label}
              </span>
            </button>

            {/* Connector line (not after the last step) */}
            {idx < WIZARD_STEPS.length - 1 && (
              <div className="mx-2 h-0.5 flex-1">
                <div
                  className="h-full rounded-full transition-colors"
                  style={{
                    background:
                      idx < currentIndex
                        ? 'var(--portal)'
                        : 'var(--border-subtle)',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
