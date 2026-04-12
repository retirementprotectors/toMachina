/**
 * logEvent() — Shared helper for warrior event logging.
 * ZRD-SYN-020b | Warrior Event Log Foundation
 *
 * Append-only write to Firestore warrior_events collection.
 * Used by:
 *   - Auto-log hooks (directives, PR merges, Slack posts)
 *   - Warriors directly (task_started, milestone, delegation, decision)
 *   - Wire-warrior-briefing (reads back for session recovery)
 *
 * Usage (CLI):
 *   echo '{"warrior":"RONIN","type":"task_started","summary":"Starting sprint"}' | \
 *     node dist/log-event.js
 *
 * Usage (programmatic):
 *   import { logEvent } from './log-event.js'
 *   await logEvent({ warrior: 'RONIN', type: 'milestone', summary: 'Phase 1 complete' })
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import type { WarriorName, WarriorEventType, WarriorEventDetails } from './types/warrior-event.js'
import { WARRIOR_EVENTS_COLLECTION } from './types/warrior-event.js'

const execAsync = promisify(exec)

// ── Firebase Init ───────────────────────────────────────────────────────────

const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || process.env.SA_KEY_PATH
  || ''

if (getApps().length === 0) {
  if (SA_PATH && fs.existsSync(SA_PATH)) {
    const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf-8'))
    initializeApp({ credential: cert(sa) })
  } else {
    initializeApp()
  }
}

const db = getFirestore()

// ── Session Detection ───────────────────────────────────────────────────────

function getSessionId(): string {
  if (process.env.CLAUDE_SESSION_ID) return process.env.CLAUDE_SESSION_ID
  return `unknown-${Date.now()}`
}

async function detectWarrior(): Promise<WarriorName | null> {
  try {
    const { stdout } = await execAsync('tmux display-message -p "#S"', { timeout: 3000 })
    const session = stdout.trim().toUpperCase()
    const warriors: WarriorName[] = ['SHINOB1', 'MEGAZORD', 'MUSASHI', 'VOLTRON', 'RAIDEN', 'RONIN']
    return warriors.find(w => session.startsWith(w)) ?? null
  } catch {
    return null
  }
}

// ── Core logEvent Function ──────────────────────────────────────────────────

export interface LogEventInput {
  warrior?: WarriorName
  type: WarriorEventType
  summary: string
  channel?: string
  details?: WarriorEventDetails
  sessionId?: string
}

/**
 * Log an event to the warrior_events Firestore collection.
 * Returns the document ID on success, null on failure.
 * Never throws — failures are logged to stderr silently.
 */
export async function logEvent(input: LogEventInput): Promise<string | null> {
  try {
    const warrior = input.warrior ?? await detectWarrior()
    if (!warrior) {
      process.stderr.write('[log-event] Could not determine warrior name. Skipping.\n')
      return null
    }

    const sessionId = input.sessionId ?? getSessionId()

    const eventDoc = {
      warrior,
      sessionId,
      timestamp: Timestamp.now(),
      type: input.type,
      summary: input.summary,
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.details ? { details: input.details } : {}),
    }

    const ref = await db.collection(WARRIOR_EVENTS_COLLECTION).add(eventDoc)
    return ref.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[log-event] Failed to write event: ${message}\n`)
    return null
  }
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let input: LogEventInput | null = null

  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer)
    }
    const stdinData = Buffer.concat(chunks).toString('utf-8').trim()
    if (stdinData) {
      try {
        input = JSON.parse(stdinData) as LogEventInput
      } catch {
        process.stderr.write('[log-event] Invalid JSON on stdin\n')
        process.exit(1)
      }
    }
  }

  if (!input && process.argv.length >= 4) {
    input = {
      type: process.argv[2] as WarriorEventType,
      summary: process.argv[3],
      warrior: process.argv[4] as WarriorName | undefined,
    }
  }

  if (!input) {
    process.stderr.write('[log-event] Usage: echo \'{"type":"...","summary":"..."}\' | node log-event.js\n')
    process.stderr.write('       or: node log-event.js <type> <summary> [warrior]\n')
    process.exit(1)
  }

  const docId = await logEvent(input)
  if (docId) {
    process.stdout.write(`[log-event] Written: ${docId}\n`)
  } else {
    process.stderr.write('[log-event] Failed to write event\n')
    process.exit(1)
  }
}

const isMain = process.argv[1]?.endsWith('log-event.js') || process.argv[1]?.endsWith('log-event.ts')
if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      process.stderr.write(`[log-event] Fatal: ${String(err)}\n`)
      process.exit(1)
    })
}
