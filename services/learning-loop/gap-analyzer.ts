/**
 * VOLTRON Conversation Gap Analysis — TRK-14177
 *
 * Analyzes VOLTRON conversations for low-confidence responses
 * and clusters unanswered questions into gap entries.
 *
 * Runs daily via systemd on MDJ_SERVER.
 * Writes results to Firestore knowledge_entries with tag 'voltron-gap'.
 * Sends Slack DM digest to JDM.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import Anthropic from '@anthropic-ai/sdk'
import type { KnowledgeEntry } from './types/knowledge-entry.js'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const SLACK_TOKEN = process.env.SLACK_TOKEN
const JDM_DM_ID = 'U09BBHTN8F2'

interface GapCluster {
  topic: string
  question_count: number
  sample_questions: string[]
  detected_topics: string[]
}

/**
 * Query recent VOLTRON conversations with low confidence.
 */
async function getLowConfidenceConversations(days: number = 7): Promise<Array<{ question: string; response: string }>> {
  const db = getFirestore()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const snapshot = await db
    .collection('mdj_conversations')
    .where('created_at', '>=', Timestamp.fromDate(cutoff))
    .orderBy('created_at', 'desc')
    .limit(200)
    .get()

  const lowConfidence: Array<{ question: string; response: string }> = []

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const response = String(data.response || '')
    const question = String(data.question || data.user_message || '')

    if (!question || !response) continue

    const isLowConfidence =
      response.length < 50 ||
      /\b(not sure|don't have|unable to)\b/i.test(response) ||
      /\b(error|failed)\b/i.test(response)

    if (isLowConfidence) {
      lowConfidence.push({ question: question.slice(0, 500), response: response.slice(0, 200) })
    }
  }

  return lowConfidence
}

/**
 * Use Claude Haiku to cluster questions into gap themes.
 */
async function clusterGaps(conversations: Array<{ question: string; response: string }>): Promise<GapCluster[]> {
  if (conversations.length === 0) return []

  const anthropic = new Anthropic()
  const questionsText = conversations
    .map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.response}`)
    .join('\n\n')

  const result = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze these VOLTRON conversations where the response was weak.
Cluster them into knowledge gap themes. Return JSON array:

[{"topic": "short label", "question_count": N, "sample_questions": ["q1", "q2"], "detected_topics": ["tag1", "tag2"]}]

Only include clusters with 2+ similar questions. Max 5 clusters.

Conversations:
${questionsText}`,
      },
    ],
  })

  try {
    const text = result.content[0].type === 'text' ? result.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as GapCluster[]
  } catch {
    console.error('[gap-analyzer] Failed to parse Haiku response')
    return []
  }
}

/**
 * Write gap clusters as knowledge_entries.
 */
async function writeGapEntries(clusters: GapCluster[]): Promise<number> {
  if (clusters.length === 0) return 0

  const db = getFirestore()
  const writeBatch = db.batch()

  for (const cluster of clusters) {
    const ref = db.collection('knowledge_entries').doc()
    const entry: Partial<KnowledgeEntry> & { id: string } = {
      id: ref.id,
      type: 'insight',
      content: `VOLTRON knowledge gap: ${cluster.topic} (${cluster.question_count} occurrences)`,
      tags: ['voltron-gap', ...cluster.detected_topics],
      confidence: 0.85,
      machine: 'mdj1',
      source_session_id: `gap-analysis-${new Date().toISOString().split('T')[0]}`,
      created_at: Timestamp.now(),
      promoted_to_claude_md: false,
      gap_metadata: {
        question_count: cluster.question_count,
        sample_questions: cluster.sample_questions.slice(0, 3),
        detected_topics: cluster.detected_topics,
      },
    }
    writeBatch.set(ref, entry as Record<string, unknown>)
  }

  await writeBatch.commit()
  return clusters.length
}

/**
 * Post gap summary to JDM Slack DM.
 */
async function postSlackDigest(clusters: GapCluster[]): Promise<void> {
  if (!SLACK_TOKEN || clusters.length === 0) return

  const summary = clusters
    .map((c) => `*${c.topic}* (${c.question_count} questions)\n${c.sample_questions.slice(0, 2).map((q) => `  - ${q}`).join('\n')}`)
    .join('\n\n')

  const text = `*VOLTRON Gap Analysis*\n\n${clusters.length} knowledge gaps detected this week:\n\n${summary}`

  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: JDM_DM_ID, text }),
    })
  } catch (err) {
    console.error('[gap-analyzer] Slack post failed:', err)
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  console.log('[gap-analyzer] Starting VOLTRON gap analysis...')

  const conversations = await getLowConfidenceConversations(7)
  console.log(`[gap-analyzer] Found ${conversations.length} low-confidence conversations`)

  if (conversations.length === 0) {
    console.log('[gap-analyzer] No gaps to analyze. Done.')
    return
  }

  const clusters = await clusterGaps(conversations)
  console.log(`[gap-analyzer] Identified ${clusters.length} gap clusters`)

  const written = await writeGapEntries(clusters)
  console.log(`[gap-analyzer] Wrote ${written} knowledge entries`)

  await postSlackDigest(clusters)
  console.log('[gap-analyzer] Done.')
}

main().catch((err) => {
  console.error('[gap-analyzer] Fatal:', err)
  process.exit(1)
})
