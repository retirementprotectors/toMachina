/**
 * TRK-535: Poll Helper — wait for intake queue status transitions.
 * Polls Firestore intake_queue doc until terminal status or timeout.
 */

import { getFirestore } from 'firebase-admin/firestore'

const TERMINAL_STATUSES = new Set(['COMPLETE', 'ERROR', 'AWAITING_APPROVAL', 'REJECTED'])

export class TimeoutError extends Error {
  constructor(queueId: string, lastStatus: string, timeout: number) {
    super(
      `Timed out waiting for queue entry ${queueId} after ${timeout}ms. ` +
      `Last status: ${lastStatus}`
    )
    this.name = 'TimeoutError'
  }
}

interface PollOptions {
  interval?: number
  timeout?: number
}

interface QueueDoc {
  status: string
  wire_result?: {
    success: boolean
    execution_id: string
    stages: number
    created_records: number
    execution_time_ms: number
    status: string
  }
  [key: string]: unknown
}

/**
 * Poll an intake_queue document until it reaches a terminal status.
 * Returns the final document data.
 */
export async function pollQueueStatus(
  queueId: string,
  options?: PollOptions
): Promise<QueueDoc> {
  const interval = options?.interval ?? 2000
  const timeout = options?.timeout ?? 60_000
  const startTime = Date.now()
  const db = getFirestore()
  let lastStatus = 'unknown'

  while (Date.now() - startTime < timeout) {
    const doc = await db.collection('intake_queue').doc(queueId).get()

    if (!doc.exists) {
      // Doc may not have been created yet — wait
      await sleep(interval)
      continue
    }

    const data = doc.data() as QueueDoc
    lastStatus = data.status

    if (TERMINAL_STATUSES.has(data.status)) {
      return data
    }

    await sleep(interval)
  }

  throw new TimeoutError(queueId, lastStatus, timeout)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
