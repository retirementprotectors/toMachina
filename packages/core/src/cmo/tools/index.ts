/**
 * CMO Tools Barrel (MUS-C09)
 * Aggregates all tool arrays from domain-specific files.
 */
import type { CmoRegistryEntry } from '../types'
import { CANVA_TOOLS } from './canva'
import { WORDPRESS_TOOLS } from './wordpress'
import { VEO_TOOLS } from './veo'
import { C3_TOOLS } from './campaigns'
import { CREATIVE_TOOLS } from './creative'

export { CANVA_TOOLS } from './canva'
export { WORDPRESS_TOOLS } from './wordpress'
export { VEO_TOOLS } from './veo'
export { C3_TOOLS } from './campaigns'
export { CREATIVE_TOOLS } from './creative'

/** All CMO tools — 54 entries across 7 domains */
export const CMO_TOOLS: CmoRegistryEntry[] = [
  ...CANVA_TOOLS,
  ...WORDPRESS_TOOLS,
  ...VEO_TOOLS,
  ...C3_TOOLS,
  ...CREATIVE_TOOLS,
]
