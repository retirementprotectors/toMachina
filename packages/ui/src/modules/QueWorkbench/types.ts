export type WizardStep = 'client_snapshot' | 'quote_parameters' | 'quote_results' | 'comparison' | 'recommendation' | 'output_generation'

export const WIZARD_STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: 'client_snapshot', label: 'Client Data', number: 1 },
  { id: 'quote_parameters', label: 'Parameters', number: 2 },
  { id: 'quote_results', label: 'Quotes', number: 3 },
  { id: 'comparison', label: 'Compare', number: 4 },
  { id: 'recommendation', label: 'Recommend', number: 5 },
  { id: 'output_generation', label: 'Output', number: 6 },
]

export type QueProductLine = 'LIFE' | 'ANNUITY' | 'MEDICARE' | 'INVESTMENT'

export interface WizardState {
  currentStep: WizardStep
  sessionId: string | null
  householdId: string | null
  productLine: QueProductLine
  completedSteps: WizardStep[]
}

/** Session list view type */
export interface SessionListItem {
  session_id: string
  household_id: string
  household_name: string
  product_line: string
  status: string
  assigned_to: string
  created_at: string
  updated_at: string
  quote_count?: number
}
