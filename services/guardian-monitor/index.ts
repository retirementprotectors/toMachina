// ============================================================================
// GUARDIAN Monitor — Scheduled Cloud Function
// Runs anomaly detection every 15 minutes and sends notifications on critical/high findings.
// Standalone Cloud Function (not part of Turborepo workspace).
// ============================================================================

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// ── Firebase Init ───────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp()
}

// ── Types ───────────────────────────────────────────────────────────────────

interface AnomalyCheckResult {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  collection: string
  description: string
  doc_count: number
  detected_at: string
}

// ── Collection Schemas (inlined from @tomachina/core) ───────────────────────

interface CollectionSchema {
  required: string[]
  neverNull?: string[]
  immutableAfterCreate?: string[]
  recommended?: string[]
}

const COLLECTION_SCHEMAS: Record<string, CollectionSchema> = {
  clients: {
    required: ['first_name', 'last_name', 'client_status'],
    neverNull: ['first_name', 'last_name'],
    immutableAfterCreate: ['client_id', 'created_at'],
    recommended: ['email', 'phone', 'dob', 'household_id'],
  },
  accounts: {
    required: ['client_id', 'carrier_name', 'status'],
    neverNull: ['client_id', 'carrier_name'],
    immutableAfterCreate: ['created_at'],
    recommended: ['charter', 'naic', 'carrier_id', 'policy_number'],
  },
  accounts_life: {
    required: ['client_id', 'carrier_name', 'status'],
    neverNull: ['client_id', 'carrier_name'],
    immutableAfterCreate: ['created_at'],
    recommended: ['charter', 'naic', 'carrier_id', 'policy_number'],
  },
  accounts_bdria: {
    required: ['client_id', 'carrier_name', 'status'],
    neverNull: ['client_id', 'carrier_name'],
    immutableAfterCreate: ['created_at'],
    recommended: ['charter', 'naic', 'carrier_id'],
  },
  carriers: {
    required: ['carrier_id', 'display_name', 'parent_brand'],
    neverNull: ['carrier_id', 'display_name'],
    immutableAfterCreate: ['carrier_id'],
    recommended: ['naic', 'underwriting_charters'],
  },
  products: {
    required: ['product_id', 'carrier_id', 'product_name'],
    neverNull: ['product_id', 'carrier_id'],
    immutableAfterCreate: ['product_id'],
  },
  users: {
    required: ['user_id', 'email', 'first_name', 'last_name'],
    neverNull: ['user_id', 'email'],
    immutableAfterCreate: ['user_id', 'created_at'],
  },
  households: {
    required: ['primary_contact_id', 'status'],
    neverNull: ['primary_contact_id'],
    recommended: ['members', 'address'],
  },
  revenue: {
    required: ['client_id', 'carrier_name', 'amount'],
    neverNull: ['client_id'],
    immutableAfterCreate: ['created_at'],
  },
  flow_pipelines: {
    required: ['name', 'pipeline_type', 'status'],
    neverNull: ['name'],
    immutableAfterCreate: ['created_at'],
  },
  flow_stages: {
    required: ['pipeline_id', 'name', 'order'],
    neverNull: ['pipeline_id', 'name'],
    immutableAfterCreate: ['created_at'],
  },
}

const PROTECTED_COLLECTIONS = Object.keys(COLLECTION_SCHEMAS)

// ── Anomaly Detection (inlined from guardian-anomaly.ts) ────────────────────

