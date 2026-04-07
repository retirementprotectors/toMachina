/** Health condition to underwriting rate class mapping */

export interface HealthRating {
  condition: string
  bestClass: string
  typicalClass: string
  worstClass: string
  notes: string
}

const HEALTH_RATING_MAP: HealthRating[] = [
  { condition: 'diabetes-type2', bestClass: 'standard', typicalClass: 'table-1', worstClass: 'table-4', notes: 'A1C < 7.0 and well-controlled may qualify standard. Insulin-dependent typically table 2-4.' },
  { condition: 'heart-disease', bestClass: 'table-1', typicalClass: 'table-2', worstClass: 'decline', notes: 'History of MI or bypass is table 2+ minimum. Stable 5+ years with good echo may improve.' },
  { condition: 'cancer-history', bestClass: 'preferred', typicalClass: 'standard', worstClass: 'decline', notes: '5+ years cancer-free for most types. Basal cell carcinoma often preferred. Melanoma requires longer remission.' },
  { condition: 'hypertension', bestClass: 'preferred', typicalClass: 'standard', worstClass: 'table-2', notes: 'Controlled BP < 140/90 on 1-2 meds can be preferred. Uncontrolled or 3+ meds typically standard or worse.' },
  { condition: 'obesity', bestClass: 'standard', typicalClass: 'table-1', worstClass: 'table-4', notes: 'BMI 30-35 typically standard. BMI 35-40 table 1-2. BMI 40+ table 3-4 or decline.' },
  { condition: 'depression', bestClass: 'preferred', typicalClass: 'preferred', worstClass: 'standard', notes: 'Stable on medication with no hospitalization often preferred. Recent hospitalization or multiple episodes may downgrade.' },
  { condition: 'sleep-apnea', bestClass: 'preferred', typicalClass: 'standard', worstClass: 'table-1', notes: 'Compliant CPAP use (4+ hrs/night) with recent sleep study often preferred. Non-compliant typically standard.' },
  { condition: 'tobacco', bestClass: 'standard', typicalClass: 'standard', worstClass: 'table-2', notes: 'Any tobacco/nicotine in last 12 months = tobacco rates. 12+ months quit may qualify preferred non-tobacco.' },
]

export function findHealthRating(condition: string): HealthRating | undefined {
  return HEALTH_RATING_MAP.find(r => r.condition === condition.toLowerCase())
}

export function getAllHealthConditions(): string[] {
  return HEALTH_RATING_MAP.map(r => r.condition)
}
