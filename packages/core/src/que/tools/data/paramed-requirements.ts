/** Face amount thresholds for medical underwriting requirements */

export interface ParamedRequirement {
  minFace: number
  maxFace: number
  requirements: string[]
}

const PARAMED_REQUIREMENTS: ParamedRequirement[] = [
  { minFace: 0, maxFace: 100000, requirements: ['application only', 'no exam — simplified issue or guaranteed issue'] },
  { minFace: 100001, maxFace: 500000, requirements: ['paramed exam (height/weight/BP/pulse)', 'blood draw', 'urine specimen', 'phone interview'] },
  { minFace: 500001, maxFace: 1000000, requirements: ['full medical exam', 'comprehensive blood panel', 'urine specimen', 'EKG (age 50+)', 'phone interview', 'inspection report'] },
  { minFace: 1000001, maxFace: Infinity, requirements: ['full medical exam', 'comprehensive blood panel', 'urine specimen', 'EKG', 'attending physician statement (APS)', 'financial documentation', 'inspection report', 'possible treadmill stress test (age 60+)'] },
]

export function findParamedRequirements(faceAmount: number): ParamedRequirement | undefined {
  return PARAMED_REQUIREMENTS.find(r => faceAmount >= r.minFace && faceAmount <= r.maxFace)
}
