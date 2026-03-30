const MDJ_URL = process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'
const CHANNEL_ID = process.env.DOJO_FIXES_CHANNEL_ID || 'C0ANMBVMSTV'
const JDM_USER_ID = 'U09BBHTN8F2'

async function postSlack(channel: string, text: string, threadTs?: string): Promise<void> {
  try {
    await fetch(`${MDJ_URL}/dojo/slack/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
      body: JSON.stringify({ channel, text, ...(threadTs ? { thread_ts: threadTs } : {}) })
    })
  } catch (err) {
    console.error('[RAIDEN] Slack post error:', err)
  }
}

export async function postNewSubmission(
  title: string, trkId: string, submitter: string, type: string, priority: string
): Promise<void> {
  await postSlack(CHANNEL_ID, `NEW: ${title} - ${trkId} submitted by <@${submitter}> | ${type} | ${priority}\nRAIDEN is triaging...`)
}

export async function postDuplicate(existingTrkId: string, existingTitle: string, existingStatus: string): Promise<void> {
  await postSlack(CHANNEL_ID, `Already reported: ${existingTrkId} "${existingTitle}" - Status: ${existingStatus}\nNo need to resubmit.`)
}

export async function postInProgress(trkId: string, title: string): Promise<void> {
  await postSlack(CHANNEL_ID, `IN PROGRESS: ${trkId} "${title}" - RAIDEN is on it`)
}

export async function postFixed(trkId: string, title: string): Promise<void> {
  await postSlack(CHANNEL_ID, `FIXED: ${trkId} "${title}" - deployed. Refresh to verify.`)
}

export async function postFixApplied(title: string, rootCause: string, fixDesc: string, pr: number, branch: string): Promise<void> {
  await postSlack(CHANNEL_ID, `RAIDEN\n\nFixed: ${title}\n\nRoot cause: ${rootCause}\nFix: ${fixDesc}\n\nPR #${pr} -> ${branch}\nCI running.\n\n- @RAIDEN`)
}

export async function sendP0Alert(title: string, details: string, action: string, trkId?: string): Promise<void> {
  await postSlack(JDM_USER_ID, `RAIDEN P0 ALERT - ${title}\n\n${details}\n\nRecommended: ${action}${trkId ? `\n\nTagged as ${trkId} in FORGE.` : ''}\n\n- @RAIDEN`)
}

export async function postOvernightSummary(fixes: number, routes: number, p0s: number, trains: number, queued: number, prNumbers: number[], trkIds: string[]): Promise<void> {
  if (fixes + routes + p0s + trains + queued === 0) return
  const prList = prNumbers.length ? ` -> PRs ${prNumbers.map(n=>`#${n}`).join(', ')}` : ''
  const trkList = trkIds.length ? ` -> ${trkIds.join(', ')}` : ''
  await postSlack(CHANNEL_ID, `RAIDEN Overnight summary (12am-7am)\n\n${fixes} quick fixes shipped${prList}\n${routes} routed to RONIN${trkList}\n${p0s} P0 flagged\n${trains} training, ${queued} queued\n\nGood morning.\n\n- @RAIDEN`)
}
