/**
 * Warrior Registry — Firestore dojo_warriors collection types.
 * TRK-14183 | Sprint: Learning Loop 2.0 v2
 *
 * Each warrior in the toMachina dojo has a registry entry defining identity,
 * role, personality, file paths (soul/spirit/brain), and runtime metadata.
 */

export type WarriorType = 'tmux' | 'ccsdk'

export type ExecutiveRole = 'CTO' | 'COO' | 'VP_CMO' | 'Builder' | 'Guardian' | 'Bot'

export type WarriorStatus = 'active' | 'dormant' | 'migrating'

export interface WarriorRegistry {
  /** Lowercase identifier — Firestore doc ID (e.g. 'shinob1') */
  name: string

  /** Uppercase display name (e.g. 'SHINOB1') */
  display_name: string

  /** tmux = Executive.AI (JDM-facing), ccsdk = Claude SDK mesh agent */
  type: WarriorType

  /** Authority domain — what this warrior owns */
  executive_role: ExecutiveRole

  /** Character descriptor (e.g. 'The Architect', 'The Creative') */
  personality: string

  /** Operational status */
  status: WarriorStatus

  /** Path to soul.md in dojo-warriors repo (tmux only) */
  soul_path: string | null

  /** Path to spirit.md in dojo-warriors repo (tmux only) */
  spirit_path: string | null

  /** Path to brain.txt in dojo-warriors repo */
  brain_path: string | null

  /** Last time brain.txt was appended to */
  last_brain_update: FirebaseFirestore.Timestamp | null

  /** Last session start timestamp */
  last_session_start: FirebaseFirestore.Timestamp | null

  /** Host machine identifier (e.g. 'mdj1', 'air', 'pro') */
  machine: string

  /** tmux session name (tmux warriors only) */
  tmux_session: string | null

  /** API endpoint for CCSDK agents (ccsdk warriors only) */
  ccsdk_route: string | null
}

/** Firestore collection name */
export const DOJO_WARRIORS_COLLECTION = 'dojo_warriors'
