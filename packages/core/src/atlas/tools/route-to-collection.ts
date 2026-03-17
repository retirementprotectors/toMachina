// ---------------------------------------------------------------------------
// Atomic Tool: route-to-collection
// Maps introspect result / category hint to target Firestore collection
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition, AtomicToolResult } from '../types'

export const definition: AtomicToolDefinition = {
  tool_id: 'route-to-collection',
  name: 'Route to Collection',
  description:
    'Determine the target Firestore collection from introspection results, account category, or explicit hints. Maps category -> collection for downstream write operations.',
  used_by: ['SUPER_EXTRACT', 'SUPER_WRITE'],
}

/**
 * Category-to-collection routing table.
 * Maps account categories / data domains to Firestore collections.
 */
const COLLECTION_ROUTES: Record<string, string> = {
  // Account categories
  medicare: 'accounts',
  annuity: 'accounts',
  life: 'accounts',
  bdria: 'accounts',
  banking: 'accounts',

  // Data domains
  clients: 'clients',
  client: 'clients',
  demographics: 'clients',
  enrollment: 'accounts',
  accounts: 'accounts',
  commissions: 'revenue',
  revenue: 'revenue',
  producers: 'producers',
  agents: 'producers',
  carriers: 'carriers',
  products: 'products',
  opportunities: 'opportunities',

  // Reference data
  reference: 'carriers',
  rates: 'products',
}

/**
 * Category-to-subcollection routing.
 * When the target is 'accounts', the subcollection path depends on category.
 */
const SUBCOLLECTION_ROUTES: Record<string, string> = {
  medicare: 'medicare_accounts',
  annuity: 'annuity_accounts',
  life: 'life_accounts',
  bdria: 'bdria_accounts',
  banking: 'banking_accounts',
}

export interface RouteInput {
  /** Account category or data domain hint */
  category?: string
  /** Target category from introspection */
  target_category?: string
  /** Explicit collection override */
  collection_override?: string
  /** Data domain from wire definition */
  data_domain?: string
}

export interface RouteOutput {
  collection: string
  subcollection?: string
  /** How the route was determined */
  route_method: 'explicit_override' | 'category_match' | 'target_category_match' | 'data_domain_match' | 'default'
}

/**
 * Determine target Firestore collection from available hints.
 * Priority: explicit override > category > target_category > data_domain > default
 */
export function execute(input: RouteInput): AtomicToolResult<RouteOutput> {
  // Priority 1: Explicit override
  if (input.collection_override) {
    return {
      success: true,
      data: {
        collection: input.collection_override,
        route_method: 'explicit_override',
      },
    }
  }

  // Priority 2: Category
  if (input.category) {
    const lower = input.category.toLowerCase()
    const collection = COLLECTION_ROUTES[lower]
    if (collection) {
      return {
        success: true,
        data: {
          collection,
          subcollection: SUBCOLLECTION_ROUTES[lower],
          route_method: 'category_match',
        },
      }
    }
  }

  // Priority 3: Target category (from introspection)
  if (input.target_category) {
    const lower = input.target_category.toLowerCase()
    const collection = COLLECTION_ROUTES[lower]
    if (collection) {
      return {
        success: true,
        data: {
          collection,
          subcollection: SUBCOLLECTION_ROUTES[lower],
          route_method: 'target_category_match',
        },
      }
    }
  }

  // Priority 4: Data domain
  if (input.data_domain) {
    const lower = input.data_domain.toLowerCase()
    const collection = COLLECTION_ROUTES[lower]
    if (collection) {
      return {
        success: true,
        data: {
          collection,
          route_method: 'data_domain_match',
        },
      }
    }
  }

  // Default: clients collection (safest default for unknown data)
  return {
    success: true,
    data: {
      collection: 'clients',
      route_method: 'default',
    },
  }
}
