/**
 * wire-run-tracker.ts — LL-07 (System Synergy Dashboard prize)
 *
 * Shared helper used by all Learning Loop wires to record their execution
 * state in Firestore. Gives the System Synergy dashboard tile a single source
 * of truth for "last successful run" + "current status" + "entries written"
 * without having to parse journalctl from a different machine.
 *
 * Why this exists:
 *   Before LL-07, wire failures were invisible for 48+ hours (ZRD-LL original
 *   incident). MEGAZORD's LL-08 shipped push alerts via systemd OnFailure.
 *   LL-07 is the other half — VISIBLE state, queryable cross-tier so the
 *   deployed Cloud Run API + MUSASHI's Phase 3 UI can read the same source.
 *
 * Schema-first: all writes go through the explicit WireRunDoc and
 * WireRunUpdate interfaces below — no phantom fields, no inventing.
 *
 * Usage (wrap a wire's main()):
 *   import { trackRun } from './wire-run-tracker.js'
 *
 *   trackRun('entity-extractor', async () => {
 *     const count = await doTheActualWork()
 *     return { entriesWritten: count }
 *   }).catch(() => process.exit(1))
 *
 * Or manually with startRun/endRun for finer control.
 *
 * Firestore collection: wire_runs
 *
 * Required composite indexes (declared in firestore.indexes.json):
 *   - wire_runs (wireName ASC, startedAt DESC)   — tile queries for latest per wire
 *   - wire_runs (status ASC, startedAt DESC)     — alert queries for recent failures
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import type { UpdateData } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as os from 'os'

const COLLECTION_NAME = 'wire_runs'

/**
 * Ensure Firebase is initialized before any Firestore call.
 * If the consuming wire already called initializeApp() at module level,
 * this is a no-op. If not (e.g., wire-brain-sync, wire-platform-audit),
 * we self-initialize with the SA key from GOOGLE_APPLICATION_CREDENTIALS.
 */
function ensureFirebaseInit(): void {
  if (getApps().length > 0) return
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || '/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json'
  try {
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'))
    initializeApp({ credential: cert(sa) })
  } catch (err) {
    console.error('[wire-run-tracker] Firebase self-init failed:', err instanceof Error ? err.message : err)
  }
}

/** Build a deterministic Firestore document path for a given runId. */
function docPath(runId: string): string {
  return `${COLLECTION_NAME}/${runId}`
}

// ── Schema (single source of truth for the wire_runs documents) ─────────

export type WireRunStatus = 'running' | 'success' | 'failure'

/**
 * Full document shape as written at run start.
 * Every field must exist here — phantom fields are forbidden.
 */
export interface WireRunDoc {
  wireName: string
  startedAt: Timestamp
  completedAt: Timestamp | null
  status: WireRunStatus
  exitCode: number | null
  entriesWritten: number | null
  error: string | null
  durationMs: number | null
  host: string
  metadata: Record<string, unknown>
  createdAt: FieldValue
}

/**
 * Partial document shape used on run end — only fields that change.
 */
export interface WireRunUpdate {
  completedAt: Timestamp
  status: WireRunStatus
  exitCode: number
  entriesWritten: number | null
  error: string | null
  durationMs: number | null
  metadata?: Record<string, unknown>
}

// ── Public API ──────────────────────────────────────────────────────────

export interface StartRunOptions {
  wireName: string
  /**
   * Optional metadata captured at start time — e.g., trigger source
   * ('systemd-timer' | 'manual' | 'hook'), schedule label, etc.
   */
  metadata?: Record<string, unknown>
}

export interface EndRunResult {
  status: 'success' | 'failure'
  exitCode?: number
  entriesWritten?: number
  error?: string
  /**
   * Optional trailing metadata — merged into the run record on completion.
   * Useful for wire-specific signals (file sizes, warriors processed, etc.).
   */
  metadata?: Record<string, unknown>
}

/**
 * Record the start of a wire run. Returns a runId used by `endRun`.
 *
 * The runId format is `${wireName}_${unixMs}` — deterministic, sortable,
 * readable, and avoids dependency on Firestore auto-IDs.
 */
export async function startRun(wireNameOrOpts: string | StartRunOptions): Promise<string> {
  ensureFirebaseInit()
  const opts: StartRunOptions =
    typeof wireNameOrOpts === 'string' ? { wireName: wireNameOrOpts } : wireNameOrOpts
  const wireName = opts.wireName
  if (!wireName) throw new Error('[wire-run-tracker] wireName is required')

  const now = Timestamp.now()
  const runId = `${wireName}_${now.toMillis()}`

  const startDoc: WireRunDoc = {
    wireName,
    startedAt: now,
    completedAt: null,
    status: 'running',
    exitCode: null,
    entriesWritten: null,
    error: null,
    durationMs: null,
    host: os.hostname(),
    metadata: opts.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  }

  const db = getFirestore()
  const ref = db.doc(docPath(runId))
  await ref.set(startDoc)

  return runId
}

/**
 * Record the end of a wire run. Updates the existing document.
 *
 * NEVER throws on Firestore failure — the wire's own exit code is the
 * authoritative signal. If the tracker itself crashes, we log to stderr
 * but let the wire's main flow complete.
 */
export async function endRun(runId: string, result: EndRunResult): Promise<void> {
  if (!runId) {
    console.error('[wire-run-tracker] endRun called with empty runId — skipping')
    return
  }

  try {
    const startedMs = parseInt(runId.split('_').pop() || '0', 10)
    const durationMs = startedMs > 0 ? Date.now() - startedMs : null

    const endUpdate: WireRunUpdate = {
      completedAt: Timestamp.now(),
      status: result.status,
      exitCode: result.exitCode ?? (result.status === 'success' ? 0 : 1),
      entriesWritten: result.entriesWritten ?? null,
      error: result.error ?? null,
      durationMs,
    }
    if (result.metadata) {
      endUpdate.metadata = result.metadata
    }

    const db = getFirestore()
    const ref = db.doc(docPath(runId))
    // Cast via unknown: Firestore's UpdateData<T> uses an index signature to
    // support dot-notation paths; our concrete WireRunUpdate interface doesn't
    // overlap directly. The runtime shape is correct — this is a type-only coerce.
    await ref.update(endUpdate as unknown as UpdateData<WireRunDoc>)
  } catch (err) {
    // Never propagate tracker failures up to the wire — log and continue
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[wire-run-tracker] Failed to record endRun for ${runId}: ${msg}`)
  }
}

/**
 * Convenience wrapper — run a wire's main function with automatic
 * start/end tracking. Catches exceptions, records failure state, re-throws
 * so the wire exits non-zero and systemd OnFailure fires Slack alert.
 *
 * Usage:
 *   trackRun('entity-extractor', async () => {
 *     const count = await doWork()
 *     return { entriesWritten: count }
 *   }).catch(() => process.exit(1))
 */
export async function trackRun<T extends { entriesWritten?: number } | void>(
  wireName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const runId = await startRun(wireName)
  try {
    const result = await fn()
    const entriesWritten =
      result && typeof result === 'object' && 'entriesWritten' in result
        ? result.entriesWritten
        : undefined
    await endRun(runId, { status: 'success', entriesWritten })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await endRun(runId, { status: 'failure', error: message })
    throw err
  }
}
