// ============================================================================
// GUARDIAN — Anomaly Detection Engine
// Runs 5 checks against Firestore data to detect data integrity anomalies.
// Used by: services/api (direct import), services/guardian-monitor (Cloud Fn)
// ============================================================================

import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import {
  COLLECTION_SCHEMAS,
  PROTECTED_COLLECTIONS,
} from '@tomachina/core/validation/collection-schemas'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AnomalyCheckResult {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  collection: string
  description: string
  doc_count: number
  detected_at: string
}

// ── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run all 5 anomaly detection checks and return any findings.
 * Each check is independent — one failing won't prevent others from running.
 */
export async function runAnomalyDetection(): Promise<AnomalyCheckResult[]> {
  const results: AnomalyCheckResult[] = []

  const checks = [
    checkMassDeletion,
    checkFieldNullification,
    checkSchemaDrift,
    checkOrphanCreation,
    checkDuplicateDetection,
  ]

  for (const check of checks) {
    try {
      const findings = await check()
      results.push(...findings)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[GUARDIAN] Check ${check.name} failed: ${message}`)
    }
  }

  return results
}

// ── Check 1: Mass Deletion (CRITICAL) ───────────────────────────────────────

/**
 * Query guardian_writes for delete operations in the last 15 minutes.
 * If >5 deletes from any single collection, flag as critical.
 */
async function checkMassDeletion(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const snapshot = await db
    .collection('guardian_writes')
    .where('operation', '==', 'delete')
    .where('timestamp', '>=', fifteenMinAgo)
    .limit(500)
    .get()

  if (snapshot.empty) return []

  // Group by collection
  const collectionCounts: Record<string, number> = {}
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const col = (data.collection as string) || 'unknown'
    collectionCounts[col] = (collectionCounts[col] || 0) + 1
  }

  const results: AnomalyCheckResult[] = []
  for (const [collection, count] of Object.entries(collectionCounts)) {
    if (count > 5) {
      results.push({
        type: 'mass_deletion',
        severity: 'critical',
        collection,
        description: `${count} delete operations detected on ${collection} in the last 15 minutes`,
        doc_count: count,
        detected_at: now,
      })
    }
  }

  return results
}

// ── Check 2: Field Nullification (HIGH) ─────────────────────────────────────

/**
 * Query guardian_writes for update operations in the last 15 minutes
 * where schema_errors is non-empty or neverNull fields were touched.
 * If >10 such writes, flag as high severity.
 */
async function checkFieldNullification(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const snapshot = await db
    .collection('guardian_writes')
    .where('operation', '==', 'update')
    .where('timestamp', '>=', fifteenMinAgo)
    .limit(500)
    .get()

  if (snapshot.empty) return []

  // Group by collection — count writes that have schema_errors or touch neverNull fields
  const collectionCounts: Record<string, number> = {}

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const col = (data.collection as string) || 'unknown'
    const schemaErrors = data.schema_errors as string[] | undefined
    const fieldsModified = data.fields_modified as string[] | undefined

    let flagged = false

    // Check if schema_errors is non-empty
    if (schemaErrors && schemaErrors.length > 0) {
      flagged = true
    }

    // Check if any neverNull fields were modified
    if (!flagged && fieldsModified && col in COLLECTION_SCHEMAS) {
      const schema = COLLECTION_SCHEMAS[col]
      if (schema?.neverNull) {
        const touchedNeverNull = fieldsModified.some((f) => schema.neverNull?.includes(f))
        if (touchedNeverNull) {
          flagged = true
        }
      }
    }

    if (flagged) {
      collectionCounts[col] = (collectionCounts[col] || 0) + 1
    }
  }

  const results: AnomalyCheckResult[] = []
  for (const [collection, count] of Object.entries(collectionCounts)) {
    if (count > 10) {
      results.push({
        type: 'field_nullification',
        severity: 'high',
        collection,
        description: `${count} suspicious field modifications (schema errors or neverNull fields touched) on ${collection} in the last 15 minutes`,
        doc_count: count,
        detected_at: now,
      })
    }
  }

  return results
}

// ── Check 3: Schema Drift (MEDIUM) ─────────────────────────────────────────

/**
 * For each protected collection, sample 50 docs and extract all field names.
 * Compare against COLLECTION_SCHEMAS.required + recommended.
 * If >3 unexpected fields appear on >20 docs, flag as medium severity.
 */
async function checkSchemaDrift(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const now = new Date().toISOString()
  const results: AnomalyCheckResult[] = []

  for (const collection of PROTECTED_COLLECTIONS) {
    const schema = COLLECTION_SCHEMAS[collection]
    if (!schema) continue

    const snapshot = await db.collection(collection).limit(50).get()
    if (snapshot.empty) continue

    // Build set of known fields from schema
    const knownFields = new Set<string>([
      ...schema.required,
      ...(schema.neverNull || []),
      ...(schema.immutableAfterCreate || []),
      ...(schema.recommended || []),
      // Common metadata fields that are always expected
      'id',
      'created_at',
      'updated_at',
    ])

    // Count how many docs have each unexpected field
    const unexpectedFieldCounts: Record<string, number> = {}
    for (const doc of snapshot.docs) {
      const data = doc.data()
      for (const field of Object.keys(data)) {
        if (!knownFields.has(field)) {
          unexpectedFieldCounts[field] = (unexpectedFieldCounts[field] || 0) + 1
        }
      }
    }

    // Count unexpected fields that appear on >20 docs
    const driftFields = Object.entries(unexpectedFieldCounts).filter(
      ([, count]) => count > 20
    )

    if (driftFields.length > 3) {
      results.push({
        type: 'schema_drift',
        severity: 'medium',
        collection,
        description: `${driftFields.length} unexpected fields found across ${collection} (e.g., ${driftFields.slice(0, 3).map(([f]) => f).join(', ')}). Each appears on 20+ of 50 sampled docs.`,
        doc_count: snapshot.size,
        detected_at: now,
      })
    }
  }

  return results
}

// ── Check 4: Orphan Creation (HIGH) ────────────────────────────────────────

/**
 * For accounts (sample 100), verify client_id references exist in clients collection.
 * For households, verify member client IDs exist.
 * Report any broken foreign key references.
 */
async function checkOrphanCreation(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const now = new Date().toISOString()
  const results: AnomalyCheckResult[] = []

  // --- Check accounts -> clients FK ---
  const accountsSnap = await db.collection('accounts').limit(100).get()
  if (!accountsSnap.empty) {
    const clientIds = new Set<string>()
    for (const doc of accountsSnap.docs) {
      const clientId = doc.data().client_id as string | undefined
      if (clientId) clientIds.add(clientId)
    }

    let orphanCount = 0
    // Batch check existence (Firestore getAll supports up to 100 refs)
    const clientRefs = [...clientIds].map((id) => db.collection('clients').doc(id))
    if (clientRefs.length > 0) {
      const clientDocs = await db.getAll(...clientRefs)
      const existingIds = new Set(clientDocs.filter((d) => d.exists).map((d) => d.id))

      for (const doc of accountsSnap.docs) {
        const clientId = doc.data().client_id as string | undefined
        if (clientId && !existingIds.has(clientId)) {
          orphanCount++
        }
      }
    }

    if (orphanCount > 0) {
      results.push({
        type: 'orphan_creation',
        severity: 'high',
        collection: 'accounts',
        description: `${orphanCount} account(s) reference non-existent client_id values in clients collection`,
        doc_count: orphanCount,
        detected_at: now,
      })
    }
  }

  // --- Check households -> clients FK ---
  const householdsSnap = await db.collection('households').limit(100).get()
  if (!householdsSnap.empty) {
    const memberClientIds = new Set<string>()
    for (const doc of householdsSnap.docs) {
      const members = doc.data().members as Array<{ client_id?: string }> | undefined
      if (Array.isArray(members)) {
        for (const member of members) {
          if (member.client_id) memberClientIds.add(member.client_id)
        }
      }
      // Also check primary_contact_id
      const primaryId = doc.data().primary_contact_id as string | undefined
      if (primaryId) memberClientIds.add(primaryId)
    }

    if (memberClientIds.size > 0) {
      const memberRefs = [...memberClientIds].slice(0, 100).map((id) =>
        db.collection('clients').doc(id)
      )
      const memberDocs = await db.getAll(...memberRefs)
      const existingIds = new Set(memberDocs.filter((d) => d.exists).map((d) => d.id))
      const brokenCount = [...memberClientIds].filter((id) => !existingIds.has(id)).length

      if (brokenCount > 0) {
        results.push({
          type: 'orphan_creation',
          severity: 'high',
          collection: 'households',
          description: `${brokenCount} household member/primary_contact reference(s) point to non-existent clients`,
          doc_count: brokenCount,
          detected_at: now,
        })
      }
    }
  }

  return results
}

// ── Check 5: Duplicate Detection (MEDIUM) ──────────────────────────────────

/**
 * For clients collection, query for identical first_name + last_name combinations.
 * Flag if the same name appears >2 times.
 */
async function checkDuplicateDetection(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const now = new Date().toISOString()

  const snapshot = await db.collection('clients').limit(500).get()
  if (snapshot.empty) return []

  // Build name frequency map
  const nameMap: Record<string, number> = {}
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const firstName = ((data.first_name as string) || '').trim().toLowerCase()
    const lastName = ((data.last_name as string) || '').trim().toLowerCase()
    if (firstName && lastName) {
      const key = `${firstName}|${lastName}`
      nameMap[key] = (nameMap[key] || 0) + 1
    }
  }

  // Find names that appear >2 times
  const duplicates = Object.entries(nameMap).filter(([, count]) => count > 2)

  if (duplicates.length > 0) {
    const totalDuplicateDocs = duplicates.reduce((sum, [, count]) => sum + count, 0)
    const examples = duplicates
      .slice(0, 3)
      .map(([name, count]) => `${name.replace('|', ' ')} (${count}x)`)
      .join(', ')

    return [
      {
        type: 'duplicate_creation',
        severity: 'medium',
        collection: 'clients',
        description: `${duplicates.length} name(s) appear >2 times in clients (${totalDuplicateDocs} docs total). Examples: ${examples}`,
        doc_count: totalDuplicateDocs,
        detected_at: now,
      },
    ]
  }

  return []
}

// ── Persistence ─────────────────────────────────────────────────────────────

/**
 * Write detected anomalies to the anomaly_alerts Firestore collection.
 */
export async function writeAnomalies(anomalies: AnomalyCheckResult[]): Promise<void> {
  if (anomalies.length === 0) return

  const db = getFirestore()
  const batch = db.batch()

  for (const anomaly of anomalies) {
    const ref = db.collection('anomaly_alerts').doc()
    batch.set(ref, {
      ...anomaly,
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
      created_at: Timestamp.now(),
    })
  }

  await batch.commit()
}
