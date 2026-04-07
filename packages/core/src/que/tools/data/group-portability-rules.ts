/** Employer group life portability and conversion rules */

export interface GroupPortabilityRule {
  groupType: 'employer-basic' | 'employer-supplemental' | 'employer-add'
  portabilityWindow: number
  conversionWindow: number
  rateMultiplier: number
  maxPortableAmount: number
  notes: string
}

const GROUP_PORTABILITY_RULES: GroupPortabilityRule[] = [
  { groupType: 'employer-basic', portabilityWindow: 31, conversionWindow: 31, rateMultiplier: 2.5, maxPortableAmount: 50000, notes: 'Basic life typically 1-2x salary, capped at $50K portable. Conversion to individual WL at attained-age rates.' },
  { groupType: 'employer-supplemental', portabilityWindow: 31, conversionWindow: 31, rateMultiplier: 1.8, maxPortableAmount: 500000, notes: 'Supplemental coverage portable up to 5x salary. Rate increase at portability. Evidence of insurability may be waived.' },
  { groupType: 'employer-add', portabilityWindow: 0, conversionWindow: 0, rateMultiplier: 0, maxPortableAmount: 0, notes: 'AD&D coverage is NOT portable or convertible. Coverage ends at termination.' },
]

export function findGroupPortabilityRule(groupType: string): GroupPortabilityRule | undefined {
  return GROUP_PORTABILITY_RULES.find(r => r.groupType === groupType)
}
