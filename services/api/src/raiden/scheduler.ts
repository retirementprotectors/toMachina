import { pollSlackChannel } from './slack-poller.js'
import { pollForgeBoard } from './forge-poller.js'
import { triageItem, detectDuplicate } from './triage-engine.js'
import { executeAutoFix } from './auto-fixer.js'
import { routeToRonin } from './ronin-router.js'
import { sendTrainingResponse } from './trainer.js'
import {
  postFixApplied, sendP0Alert,
  postNewSubmission, postDuplicate, postInProgress, postFixed,
} from './notifier.js'
import { logRaidenRun } from './logger.js'
import { setLastRun } from './index.js'
import { postIntakeReceived, postIntakeClassified } from './channel-notifier.js'
import { getFirestore } from 'firebase-admin/firestore'
import type { SlackItem, ForgeItem, FixRecord, RouteRecord, TriageResult } from './types.js'

const REC_TO_WARRIOR: Record<string, string> = {
  FIX: 'RAIDEN', FEATURE: 'RONIN', FILE: 'VOLTRON', TRAIN: 'VOLTRON',
}

const POLL_INTERVAL = 15 * 60 * 1000

export function startRaidenScheduler(): void {
  console.log('[RAIDEN] Scheduler active — 15-min cycle')
  setTimeout(() => { runCycle(); setInterval(runCycle, POLL_INTERVAL) }, 10_000)
}

export async function runCycle(): Promise<void> {
  const startedAt = new Date()
  const fixes: FixRecord[] = [], routes: RouteRecord[] = []
  let jdmNotified = false, channelPosted = false
  const outcomes = { train: 0, fix: 0, route: 0, queue: 0 }

  try {
    const [slackItems, forgeItems] = await Promise.all([pollSlackChannel(), pollForgeBoard()])
    const allItems: (SlackItem | ForgeItem)[] = [...slackItems, ...forgeItems]

    for (const item of allItems) {
      try {
        const title = 'title' in item ? item.title : (item as SlackItem).text.slice(0, 80)
        const trkId = 'trk_id' in item ? item.trk_id : `SLACK-${(item as SlackItem).message_ts}`
        const submitter = 'user' in item ? (item as SlackItem).user : 'system'
        const itemType = 'type' in item ? (item as ForgeItem).type : 'slack'
        const itemPriority = 'priority' in item ? (item as ForgeItem).priority : 'P2'

        const dup = await detectDuplicate(
          'text' in item ? item.text : `${(item as ForgeItem).title} ${(item as ForgeItem).description}`
        )
        if (dup) {
          await postDuplicate(dup.trk_id, dup.title, dup.status)
          channelPosted = true
          continue
        }

        await postNewSubmission(title, trkId, submitter, itemType, itemPriority)
        channelPosted = true

        // INTAKE Phase 1: Immediate ack in thread
        const threadTs = 'thread_ts' in item ? (item as SlackItem).thread_ts : undefined
        await postIntakeReceived(threadTs).catch(() => {})

        const result = await triageItem(item)
        if (result.p0) {
          await sendP0Alert(title, result.reasoning, 'Review immediately')
          jdmNotified = true
        }
        switch (result.outcome) {
          case 'TRAIN': outcomes.train++
            if ('user' in item) await sendTrainingResponse(item as SlackItem, [])
            break
          case 'FIX': {
            outcomes.fix++
            await postInProgress(trkId, title)
            const fr = await executeAutoFix(item, result.reasoning)
            if (fr) {
              fixes.push(fr)
              await postFixApplied(fr.issue, result.reasoning, 'Minimal fix', fr.pr, fr.branch)
              await postFixed(trkId, title)
            } else {
              await sendP0Alert('Auto-fix failed: ' + title, 'Auto-fix returned null', 'Manual fix required')
              jdmNotified = true
            }
            break
          }
          case 'ROUTE': {
            outcomes.route++
            await postInProgress(trkId, title)
            const rr = await routeToRonin(item, result.reasoning)
            if (rr) routes.push(rr)
            jdmNotified = true
            break
          }
          case 'QUEUE': {
            outcomes.queue++
            // Update tracker item to INT-classified with triage recommendation
            await updateTrackerIntakeStatus(item, result)
            // INTAKE Phase 2: Post classification in thread
            const recLabel = result.p0 ? 'FIX' : 'FIX'
            const warrior = REC_TO_WARRIOR[recLabel] || 'RAIDEN'
            const itemTrkId = 'tracker_item_id' in item ? (item as SlackItem).tracker_item_id || trkId : trkId
            await postIntakeClassified(itemTrkId, recLabel, itemPriority, warrior, threadTs).catch(() => {})
            break
          }
        }
      } catch (e) { console.error('[RAIDEN] Item error:', e) }
    }

    await logRaidenRun({ started_at: startedAt, items_checked: allItems.length,
      triage_outcomes: outcomes, fixes_applied: fixes, routes_created: routes,
      jdm_notified: jdmNotified, channel_posted: channelPosted })
    setLastRun(new Date().toISOString())
  } catch (err) { console.error('[RAIDEN] Cycle error:', err) }
}

/**
 * Update a tracker item from INT-new → INT-classified with triage recommendation.
 * Maps triage outcome to a recommendation the CEO can approve/reclassify in /q.
 */
async function updateTrackerIntakeStatus(
  item: SlackItem | ForgeItem,
  triageResult: TriageResult,
): Promise<void> {
  // Get tracker doc ID — SlackItem carries it from slack-poller, ForgeItem uses trk_id
  let docId: string | undefined
  if ('tracker_doc_id' in item) {
    docId = (item as SlackItem).tracker_doc_id
  }
  if (!docId && 'trk_id' in item) {
    // ForgeItem — look up by item_id
    try {
      const db = getFirestore()
      const snap = await db.collection('tracker_items')
        .where('item_id', '==', (item as ForgeItem).trk_id)
        .limit(1)
        .get()
      if (!snap.empty) docId = snap.docs[0].id
    } catch { /* silent */ }
  }
  if (!docId) {
    console.warn('[RAIDEN] Cannot update intake status — no tracker doc ID')
    return
  }

  // Map triage outcome to recommendation
  const recMap: Record<string, string> = {
    FIX: 'FIX', ROUTE: 'FEATURE', TRAIN: 'TRAIN', QUEUE: 'FIX',
  }

  try {
    const db = getFirestore()
    await db.collection('tracker_items').doc(docId).update({
      status: 'INT-classified',
      triage_recommendation: recMap[triageResult.outcome] || 'FIX',
      triage_reasoning: triageResult.reasoning,
      triage_p0: triageResult.p0,
      updated_at: new Date().toISOString(),
      _updated_by: 'raiden-scheduler',
    })
    console.log(`[RAIDEN] ${docId} → INT-classified (rec: ${recMap[triageResult.outcome]})`)
  } catch (err) {
    console.error('[RAIDEN] Failed to update intake status:', err)
  }
}
