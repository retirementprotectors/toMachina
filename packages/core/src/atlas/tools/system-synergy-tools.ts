// ---------------------------------------------------------------------------
// Atomic Tools: System Synergy — Platform Observability + Hygiene
// ZRD-SYN-007 | 10 API-endpoint tools registered in ATLAS
// Execute via: GET /api/system-synergy/{tool_id}
// ---------------------------------------------------------------------------

import type { AtomicToolDefinition } from '../types'

export const sessionInventoryDefinition: AtomicToolDefinition = {
  tool_id: 'session-inventory',
  name: 'Session Inventory',
  description: 'List all Claude Code sessions with metadata — warrior name, working directory, date, file size, subagent count, active/stale classification.',
  used_by: ['SUPER_PLATFORM_HEALTH', 'SUPER_SESSION_FORENSICS'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const memoryInventoryDefinition: AtomicToolDefinition = {
  tool_id: 'memory-inventory',
  name: 'Memory Inventory',
  description: 'List all MEMORY.md entries across all projects with staleness scoring. Flag entries older than 21 days unconfirmed.',
  used_by: ['SUPER_KNOWLEDGE_PIPELINE_STATUS', 'SUPER_WARRIOR_READINESS'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const claudeMdDiffDefinition: AtomicToolDefinition = {
  tool_id: 'claude-md-diff',
  name: 'CLAUDE.md Diff',
  description: 'Show what changed in any CLAUDE.md over the last N days using git history.',
  used_by: ['SUPER_KNOWLEDGE_PIPELINE_STATUS'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const brainHealthDefinition: AtomicToolDefinition = {
  tool_id: 'brain-health',
  name: 'Brain Health',
  description: 'Per-warrior brain.txt stats — lines, last updated, PHI scan, size, extraction status.',
  used_by: ['SUPER_KNOWLEDGE_PIPELINE_STATUS', 'SUPER_WARRIOR_READINESS'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const knowledgeQueryDefinition: AtomicToolDefinition = {
  tool_id: 'knowledge-query',
  name: 'Knowledge Query',
  description: 'Query Firestore knowledge_entries by type, confidence, warrior, date range.',
  used_by: ['SUPER_KNOWLEDGE_PIPELINE_STATUS'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const sessionEnvAuditDefinition: AtomicToolDefinition = {
  tool_id: 'session-env-audit',
  name: 'Session Env Audit',
  description: 'Map session-env directories to sessions, find orphans (env dirs with no matching session), find stale sprint directories.',
  used_by: ['SUPER_SESSION_FORENSICS'],
  category: 'PLATFORM_HYGIENE',
}

export const duplicateDetectorDefinition: AtomicToolDefinition = {
  tool_id: 'duplicate-detector',
  name: 'Duplicate Detector',
  description: 'Find duplicate/conflicting entries across MEMORY.md files, duplicate HTML docs, and redundant config files.',
  used_by: ['SUPER_SESSION_FORENSICS'],
  category: 'PLATFORM_HYGIENE',
}

export const warriorRosterDefinition: AtomicToolDefinition = {
  tool_id: 'warrior-roster',
  name: 'Warrior Roster',
  description: 'Which warriors have tmux sessions on MDJ_SERVER, queue depth per warrior, last activity timestamp.',
  used_by: ['SUPER_PLATFORM_HEALTH', 'SUPER_WARRIOR_READINESS'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const deployStatusDefinition: AtomicToolDefinition = {
  tool_id: 'deploy-status',
  name: 'Deploy Status',
  description: 'Current state of all CI runs, last successful deploy timestamp, pending PRs, broken tests.',
  used_by: ['SUPER_PLATFORM_HEALTH'],
  category: 'PLATFORM_OBSERVABILITY',
}

export const hookAuditDefinition: AtomicToolDefinition = {
  tool_id: 'hook-audit',
  name: 'Hook Audit',
  description: 'Verify hookify symlinks across all projects, report missing/broken rules, check service health on MDJ_SERVER.',
  used_by: ['SUPER_PLATFORM_HEALTH'],
  category: 'PLATFORM_HYGIENE',
}

/** All 10 System Synergy atomic tool definitions */
export function getSynergyToolDefinitions(): AtomicToolDefinition[] {
  return [
    sessionInventoryDefinition,
    memoryInventoryDefinition,
    claudeMdDiffDefinition,
    brainHealthDefinition,
    knowledgeQueryDefinition,
    sessionEnvAuditDefinition,
    duplicateDetectorDefinition,
    warriorRosterDefinition,
    deployStatusDefinition,
    hookAuditDefinition,
  ]
}
