/**
 * lookup-community-property
 * Returns whether a state is a community property state (requires spousal signatures).
 *
 * Source: IRS + State law — 10 states: AK, AZ, CA, ID, LA, NM, NV, TX, WA, WI
 *
 * @param stateCode - Two-letter state code
 * @returns Object with isCommunityProperty flag and state name
 */

import {
  COMMUNITY_PROPERTY_STATES,
  COMMUNITY_PROPERTY_STATE_NAMES,
  isCommunityPropertyState,
} from './data/community-property-states'

export interface CommunityPropertyResult {
  stateCode: string
  isCommunityProperty: boolean
  stateName?: string
  /** All community property states for reference */
  allCommunityPropertyStates: string[]
}

export function lookupCommunityProperty(stateCode: string): CommunityPropertyResult {
  const upper = stateCode.toUpperCase()
  return {
    stateCode: upper,
    isCommunityProperty: isCommunityPropertyState(upper),
    stateName: COMMUNITY_PROPERTY_STATE_NAMES[upper],
    allCommunityPropertyStates: [...COMMUNITY_PROPERTY_STATES],
  }
}
