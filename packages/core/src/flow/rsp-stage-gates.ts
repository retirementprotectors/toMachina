/**
 * RSP Stage Gates — TRK-RSP-003
 *
 * Pure functions for evaluating RSP pipeline gate completion.
 * Weight distribution: client 30%, accounts 30%, auth 20%, reports 20%
 * Advancement permitted only at 100% completion.
 */

export interface GateCategory {
  name: string
  weight: number
  items: GateItem[]
}

export interface GateItem {
  label: string
  complete: boolean
  required: boolean
}

export interface GateResult {
  stage: string
  percentage: number
  categories: GateCategory[]
  blockers: string[]
  canAdvance: boolean
}

/**
 * Evaluate Orange → Blue gate (Discovery complete).
 * Client profile, accounts reviewed, auth forms sent.
 */
export function evaluateOrangeGate(data: {
  clientProfileComplete: boolean
  accountsReviewed: boolean
  authFormsSent: number
  authFormsTotal: number
  reportsOrdered: boolean
}): GateResult {
  const categories: GateCategory[] = [
    {
      name: 'Client Profile',
      weight: 30,
      items: [
        { label: 'Ai3 profile complete', complete: data.clientProfileComplete, required: true },
      ],
    },
    {
      name: 'Accounts',
      weight: 30,
      items: [
        { label: 'All accounts reviewed', complete: data.accountsReviewed, required: true },
      ],
    },
    {
      name: 'Authorizations',
      weight: 20,
      items: [
        { label: `Auth forms sent (${data.authFormsSent}/${data.authFormsTotal})`, complete: data.authFormsSent >= data.authFormsTotal, required: true },
      ],
    },
    {
      name: 'Reports',
      weight: 20,
      items: [
        { label: 'Reports ordered', complete: data.reportsOrdered, required: true },
      ],
    },
  ]

  return computeGateResult('orange_discovery', categories)
}

/**
 * Evaluate Blue → Yellow gate (Analysis complete).
 * All reports received, auth forms signed, illustrations run.
 */
export function evaluateBlueGate(data: {
  reportsReceived: number
  reportsTotal: number
  authFormsSigned: number
  authFormsTotal: number
  illustrationsRun: boolean
}): GateResult {
  const categories: GateCategory[] = [
    {
      name: 'Reports',
      weight: 30,
      items: [
        { label: `Reports received (${data.reportsReceived}/${data.reportsTotal})`, complete: data.reportsReceived >= data.reportsTotal, required: true },
      ],
    },
    {
      name: 'Authorizations',
      weight: 30,
      items: [
        { label: `Auth forms signed (${data.authFormsSigned}/${data.authFormsTotal})`, complete: data.authFormsSigned >= data.authFormsTotal, required: true },
      ],
    },
    {
      name: 'Illustrations',
      weight: 20,
      items: [
        { label: 'Illustrations run', complete: data.illustrationsRun, required: true },
      ],
    },
    {
      name: 'Analysis',
      weight: 20,
      items: [
        { label: 'Analysis complete', complete: data.reportsReceived >= data.reportsTotal && data.illustrationsRun, required: true },
      ],
    },
  ]

  return computeGateResult('blue_analysis', categories)
}

function computeGateResult(stage: string, categories: GateCategory[]): GateResult {
  let totalWeightedScore = 0
  const blockers: string[] = []

  for (const cat of categories) {
    const completedItems = cat.items.filter((i) => i.complete).length
    const totalItems = cat.items.length
    const categoryPct = totalItems > 0 ? completedItems / totalItems : 0
    totalWeightedScore += categoryPct * cat.weight

    for (const item of cat.items) {
      if (!item.complete && item.required) {
        blockers.push(`${cat.name}: ${item.label}`)
      }
    }
  }

  const percentage = Math.round(totalWeightedScore)

  return {
    stage,
    percentage,
    categories,
    blockers,
    canAdvance: percentage >= 100,
  }
}
