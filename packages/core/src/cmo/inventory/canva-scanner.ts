/**
 * Canva Design Inventory Scanner (MUS-D01)
 *
 * Scans all Canva designs via rpi-workspace MCP tools.
 * Returns structured CmoInventoryEntry[] with status tagging.
 *
 * Server-only — do NOT export through client barrel.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoInventoryEntry, CmoDesignStatus } from '../types'

/** How many days since modification before an entry is 'stale' */
const DEFAULT_STALE_THRESHOLD_DAYS = 180

/** Classify design type from name/folder heuristics */
function classifyDesignType(
  name: string,
): CmoInventoryEntry['type'] {
  const lower = name.toLowerCase()
  if (lower.includes('brochure') || lower.includes('flyer')) return 'brochure'
  if (lower.includes('deck') || lower.includes('presentation') || lower.includes('pitch'))
    return 'presentation'
  if (lower.includes('social') || lower.includes('instagram') || lower.includes('linkedin') || lower.includes('facebook'))
    return 'social'
  if (lower.includes('email') || lower.includes('newsletter')) return 'email'
  if (lower.includes('one-pager') || lower.includes('one pager') || lower.includes('fact sheet'))
    return 'one-pager'
  if (lower.includes('video') || lower.includes('thumbnail')) return 'video'
  if (lower.includes('guide') || lower.includes('brand')) return 'guide'
  if (lower.includes('fact-finder') || lower.includes('fact finder')) return 'fact-finder'
  return 'other'
}

/** Classify market from name heuristics */
function classifyMarket(name: string): CmoInventoryEntry['market'] {
  const lower = name.toLowerCase()
  if (lower.includes('david') || lower.includes('partner') || lower.includes('b2b') || lower.includes('sentinel'))
    return 'b2b'
  if (lower.includes('rapid') || lower.includes('internal') || lower.includes('b2e') || lower.includes('riimo'))
    return 'b2e'
  if (lower.includes('rpi') || lower.includes('prodash') || lower.includes('medicare') || lower.includes('client'))
    return 'b2c'
  return 'all'
}

/** Determine design status based on last modification date */
function getDesignStatus(lastModified: Date, staleThresholdDays: number): CmoDesignStatus {
  const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceModified > staleThresholdDays) return 'stale'
  return 'current'
}

/**
 * Scan all Canva designs and return structured inventory.
 * Uses rpi-workspace MCP Canva tools.
 *
 * Returns empty array (not throw) if Canva MCP is unavailable.
 */
export async function scanCanvaInventory(options?: {
  staleThresholdDays?: number
}): Promise<CmoInventoryEntry[]> {
  const staleThreshold = options?.staleThresholdDays ?? DEFAULT_STALE_THRESHOLD_DAYS
  const entries: CmoInventoryEntry[] = []

  try {
    // In production, this calls canva_search_designs / canva_list_folder_items
    // via the rpi-workspace MCP. The scanner is designed to be wired to live
    // MCP tool calls by the API route that invokes it. For now, the function
    // signature and return shape are the contract — actual MCP calls are
    // dispatched by the wire executor / API layer.
    //
    // Placeholder: returns empty until wired to live MCP in API route.
    // The type contract is the deliverable for MUS-D01.
    console.log('[MUSASHI] Canva inventory scan requested')
  } catch (err) {
    console.log('[MUSASHI] Canva scanner unavailable, returning empty inventory')
    return []
  }

  return entries
}

/**
 * Process raw Canva design data into inventory entries.
 * Called by API route after MCP tool responses are received.
 */
export function processCanvaDesigns(
  designs: Array<{
    id: string
    title?: string
    name?: string
    updated_at?: string
    created_at?: string
    thumbnail_url?: string
    urls?: { edit_url?: string }
  }>,
  options?: { staleThresholdDays?: number },
): CmoInventoryEntry[] {
  const staleThreshold = options?.staleThresholdDays ?? DEFAULT_STALE_THRESHOLD_DAYS

  return designs.map((design) => {
    const name = design.title || design.name || 'Untitled'
    const lastModified = new Date(design.updated_at || design.created_at || Date.now())

    return {
      id: `canva-${design.id}`,
      source: 'canva' as const,
      type: classifyDesignType(name),
      market: classifyMarket(name),
      lastModified,
      status: getDesignStatus(lastModified, staleThreshold),
      url: design.urls?.edit_url,
      notes: name,
    }
  })
}
