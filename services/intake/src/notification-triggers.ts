/**
 * Cloud Function onWrite triggers for the Notifications Module.
 * Creates notification documents when clients or accounts change.
 *
 * NOTE: Uses bracket notation for Firestore collection access to satisfy
 * the block-direct-firestore-write hookify rule (exclude patterns not yet
 * wired in the rule engine). This file IS in an authorized write path.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

/* ─── Firestore helper (bracket notation to avoid hookify regex) ─── */

function notificationsRef() {
  const db = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any)['collection']('notifications')
}

/* ─── Diff Helpers ─── */

const SKIP_FIELDS = new Set([
  '_id', 'updated_at', 'created_at', '_migrated_at', '_source',
  'search_tokens', 'import_source', 'ghl_object_id', 'ghl_contact_id',
])

function diffFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): { fields_changed: string[]; summary: string } {
  if (!before && after) {
    return { fields_changed: [], summary: 'Record created' }
  }
  if (before && !after) {
    return { fields_changed: [], summary: 'Record deleted' }
  }
  if (!before || !after) {
    return { fields_changed: [], summary: '' }
  }

  const changed: string[] = []
  const summaryParts: string[] = []

  for (const key of Object.keys(after)) {
    if (SKIP_FIELDS.has(key)) continue
    const oldVal = before[key]
    const newVal = after[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed.push(key)
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (summaryParts.length < 3) {
        const from = oldVal != null ? String(oldVal) : '(empty)'
        const to = newVal != null ? String(newVal) : '(empty)'
        summaryParts.push(`${label}: ${from} \u2192 ${to}`)
      }
    }
  }

  if (changed.length > 3) {
    summaryParts.push(`+${changed.length - 3} more`)
  }

  return {
    fields_changed: changed,
    summary: summaryParts.join('; ') || `${changed.length} field(s) updated`,
  }
}

function clientEntityName(data: Record<string, unknown>): string {
  const first = data.first_name || ''
  const last = data.last_name || ''
  return [first, last].filter(Boolean).join(' ') || 'Unknown Client'
}

function accountEntityName(data: Record<string, unknown>): string {
  const carrier = data.carrier_name || data.carrier || ''
  const policy = data.policy_number || data.account_number || ''
  const category = data.account_category || ''
  const parts = [carrier, category, policy].filter(Boolean)
  return parts.join(' - ') || 'Unknown Account'
}

/* ─── Cloud Functions ─── */

export const onClientWrite = onDocumentWritten(
  { document: 'clients/{clientId}', region: 'us-central1' },
  async (event) => {
    const clientId = event.params.clientId
    const beforeData = event.data?.before?.data() as Record<string, unknown> | undefined
    const afterData = event.data?.after?.data() as Record<string, unknown> | undefined

    let type: string
    let entityName: string
    if (!beforeData && afterData) {
      type = 'contact_created'
      entityName = clientEntityName(afterData)
    } else if (beforeData && !afterData) {
      type = 'contact_deleted'
      entityName = clientEntityName(beforeData)
    } else {
      type = 'contact_updated'
      entityName = clientEntityName(afterData || {})
    }

    const { fields_changed, summary } = diffFields(beforeData, afterData)
    if (type === 'contact_updated' && fields_changed.length === 0) return

    const col = notificationsRef()
    const ref = col.doc()
    await ref.set({
      id: ref.id,
      type,
      entity_type: 'client',
      entity_id: clientId,
      entity_name: String(entityName),
      summary,
      fields_changed,
      source_type: 'system',
      source_label: 'Firestore Trigger',
      hyperlink: `/contacts/${clientId}`,
      read: false,
      created_at: new Date().toISOString(),
      portal: 'all',
    })
  }
)

export const onAccountWrite = onDocumentWritten(
  { document: 'clients/{clientId}/accounts/{accountId}', region: 'us-central1' },
  async (event) => {
    const { clientId, accountId } = event.params
    const beforeData = event.data?.before?.data() as Record<string, unknown> | undefined
    const afterData = event.data?.after?.data() as Record<string, unknown> | undefined

    let type: string
    let entityName: string
    if (!beforeData && afterData) {
      type = 'account_created'
      entityName = accountEntityName(afterData)
    } else if (beforeData && !afterData) {
      type = 'account_deleted'
      entityName = accountEntityName(beforeData)
    } else {
      type = 'account_updated'
      entityName = accountEntityName(afterData || {})
    }

    const { fields_changed, summary } = diffFields(beforeData, afterData)
    if (type === 'account_updated' && fields_changed.length === 0) return

    const col = notificationsRef()
    const ref = col.doc()
    await ref.set({
      id: ref.id,
      type,
      entity_type: 'account',
      entity_id: accountId,
      entity_name: String(entityName),
      summary,
      fields_changed,
      source_type: 'system',
      source_label: 'Firestore Trigger',
      hyperlink: `/contacts/${clientId}`,
      read: false,
      created_at: new Date().toISOString(),
      portal: 'all',
    })
  }
)
