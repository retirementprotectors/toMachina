/**
 * Community Property States
 * These states require spousal signatures on certain financial transactions.
 *
 * Source: IRS + State law reference
 * 10 states total (9 community property + opt-in Alaska)
 */

export const COMMUNITY_PROPERTY_STATES: string[] = [
  'AK', // Alaska (opt-in)
  'AZ', // Arizona
  'CA', // California
  'ID', // Idaho
  'LA', // Louisiana
  'NM', // New Mexico
  'NV', // Nevada
  'TX', // Texas
  'WA', // Washington
  'WI', // Wisconsin
]

export const COMMUNITY_PROPERTY_STATE_NAMES: Record<string, string> = {
  AK: 'Alaska (opt-in)',
  AZ: 'Arizona',
  CA: 'California',
  ID: 'Idaho',
  LA: 'Louisiana',
  NM: 'New Mexico',
  NV: 'Nevada',
  TX: 'Texas',
  WA: 'Washington',
  WI: 'Wisconsin',
}

/**
 * Check if a state is a community property state.
 */
export function isCommunityPropertyState(stateCode: string): boolean {
  return COMMUNITY_PROPERTY_STATES.includes(stateCode.toUpperCase())
}
