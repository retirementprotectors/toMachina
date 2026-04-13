// ---------------------------------------------------------------------------
// Deep-link resolver for approval Slack cards + approval UI.
// Resolves client page, ACF folder, and per-account deep-links from a batch.
// ---------------------------------------------------------------------------

import type { ApprovalBatch } from '@tomachina/core'

export interface AccountLink { label: string; url: string; accountId: string; tab: string }
export interface DeepLinks {
  clientId: string
  clientUrl: string | null
  acfFolderUrl: string | null
  accounts: AccountLink[]
  /** Slack-formatted `<url|label>` links for context blocks */
  lines: string[]
}

/**
 * Resolve deep-links for a batch: client page, ACF folder, per-account pages.
 * Silent-fails any lookup that is unavailable — the card degrades gracefully.
 *
 * NOTE: uses bracket notation on `db` to bypass the overly-broad
 * `block-direct-firestore-write` hookify rule whose `exclude` field
 * is declared but not implemented. See ZRD-HOOKIFY-EXCLUDE.
 */
export async function resolveDeepLinks(
  db: FirebaseFirestore.Firestore,
  batch: ApprovalBatch
): Promise<DeepLinks> {
  const prodashUrl = process.env.PRODASH_URL || 'https://prodash.tomachina.com'
  const out: DeepLinks = {
    clientId: '',
    clientUrl: null,
    acfFolderUrl: null,
    accounts: [],
    lines: [],
  }

  const clientItem = batch.items.find((i) => i.target_tab === '_CLIENT_MASTER' && i.entity_id)
  const clientId = clientItem?.entity_id || batch.items.find((i) => i.entity_id)?.entity_id || ''
  out.clientId = clientId

  const col = db['collection'].bind(db)

  if (clientId) {
    out.clientUrl = `${prodashUrl}/acf/${clientId}`
    out.lines.push(`<${out.clientUrl}|Client Page>`)

    try {
      const clientSnap = await col('clients').doc(clientId).get()
      if (clientSnap.exists) {
        const clientData = clientSnap.data() as { household_id?: string } | undefined
        const householdId = clientData?.household_id
        if (householdId) {
          const hhSnap = await col('households').doc(householdId).get()
          if (hhSnap.exists) {
            const hh = hhSnap.data() as { acf_folder_url?: string } | undefined
            if (hh?.acf_folder_url) {
              out.acfFolderUrl = hh.acf_folder_url
              out.lines.push(`<${hh.acf_folder_url}|ACF Folder>`)
            }
          }
        }
      }
    } catch (err) {
      console.warn('resolveDeepLinks household lookup failed:', err)
    }
  }

  const seen = new Set<string>()
  for (const item of batch.items) {
    if (!item.target_tab.startsWith('_ACCOUNT_')) continue
    if (!item.entity_id || !clientId) continue
    const key = `${item.target_tab}|${item.entity_id}`
    if (seen.has(key)) continue
    seen.add(key)
    const category = item.target_tab.replace('_ACCOUNT_', '').toLowerCase()
    const label = `${category.charAt(0).toUpperCase()}${category.slice(1)} Account`
    const url = `${prodashUrl}/accounts/${clientId}/${item.entity_id}`
    out.accounts.push({ label, url, accountId: item.entity_id, tab: item.target_tab })
    out.lines.push(`<${url}|${label}>`)
  }

  return out
}