async function runAnomalyDetection(): Promise<AnomalyCheckResult[]> {
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

// Check 1: Mass Deletion (CRITICAL)
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

// Check 2: Field Nullification (HIGH)
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

  const collectionCounts: Record<string, number> = {}
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const col = (data.collection as string) || 'unknown'
    const schemaErrors = data.schema_errors as string[] | undefined
    const fieldsModified = data.fields_modified as string[] | undefined

    let flagged = false

    if (schemaErrors && schemaErrors.length > 0) {
      flagged = true
    }

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

// Check 3: Schema Drift (MEDIUM)
async function checkSchemaDrift(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const now = new Date().toISOString()
  const results: AnomalyCheckResult[] = []

  for (const collection of PROTECTED_COLLECTIONS) {
    const schema = COLLECTION_SCHEMAS[collection]
    if (!schema) continue

    const snapshot = await db.collection(collection).limit(50).get()
    if (snapshot.empty) continue

    const knownFields = new Set<string>([
      ...schema.required,
      ...(schema.neverNull || []),
      ...(schema.immutableAfterCreate || []),
      ...(schema.recommended || []),
      'id', 'created_at', 'updated_at',
    ])

    const unexpectedFieldCounts: Record<string, number> = {}
    for (const doc of snapshot.docs) {
      const data = doc.data()
      for (const field of Object.keys(data)) {
        if (!knownFields.has(field)) {
          unexpectedFieldCounts[field] = (unexpectedFieldCounts[field] || 0) + 1
        }
      }
    }

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

// Check 4: Orphan Creation (HIGH)
async function checkOrphanCreation(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const now = new Date().toISOString()
  const results: AnomalyCheckResult[] = []

  // Check accounts -> clients FK
  const accountsSnap = await db.collection('accounts').limit(100).get()
  if (!accountsSnap.empty) {
    const clientIds = new Set<string>()
    for (const doc of accountsSnap.docs) {
      const clientId = doc.data().client_id as string | undefined
      if (clientId) clientIds.add(clientId)
    }

    let orphanCount = 0
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

  // Check households -> clients FK
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

// Check 5: Duplicate Detection (MEDIUM)
async function checkDuplicateDetection(): Promise<AnomalyCheckResult[]> {
  const db = getFirestore()
  const now = new Date().toISOString()

  const snapshot = await db.collection('clients').limit(500).get()
  if (snapshot.empty) return []

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

// ── Write anomalies to Firestore ────────────────────────────────────────────

async function writeAnomalies(anomalies: AnomalyCheckResult[]): Promise<void> {
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

// ── Slack Notification ──────────────────────────────────────────────────────

async function sendSlackNotification(anomalies: AnomalyCheckResult[]): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[GUARDIAN] No SLACK_WEBHOOK_URL configured — skipping Slack notification')
    return
  }

  const criticalAndHigh = anomalies.filter(
    (a) => a.severity === 'critical' || a.severity === 'high'
  )

  if (criticalAndHigh.length === 0) return

  const blocks = criticalAndHigh.map((a) => {
    const emoji = a.severity === 'critical' ? ':rotating_light:' : ':warning:'
    return [
      `${emoji} *${a.severity.toUpperCase()}*: ${a.description}`,
      `Collection: \`${a.collection}\` (${a.doc_count} docs affected)`,
      `Detected: ${a.detected_at}`,
    ].join('\n')
  })

  const text = `:shield: *GUARDIAN Alert*\n\n${blocks.join('\n\n')}`

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      console.error(`[GUARDIAN] Slack webhook returned ${response.status}: ${await response.text()}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[GUARDIAN] Failed to send Slack notification: ${message}`)
  }
}

// ── Scheduled Cloud Function ────────────────────────────────────────────────

export const guardianMonitor = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'America/Chicago',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async () => {
    console.info('[GUARDIAN] Starting anomaly detection scan...')

    const anomalies = await runAnomalyDetection()

    console.info(`[GUARDIAN] Detection complete. Found ${anomalies.length} anomalie(s).`)

    if (anomalies.length > 0) {
      // Persist all anomalies
      await writeAnomalies(anomalies)
      console.info(`[GUARDIAN] Wrote ${anomalies.length} anomaly record(s) to Firestore.`)

      // Notify on critical/high only
      const criticalOrHigh = anomalies.filter(
        (a) => a.severity === 'critical' || a.severity === 'high'
      )

      if (criticalOrHigh.length > 0) {
        await sendSlackNotification(anomalies)
        console.info(`[GUARDIAN] Sent Slack notification for ${criticalOrHigh.length} critical/high finding(s).`)
      }

      // Log summary for each anomaly
      for (const anomaly of anomalies) {
        console.info(
          `[GUARDIAN] [${anomaly.severity.toUpperCase()}] ${anomaly.type} on ${anomaly.collection}: ${anomaly.description}`
        )
      }
    } else {
      console.info('[GUARDIAN] All clear — no anomalies detected.')
    }
  }
)
