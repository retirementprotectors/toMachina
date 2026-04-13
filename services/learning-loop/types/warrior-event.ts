/**
 * WarriorEvent — Firestore warrior_events collection types.
 * ZRD-SYN-020 | Warrior Event Log
 *
 * Append-only event log for AI warrior activity. Enables:
 * - Session recovery (warriors self-brief on restart)
 * - Cross-warrior visibility (query each other's activity)
 * - System Synergy dashboard tile (real-time warrior status)
 *
 * Retention: 30 days active, then auto-archived to warrior_events_archive
 * via wire-event-cleanup (MEGAZORD owns: ZRD-SYN-020l).
 */

import type { firestore } from 'firebase-admin'

export type WarriorEventType =
  | 'directive'       // Incoming directive from JDM or another warrior
  | 'task_started'    // Warrior begins a sprint/task
  | 'pr_shipped'      // PR created/merged
  | 'slack_sent'      // Slack message posted
  | 'delegation'      // Work handed off to another warrior
  | 'milestone'       // Significant progress checkpoint
  | 'error'           // Error encountered
  | 'decision'        // Architectural or process decision logged

export type WarriorName =
  | 'SHINOB1'
  | 'MEGAZORD'
  | 'MUSASHI'
  | 'VOLTRON'
  | 'RAIDEN'
  | 'RONIN'

export interface WarriorEventDetails {
  /** PR number for pr_shipped events */
  prNumber?: number
  /** Files changed in a PR */
  files?: string[]
  /** Target warrior for delegation events */
  delegateTo?: string
  /** Reasoning behind a decision */
  reasoning?: string
  /** Slack channel ID for slack_sent events */
  channelId?: string
  /** Source channel for directive events */
  sourceChannel?: string
  /** Sender user ID for directive events */
  senderId?: string
  /** Sprint ID for task_started events */
  sprintId?: string
  /** Ticket IDs associated with the event */
  tickets?: string[]
  /** PR URL */
  prUrl?: string
  /** Branch name */
  branch?: string
}

export interface WarriorEvent {
  /** Firestore doc ID (auto-generated) */
  id?: string

  /** Which warrior logged this event */
  warrior: WarriorName

  /** Claude Code session ID */
  sessionId: string

  /** When the event occurred */
  timestamp: firestore.Timestamp

  /** Event classification */
  type: WarriorEventType

  /** Human-readable one-line summary */
  summary: string

  /** Source Slack channel (optional) */
  channel?: string

  /** Rich payload for type-specific data */
  details?: WarriorEventDetails
}

/** Firestore collection name */
export const WARRIOR_EVENTS_COLLECTION = 'warrior_events'

/** Archived events collection (30+ days old) */
export const WARRIOR_EVENTS_ARCHIVE_COLLECTION = 'warrior_events_archive'
