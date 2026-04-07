/** lookup-paramed-requirements — Face amount to exam requirements */
import type { ParamedRequirement } from './data/paramed-requirements'
import { findParamedRequirements } from './data/paramed-requirements'

export function lookupParamedRequirements(faceAmount: number): ParamedRequirement | undefined {
  return findParamedRequirements(faceAmount)
}
