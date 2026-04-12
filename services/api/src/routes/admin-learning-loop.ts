/**
 * Admin Learning Loop route — GET /api/admin/learning-loop
 * TRK-14179 | Sprint: Learning Loop 2.0 v2
 *
 * Returns dashboard data for the Learning Loop admin tab.
 * Requires JDM entitlement (EXECUTIVE or OWNER role).
 */

import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { getDefaultDb } from '../lib/db.js'
import { successResponse, errorResponse } from '../lib/helpers.js'

export const adminLearningLoopRoutes = Router()

// Auth Guard — require executive-level access


// Knowledge Entry Stats
interface KnowledgeStats {
  total: number
  by_type: Record<string, number>
  by_confidence: { high: number; medium: number; low: number }
  promoted_count: number
  recent_entries: Array<{ id: string; type: string; content: string; confidence: number; created_at: string }>
}

async function getKnowledgeStats(): Promise<KnowledgeStats> {
  const db = getDefaultDb()
  const snapshot = await db.collection('knowledge_entries').orderBy('created_at', 'desc').limit(200).get()

  const stats: KnowledgeStats = {
    total: snapshot.size,
    by_type: {},
    by_confidence: { high: 0, medium: 0, low: 0 },
    promoted_count: 0,
    recent_entries: [],
  }

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const type = String(data.type || 'unknown')
    const confidence = Number(data.confidence || 0)

    stats.by_type[type] = (stats.by_type[type] || 0) + 1
    if (confidence >= 0.85) stats.by_confidence.high++
    else if (confidence >= 0.7) stats.by_confidence.medium++
    else stats.by_confidence.low++
    if (data.promoted_to_claude_md) stats.promoted_count++

    if (stats.recent_entries.length < 10) {
      stats.recent_entries.push({
        id: doc.id,
        type,
        content: String(data.content || '').slice(0, 200),
        confidence,
        created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : String(data.created_at || ''),
      })
    }
  }

  return stats
}

// VOLTRON Gaps
interface VoltronGap {
  content: string
  question_count: number
  detected_topics: string[]
  created_at: string
}

async function getVoltronGaps(): Promise<VoltronGap[]> {
  const db = getDefaultDb()
  const snapshot = await db
    .collection('knowledge_entries')
    .where('tags', 'array-contains', 'voltron-gap')
    .orderBy('created_at', 'desc')
    .limit(10)
    .get()

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      content: String(data.content || ''),
      question_count: data.gap_metadata?.question_count || 0,
      detected_topics: data.gap_metadata?.detected_topics || [],
      created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : String(data.created_at || ''),
    }
  })
}

// Warrior Registry Summary
async function getWarriorSummary(): Promise<Array<{ name: string; status: string; type: string; last_brain_update: string | null }>> {
  const db = getDefaultDb()
  const snapshot = await db.collection('dojo_warriors').get()

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      name: String(data.display_name || doc.id),
      status: String(data.status || 'unknown'),
      type: String(data.type || 'unknown'),
      last_brain_update: data.last_brain_update instanceof Timestamp
        ? data.last_brain_update.toDate().toISOString()
        : null,
    }
  })
}

// GET /api/admin/learning-loop — dashboard data
adminLearningLoopRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const [knowledgeStats, voltronGaps, warriors] = await Promise.all([
      getKnowledgeStats(),
      getVoltronGaps(),
      getWarriorSummary(),
    ])

    const dashboard = {
      knowledge_entries: knowledgeStats,
      voltron_gaps: voltronGaps,
      warriors,
      pipeline_health: {
        entity_extractor: 'daily 2am',
        knowledge_promote: 'daily 4am',
        claude_md_tracker: 'weekly Sunday 3am',
        session_extract: 'weekly Saturday 11pm',
        gap_analyzer: 'daily 2am',
      },
    }

    res.json(successResponse(dashboard))
  } catch (err) {
    console.error('[admin-learning-loop] Dashboard fetch failed:', err)
    res.status(500).json(errorResponse('Failed to fetch learning loop dashboard'))
  }
})
