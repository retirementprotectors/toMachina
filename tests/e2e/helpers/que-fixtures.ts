/**
 * QUE Super Tool Test Fixtures
 *
 * Static TypeScript mock data for pure (no-Firestore) E2E tests.
 * Each builder returns a SuperToolHousehold with specific characteristics.
 */

import type {
  SuperToolHousehold,
  SuperToolMember,
  SuperToolAccount,
} from '../../../packages/core/src/que/super-tools/types'

// ---------------------------------------------------------------------------
// Base household
// ---------------------------------------------------------------------------

export function buildBaseHousehold(): SuperToolHousehold {
  const robertFia: SuperToolAccount = {
    id: 'acct-robert-fia',
    type: 'fia',
    carrier: 'Athene',
    product: 'Benefit 10',
    accountValue: 350_000,
    taxStatus: 'ira',
    owner: 'Robert',
  }

  const robertIra: SuperToolAccount = {
    id: 'acct-robert-ira',
    type: 'ira',
    carrier: 'Fidelity',
    product: 'Traditional IRA',
    accountValue: 280_000,
    taxStatus: 'ira',
    owner: 'Robert',
  }

  const lindaFia: SuperToolAccount = {
    id: 'acct-linda-fia',
    type: 'fia',
    carrier: 'Nationwide',
    product: 'New Heights 12',
    accountValue: 275_000,
    taxStatus: 'ira',
    owner: 'Linda',
  }

  const lindaBank: SuperToolAccount = {
    id: 'acct-linda-bank',
    type: 'bank',
    carrier: 'Wells Fargo',
    product: 'Savings',
    accountValue: 50_000,
    taxStatus: 'nq',
    owner: 'Linda',
  }

  const robert: SuperToolMember = {
    name: 'Robert',
    age: 68,
    annualIncome: 85_000,
    investableAssets: 1_200_000,
    totalNetWorth: 1_800_000,
    accounts: [robertFia, robertIra],
  }

  const linda: SuperToolMember = {
    name: 'Linda',
    age: 65,
    annualIncome: 42_000,
    investableAssets: 800_000,
    totalNetWorth: 1_400_000,
    accounts: [lindaFia, lindaBank],
  }

  return {
    id: 'e2e-test-household',
    members: [robert, linda],
    filingStatus: 'mfj',
    state: 'IA',
  }
}

// ---------------------------------------------------------------------------
// Variant builders
// ---------------------------------------------------------------------------

/** Add dormant income rider to Robert's FIA */
export function withDormantRiders(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  const robertFia = clone.members[0].accounts.find((a) => a.type === 'fia')!
  robertFia.benefitBase = 420_000
  robertFia.payoutRate = 0.055
  robertFia.riderActivated = false
  return clone
}

/** Add rollup to Linda's FIA (requires benefitBase + payoutRate + rollupRate for income_later) */
export function withRollup(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  const lindaFia = clone.members[1].accounts.find((a) => a.type === 'fia')!
  lindaFia.benefitBase = 320_000
  lindaFia.payoutRate = 0.05
  lindaFia.rollupRate = 0.06
  lindaFia.rollupMethod = 'compound'
  lindaFia.rollupYearsRemaining = 5
  lindaFia.riderActivated = false
  return clone
}

/** Add life insurance policy to Robert */
export function withLifePolicies(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  clone.members[0].accounts.push({
    id: 'acct-robert-life',
    type: 'life',
    carrier: 'Lincoln Financial',
    product: 'UL',
    accountValue: 0,
    cashValue: 45_000,
    deathBenefit: 500_000,
    annualPremium: 3_200,
    taxStatus: 'nq',
    owner: 'Robert',
    guaranteedLapseAge: 95,
  })
  return clone
}

/** Add variable annuity to Robert */
export function withVaAccounts(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  clone.members[0].accounts.push({
    id: 'acct-robert-va',
    type: 'va',
    carrier: 'Jackson National',
    product: 'Perspective II',
    accountValue: 180_000,
    taxStatus: 'ira',
    owner: 'Robert',
    totalFeeRate: 0.032,
    grossReturn: 0.07,
    annualWithdrawal: 12_000,
  })
  return clone
}

/** Add LTC features to Robert's FIA */
export function withLtcFeatures(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  const robertFia = clone.members[0].accounts.find((a) => a.type === 'fia')!
  robertFia.hasEnhancedWithdrawal = true
  robertFia.enhancedWithdrawalPercent = 2.0
  robertFia.hasIncomeMultiplier = true
  robertFia.incomeMultiplierFactor = 2.0
  return clone
}

/** Set Robert to age 73 (forces RMD), ensure IRA has 280k */
export function withIraAccounts(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  clone.members[0].age = 73
  const ira = clone.members[0].accounts.find((a) => a.type === 'ira')!
  ira.accountValue = 280_000
  return clone
}

/** Add NQ account to Linda */
export function withNqAccounts(hh: SuperToolHousehold): SuperToolHousehold {
  const clone = structuredClone(hh)
  clone.members[1].accounts.push({
    id: 'acct-linda-nq',
    type: 'nq',
    carrier: 'Vanguard',
    product: 'S&P 500 Index',
    accountValue: 120_000,
    costBasis: 75_000,
    taxStatus: 'nq',
    owner: 'Linda',
  })
  return clone
}

/** Apply ALL transforms to a single household */
export function withAllTriggers(hh: SuperToolHousehold): SuperToolHousehold {
  let result = withDormantRiders(hh)
  result = withRollup(result)
  result = withLifePolicies(result)
  result = withVaAccounts(result)
  result = withLtcFeatures(result)
  result = withIraAccounts(result)
  result = withNqAccounts(result)
  return result
}
