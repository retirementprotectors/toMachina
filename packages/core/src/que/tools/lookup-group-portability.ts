/** lookup-group-portability — Employer group life conversion rules */
import type { GroupPortabilityRule } from './data/group-portability-rules'
import { findGroupPortabilityRule } from './data/group-portability-rules'

export function lookupGroupPortability(groupType: string): GroupPortabilityRule | undefined {
  return findGroupPortabilityRule(groupType)
}
