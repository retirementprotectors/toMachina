// ---------------------------------------------------------------------------
// Super Tools: System Synergy — Platform Observability Composites
// ZRD-SYN-007 | 4 Super Tools registered in ATLAS
// These compose atomic tools via API calls — no execute functions here.
// Frontend calls multiple endpoints and merges results.
// ---------------------------------------------------------------------------

import type { SuperToolDefinition } from '../types'

export const platformHealthDefinition: SuperToolDefinition = {
  super_tool_id: 'SUPER_PLATFORM_HEALTH',
  name: 'Platform Health',
  description: 'Full platform status — warriors, deploys, hooks, sessions — in one composite call. Use when JDM says "check the immune system" or any warrior wants current state.',
  tools: ['session-inventory', 'warrior-roster', 'deploy-status', 'hook-audit'],
}

export const knowledgePipelineStatusDefinition: SuperToolDefinition = {
  super_tool_id: 'SUPER_KNOWLEDGE_PIPELINE_STATUS',
  name: 'Knowledge Pipeline Status',
  description: 'Is the learning loop flowing? Where is it stuck? Which warriors have stale brains? Composes knowledge query + memory inventory + brain health + CLAUDE.md diff.',
  tools: ['knowledge-query', 'memory-inventory', 'brain-health', 'claude-md-diff'],
}

export const sessionForensicsDefinition: SuperToolDefinition = {
  super_tool_id: 'SUPER_SESSION_FORENSICS',
  name: 'Session Forensics',
  description: 'Orphaned sessions, stale sprint dirs, duplicate configs, temp worktree remnants. Use for disk space issues or warrior confusion from stale state.',
  tools: ['session-inventory', 'session-env-audit', 'duplicate-detector'],
}

export const warriorReadinessDefinition: SuperToolDefinition = {
  super_tool_id: 'SUPER_WARRIOR_READINESS',
  name: 'Warrior Readiness',
  description: 'Is each warrior\'s context fresh and complete? Who has gaps? Who is stale? Use before launching sprints or data operations.',
  tools: ['warrior-roster', 'brain-health', 'memory-inventory'],
}

/** All 4 System Synergy super tool definitions */
export function getSynergySuperToolDefinitions(): SuperToolDefinition[] {
  return [
    platformHealthDefinition,
    knowledgePipelineStatusDefinition,
    sessionForensicsDefinition,
    warriorReadinessDefinition,
  ]
}
