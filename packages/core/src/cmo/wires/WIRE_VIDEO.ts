/**
 * WIRE_VIDEO (MUS-D08)
 * Video pipeline: script brief → Veo generation → Drive archive → WordPress embed (optional)
 *
 * Pure data definition — no side effects at definition time.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoWireDefinition } from '../types'

export const WIRE_VIDEO: CmoWireDefinition = {
  wireId: 'WIRE_VIDEO',
  name: 'Video Wire',
  channel: 'video',
  description:
    'Video production: validate script brief → Veo text-to-video → Drive archive → optional WordPress embed',
  steps: [
    {
      stepId: 'video-1-validate-brief',
      toolId: 'validate-video-brief',
      description:
        'Validate video brief: productName, market (b2c|b2b|b2e), videoType (explainer|education|testimonial), scriptBrief (max 500 chars), durationSeconds (15|30|60), targetPageSlug?',
      inputSchemaRef:
        '{ productName: string, market: "b2c"|"b2b"|"b2e", videoType: "explainer"|"education"|"testimonial", scriptBrief: string, durationSeconds: 15|30|60, targetPageSlug?: string }',
      outputSchemaRef: '{ validated: true, videoType: string, durationSeconds: number }',
    },
    {
      stepId: 'video-2-generate-veo',
      toolId: 'generate-video',
      description: 'Generate video via Veo text-to-video. Validates status with check_video_status before proceeding.',
      inputSchemaRef: '{ scriptBrief: string, durationSeconds: number }',
      outputSchemaRef: '{ videoId: string, videoUrl: string, status: string }',
    },
    {
      stepId: 'video-3-archive-drive',
      toolId: 'drive-asset-archive',
      description: 'Archive video to Shared Drive under Video/{year}/{market} via download_video',
      inputSchemaRef: '{ videoUrl: string, market: string, year: string }',
      outputSchemaRef: '{ driveFileUrl: string, driveFileId: string }',
    },
    {
      stepId: 'video-4-embed-wordpress',
      toolId: 'wordpress-update-page',
      description:
        'Embed video on target WordPress page. Optional — skipped if no targetPageSlug provided.',
      inputSchemaRef: '{ videoUrl: string, targetPageSlug: string }',
      outputSchemaRef: '{ pageUrl: string, updated: boolean }',
    },
  ],
}
