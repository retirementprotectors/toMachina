/**
 * Parity Executor (MUS-D06)
 *
 * Dispatches parity gaps to the correct Artisan wire(s).
 * Supports dry-run mode. Never dispatches to Social or Video.
 *
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type {
  CmoParityGap,
  CmoParityExecutionResult,
  CmoWireDispatch,
  CmoDigitalParityItem,
} from '../types'

/** Map digital gap type to the correct wire + artisan */
function getDispatchTarget(
  digitalType: CmoDigitalParityItem['type'],
): { wireId: string; artisan: string } | null {
  switch (digitalType) {
    case 'email-sequence':
      return { wireId: 'WIRE_CAMPAIGN', artisan: 'digital-artisan' }
    case 'landing-page':
      return { wireId: 'WIRE_LANDING_PAGE', artisan: 'web-artisan' }
    case 'portal-content':
      return { wireId: 'WIRE_CAMPAIGN', artisan: 'digital-artisan' }
    // Social and Video run on their own schedule — never dispatched from parity
    case 'social':
    case 'video':
      return null
    default:
      return null
  }
}

/**
 * Execute a single parity gap — dispatch to correct wire(s).
 *
 * @param gap - The parity gap to close
 * @param opts.dryRun - If true, returns dispatch plan without calling wires
 */
export async function executeParityGap(
  gap: CmoParityGap,
  opts?: { dryRun?: boolean },
): Promise<CmoParityExecutionResult> {
  const dispatched: CmoWireDispatch[] = []
  const failed: string[] = []
  const dryRun = opts?.dryRun ?? false

  for (const missing of gap.missingDigital) {
    if (missing.status !== 'missing') continue

    const target = getDispatchTarget(missing.type)

    if (!target) {
      dispatched.push({
        wireId: 'none',
        artisan: 'none',
        input: {},
        status: 'skipped',
      })
      continue
    }

    const input: Record<string, unknown> = {
      printAssetId: gap.printAssetId,
      printAssetName: gap.printAssetName,
      printAssetType: gap.printAssetType,
      digitalType: missing.type,
      market: gap.marketRelevance[0] || 'all',
      portalContent: missing.type === 'portal-content',
    }

    if (dryRun) {
      dispatched.push({
        wireId: target.wireId,
        artisan: target.artisan,
        input,
        status: 'dispatched',
      })
      continue
    }

    try {
      // In production, this calls executeWire with the appropriate runner
      // For now, mark as dispatched — wire execution is handled by API layer
      dispatched.push({
        wireId: target.wireId,
        artisan: target.artisan,
        input,
        status: 'dispatched',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log(`[MUSASHI] Parity dispatch failed for ${missing.type}: ${errMsg}`)
      failed.push(`${missing.type}: ${errMsg}`)
      dispatched.push({
        wireId: target.wireId,
        artisan: target.artisan,
        input,
        status: 'failed',
      })
    }
  }

  const summary = dryRun
    ? `Dry-run: ${dispatched.filter((d) => d.status === 'dispatched').length} dispatches planned for ${gap.printAssetName}`
    : `${dispatched.filter((d) => d.status === 'dispatched').length} dispatched, ${failed.length} failed for ${gap.printAssetName}`

  return {
    gapId: gap.printAssetId,
    dispatched,
    failed,
    summary,
  }
}
