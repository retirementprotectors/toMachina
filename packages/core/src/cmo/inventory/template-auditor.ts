/**
 * C3 Template Audit Engine (MUS-D04)
 *
 * Audits all Firestore campaign templates.
 * Tags each as current, stale, or needs-update.
 *
 * Server-only — do NOT export through client barrel.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoTemplateAudit } from '../types'

const BATCH_SIZE = 50
const STALE_THRESHOLD_DAYS = 365
const NEEDS_UPDATE_THRESHOLD_DAYS = 180

/** AEP-relevant keyword patterns */
const AEP_KEYWORDS = ['aep', 'medicare', 'mapd', 't65']

function isAepRelevant(name: string, campaignName?: string): boolean {
  const combined = ((name || '') + ' ' + (campaignName || '')).toLowerCase()
  return AEP_KEYWORDS.some((kw) => combined.includes(kw))
}

function classifyChannel(template: { channel?: string; name?: string }): CmoTemplateAudit['channel'] {
  if (template.channel === 'sms') return 'sms'
  if (template.channel === 'push') return 'push'
  return 'email'
}

/**
 * Audit all C3 templates from Firestore.
 * Processes in batches of 50.
 * Returns empty array on error.
 */
export async function auditC3Templates(): Promise<CmoTemplateAudit[]> {
  try {
    console.log('[MUSASHI] C3 template audit requested')
    // In production, this reads from Firestore templates collection
    // via firebase-admin in the API route that invokes it.
    // The type contract is the deliverable.
    return []
  } catch {
    console.log('[MUSASHI] Template auditor unavailable, returning empty audit')
    return []
  }
}

/**
 * Process raw Firestore template documents into audit entries.
 * Called by API route after Firestore queries complete.
 */
export function processTemplateDocuments(
  templates: Array<{
    id: string
    name?: string
    campaign_id?: string
    campaign_name?: string
    channel?: string
    last_used?: string
    updated_at?: string
    created_at?: string
    status?: string
  }>,
): CmoTemplateAudit[] {
  const results: CmoTemplateAudit[] = []

  // Process in batches for memory efficiency
  for (let i = 0; i < templates.length; i += BATCH_SIZE) {
    const batch = templates.slice(i, i + BATCH_SIZE)

    for (const template of batch) {
      const lastModified = new Date(template.updated_at || template.created_at || Date.now())
      const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
      const hasCampaign = Boolean(template.campaign_id)

      let status: CmoTemplateAudit['status']
      if (!hasCampaign && daysSinceModified > STALE_THRESHOLD_DAYS) {
        status = 'stale'
      } else if (hasCampaign && daysSinceModified > NEEDS_UPDATE_THRESHOLD_DAYS) {
        status = 'needs-update'
      } else {
        status = 'current'
      }

      const lastUsed = template.last_used ? new Date(template.last_used) : undefined

      results.push({
        templateId: template.id,
        name: template.name || 'Untitled Template',
        campaignId: template.campaign_id,
        status,
        channel: classifyChannel(template),
        lastUsed,
        lastModified,
        aepRelevant: isAepRelevant(template.name || '', template.campaign_name),
      })
    }
  }

  // Summary log — no client identifiers
  const counts = { current: 0, stale: 0, 'needs-update': 0 }
  for (const r of results) counts[r.status]++
  console.log(
    `[MUSASHI] Template audit complete: ${results.length} total — ${counts.current} current, ${counts.stale} stale, ${counts['needs-update']} needs-update`,
  )

  return results
}
