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
      inputSchemaRef: 'CampaignInput',
      outputSchemaRef: '{ campaignId: string }',
    },
    {
      stepId: 'campaign-2-target',
      toolId: 'c3-campaign-analytics',
      description: 'Define audience targeting — cohort selection, exclusion rules, AEP blackout check',
      inputSchemaRef: '{ campaignId: string, audience: CampaignInput["audience"] }',
      outputSchemaRef: '{ targetingConfirmed: boolean, recipientCount: number }',
    },
    {
      stepId: 'campaign-3-schedule',
      toolId: 'c3-campaign-send',
      description: 'Schedule campaign execution — drip sequence timing or blast send window',
      inputSchemaRef: '{ campaignId: string, schedule: CampaignInput["schedule"] }',
      outputSchemaRef: '{ scheduled: boolean, scheduledAt: string }',
    },
    {
      stepId: 'campaign-4-execute',
      toolId: 'c3-campaign-send',
      description: 'Execute the scheduled send — throttled delivery with real-time status tracking',
      inputSchemaRef: '{ campaignId: string, sendChannels: Array<"email" | "sms"> }',
      outputSchemaRef: '{ campaignId: string, status: string, recipientCount: number, channels: string[] }',
    },
  ],
}
