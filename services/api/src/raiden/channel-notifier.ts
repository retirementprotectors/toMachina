// src/raiden/channel-notifier.ts — RAIDEN #dojo-fixes channel confirmation loop
// TRK-14240: Posts 4 event types to #dojo-fixes at key lifecycle events.
// Channel is the single source of truth — no follow-up DMs needed.

import type { DojoFixesEvent } from './types.js'

// #dojo-fixes channel — RAIDEN's public status feed
// Falls back to env var so channel can be reconfigured without code change
const DOJO_FIXES_CHANNEL = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
const JDM_SLACK_ID = 'U09BBHTN8F2'

// ---------------------------------------------------------------------------
// Slack post helper (mirrors shinobi-slack.ts pattern)
// ---------------------------------------------------------------------------

async function slackPost(
  channel: string,
  text: string,
  thread_ts?: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[raiden-channel] SLACK_BOT_TOKEN not set — skipping post')
    return { success: false, error: 'SLACK_BOT_TOKEN not set' }
  }
  try {
    const payload: Record<string, unknown> = { channel, text }
    if (thread_ts) payload.thread_ts = thread_ts
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as { ok: boolean; ts?: string; error?: string }
    if (!data.ok) {
      console.error('[raiden-channel] chat.postMessage failed:', data.error)
      return { success: false, error: data.error }
    }
    return { success: true, ts: data.ts }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[raiden-channel] chat.postMessage threw:', message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Event 1: NEW submission (<60 seconds)
// 🔴 NEW: [Title] — TRK-XXX submitted by @[name] | Type | Priority | RAIDEN is triaging...
// ---------------------------------------------------------------------------

export async function postNewSubmission(
  title: string,
  trkId: string,
  reporter: string,
  type: string,
  priority: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const reporterMention = reporter.startsWith('U')
    ? `<@${reporter}>`
    : reporter
  const text = `🔴 *NEW:* ${title} — ${trkId} submitted by ${reporterMention} | ${type || 'bug'} | ${priority || 'P2'} | RAIDEN is triaging...`

  console.log(`[raiden-channel] Posting NEW: ${trkId} "${title}"`)
  const result = await slackPost(DOJO_FIXES_CHANNEL, text)

  if (result.success) {
    logEvent({ type: 'new_submission', trk_id: trkId, title, reporter, posted_at: new Date().toISOString() })
  }
  return result
}

// ---------------------------------------------------------------------------
// Event 2: DUPLICATE detected (immediate — fires BEFORE creating a second ticket)
// ⚠️ Already reported: TRK-XXX "[existing title]" — Status: [Fixing/Done] — No need to resubmit
// ---------------------------------------------------------------------------

export async function postDuplicateDetected(
  existingTrkId: string,
  existingTitle: string,
  existingStatus: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const statusLabel = formatStatus(existingStatus)
  const text = `⚠️ *Already reported:* ${existingTrkId} "${existingTitle}" — Status: ${statusLabel} — No need to resubmit`

  console.log(`[raiden-channel] Posting DUPLICATE: ${existingTrkId}`)
  const result = await slackPost(DOJO_FIXES_CHANNEL, text)

  if (result.success) {
    logEvent({ type: 'duplicate_detected', trk_id: existingTrkId, title: existingTitle, status: existingStatus, posted_at: new Date().toISOString() })
  }
  return result
}

// ---------------------------------------------------------------------------
// Event 3: RAIDEN starts working on fix
// 🔧 IN PROGRESS: TRK-XXX "[title]" — RAIDEN is on it
// ---------------------------------------------------------------------------

export async function postInProgress(
  trkId: string,
  title: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const text = `🔧 *IN PROGRESS:* ${trkId} "${title}" — RAIDEN is on it`

  console.log(`[raiden-channel] Posting IN PROGRESS: ${trkId}`)
  const result = await slackPost(DOJO_FIXES_CHANNEL, text)

  if (result.success) {
    logEvent({ type: 'in_progress', trk_id: trkId, title, posted_at: new Date().toISOString() })
  }
  return result
}

// ---------------------------------------------------------------------------
// Event 4: Fix deployed
// ✅ FIXED: TRK-XXX "[title]" — deployed. Refresh to verify.
// ---------------------------------------------------------------------------

export async function postFixed(
  trkId: string,
  title: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const text = `✅ *FIXED:* ${trkId} "${title}" — deployed. Refresh to verify.`

  console.log(`[raiden-channel] Posting FIXED: ${trkId}`)
  const result = await slackPost(DOJO_FIXES_CHANNEL, text)

  if (result.success) {
    logEvent({ type: 'fixed', trk_id: trkId, title, posted_at: new Date().toISOString() })
  }
  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map internal status to human-readable label */
function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    queue: 'Queued',
    not_touched: 'New',
    in_sprint: 'In Sprint',
    planned: 'Planned',
    built: 'Built',
    audited: 'Audited',
    confirmed: 'Done',
    // RAIDEN-specific statuses (RDN- prefix)
    'RDN-new': 'New',
    'RDN-triaging': 'Triaging',
    'RDN-fixing': 'Fixing',
    'RDN-verifying': 'Verifying',
    'RDN-deploy': 'Deploy',
    'RDN-reported': 'Reported',
  }
  return labels[status] || status
}

/** Fire-and-forget event log (console only — Firestore logging in scheduler) */
function logEvent(event: DojoFixesEvent): void {
  console.log(`[raiden-channel] Event: ${JSON.stringify(event)}`)
}

// ---------------------------------------------------------------------------
// TRK-14239: In-thread reply — posts confirmation back to the original Slack message
// Called when a #dojo-fixes message creates a tracker item
// ---------------------------------------------------------------------------

export async function postThreadReply(
  originalTs: string,
  trkId: string,
  status: string,
): Promise<{ success: boolean; ts?: string; error?: string }> {
  const statusLabel = formatStatus(status)
  const text = `✅ Ticket created: *${trkId}* — Status: ${statusLabel}. RAIDEN is triaging...`

  console.log(`[raiden-channel] In-thread reply for ${trkId} (ts=${originalTs})`)
  const result = await slackPost(DOJO_FIXES_CHANNEL, text, originalTs)

  if (result.success) {
    logEvent({ type: 'thread_reply', trk_id: trkId, title: `Reply to ${originalTs}`, posted_at: new Date().toISOString() })
  }
  return result
}

// ---------------------------------------------------------------------------
// Exported constants for other modules
// ---------------------------------------------------------------------------

export { DOJO_FIXES_CHANNEL, JDM_SLACK_ID }
