/**
 * WIRE_SOCIAL (MUS-D07)
 * Social media pipeline: calendar entry → Canva social → Veo clip (optional) → Drive archive
 *
 * Pure data definition — no side effects at definition time.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoWireDefinition } from '../types'

export const WIRE_SOCIAL: CmoWireDefinition = {
  wireId: 'WIRE_SOCIAL',
  name: 'Social Wire',
  channel: 'social',
  description:
    'Social media production: validate calendar entry → generate Canva social asset → optional Veo clip → archive to Shared Drive',
  steps: [
    {
      stepId: 'social-1-validate-calendar',
      toolId: 'validate-calendar-entry',
      description:
        'Validate campaign calendar entry: campaignId, campaignName, platform (instagram|linkedin|facebook), copyBrief, assetBrief, scheduledDate',
      inputSchemaRef:
        '{ campaignId: string, campaignName: string, platform: "instagram"|"linkedin"|"facebook", copyBrief: string, assetBrief: string, scheduledDate: string }',
      outputSchemaRef: '{ validated: true, platform: string, dimensions: { width: number, height: number } }',
    },
    {
      stepId: 'social-2-generate-canva',
      toolId: 'canva-generate-design',
      description:
        'Generate platform-specific social asset via Canva (Instagram 1080x1080, LinkedIn 1200x627, Facebook 1200x630)',
      inputSchemaRef: '{ assetBrief: string, platform: string, dimensions: { width: number, height: number } }',
      outputSchemaRef: '{ designId: string, designUrl: string }',
    },
    {
      stepId: 'social-3-generate-veo-clip',
      toolId: 'generate-video',
      description: 'Generate optional short-form video clip via Veo. Skipped if includeVideo is false.',
      inputSchemaRef: '{ copyBrief: string, durationSeconds: 15 }',
      outputSchemaRef: '{ videoId: string, videoUrl: string }',
    },
    {
      stepId: 'social-4-archive-drive',
      toolId: 'drive-asset-archive',
      description: 'Archive social assets to Shared Drive under Social/{year}/{platform}',
      inputSchemaRef: '{ designUrl: string, videoUrl?: string, platform: string, year: string }',
      outputSchemaRef: '{ driveFileUrl: string, driveFileId: string }',
    },
  ],
}
