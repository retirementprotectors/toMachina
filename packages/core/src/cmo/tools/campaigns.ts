/**
 * C3 Campaign API Tools (MUS-C06)
 * 6 internal API routes registered as CMO tools — not MCP tools
 */
import type { CmoRegistryEntry } from '../types'

export const C3_TOOLS: CmoRegistryEntry[] = [
  {
    id: 'c3-campaigns',
    type: 'TOOL', domain: 'cmo', toolDomain: 'c3',
    name: 'Campaign Manager',
    description: 'CRUD for campaigns — create, list, update, archive. 238 lines. Routes: /api/campaigns (services/api/src/routes/campaigns.ts)',
    channel: 'digital',
  },
  {
    id: 'c3-templates',
    type: 'TOOL', domain: 'cmo', toolDomain: 'c3',
    name: 'Template Manager',
    description: 'Email/SMS template CRUD with variable interpolation. 176 lines. Routes: /api/templates (services/api/src/routes/templates.ts)',
    channel: 'digital',
  },
  {
    id: 'c3-campaign-analytics',
    type: 'TOOL', domain: 'cmo', toolDomain: 'c3',
    name: 'Campaign Analytics',
    description: 'Delivery stats, open/click rates, engagement metrics, cohort analysis. 486 lines. Routes: /api/campaign-analytics (services/api/src/routes/campaign-analytics.ts)',
    channel: 'digital',
  },
  {
    id: 'c3-campaign-send',
    type: 'TOOL', domain: 'cmo', toolDomain: 'c3',
    name: 'Campaign Execution Engine',
    description: 'The heaviest C3 route — drip sequences, blast sends, scheduling, throttling, AEP blackout enforcement. 1,321 lines. Routes: /api/campaign-send (services/api/src/routes/campaign-send.ts)',
    channel: 'digital',
  },
  {
    id: 'c3-content-blocks',
    type: 'TOOL', domain: 'cmo', toolDomain: 'c3',
    name: 'Content Blocks',
    description: 'Reusable content fragments for template composition — headers, footers, CTAs, compliance blocks. 191 lines. Routes: /api/content-blocks (services/api/src/routes/content-blocks.ts)',
    channel: 'digital',
  },
  {
    id: 'c3-sensei-content',
    type: 'TOOL', domain: 'cmo', toolDomain: 'c3',
    name: 'Sensei Content Generator',
    description: 'AI-powered content generation for campaigns — subject lines, body copy, personalization. 201 lines. Routes: /api/sensei-content (services/api/src/routes/sensei-content.ts)',
    channel: 'digital',
  },
]
