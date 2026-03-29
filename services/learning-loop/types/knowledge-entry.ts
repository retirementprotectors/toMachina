/**
 * KnowledgeEntry — Firestore knowledge_entries collection types.
 * TRK-14172 schema | Used by TRK-14184 (CLAUDE.md Evolution Tracking)
 *
 * Stores extracted decisions, patterns, insights, and violations
 * with confidence scoring (0.0-1.0) and semantic tags.
 */

import type { firestore } from 'firebase-admin'

export type KnowledgeEntryType = 'decision' | 'pattern' | 'insight' | 'violation' | 'architecture'

export type MachineName = 'air' | 'pro' | 'mdj1'

export interface KnowledgeEntry {
  /** Firestore doc ID (auto-generated) */
  id?: string

  /** Classification of the knowledge */
  type: KnowledgeEntryType

  /** Human-readable, single reusable sentence */
  content: string

  /** Semantic tags for filtering (e.g. ['claude-md-evolution', 'weekly', 'global']) */
  tags: string[]

  /** Confidence score 0.0-1.0 */
  confidence: number

  /** Source session or tracking ID */
  source_session_id: string

  /** Host machine that produced this entry */
  machine: MachineName

  /** When the entry was created */
  created_at: firestore.Timestamp

  /** Whether this entry has been promoted into CLAUDE.md */
  promoted_to_claude_md: boolean

  /** When entry was promoted (if applicable) */
  promoted_at?: firestore.Timestamp

  /** Optional TTL for auto-expiry */
  expiry_at?: firestore.Timestamp

  /** VOLTRON gap analysis metadata */
  gap_metadata?: {
    question_count: number
    sample_questions: string[]
    detected_topics: string[]
  }

  /** Sprint context for RONIN-generated entries */
  sprint_context?: {
    sprint_id: string
    phase: string
    tickets: string[]
  }
}

/** Firestore collection name */
export const KNOWLEDGE_ENTRIES_COLLECTION = 'knowledge_entries'
