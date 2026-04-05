/**
 * WIRE_CAMPAIGN (MUS-C08)
 * Digital campaign pipeline: create → target → schedule → execute
 */
import type { CmoWireDefinition } from '../types'

export const WIRE_CAMPAIGN: CmoWireDefinition = {
  wireId: 'WIRE_CAMPAIGN',
  name: 'Campaign Wire',
  channel: 'digital',
  description: 'End-to-end digital campaign: create campaign → audience targeting → schedule drip/blast → execute send',
  steps: [
    {
      stepId: 'campaign-1-create',
      toolId: 'c3-campaigns',
      description: 'Create campaign record with metadata, template selection, and compliance tags',
    },
    {
      stepId: 'campaign-2-target',
      toolId: 'c3-campaign-analytics',
      description: 'Define audience targeting — cohort selection, exclusion rules, AEP blackout check',
    },
    {
      stepId: 'campaign-3-schedule',
      toolId: 'c3-campaign-send',
      description: 'Schedule campaign execution — drip sequence timing or blast send window',
    },
    {
      stepId: 'campaign-4-execute',
      toolId: 'c3-campaign-send',
      description: 'Execute the scheduled send — throttled delivery with real-time status tracking',
    },
  ],
}
