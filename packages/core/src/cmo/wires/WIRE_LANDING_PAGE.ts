/**
 * WIRE_LANDING_PAGE (MUS-C08)
 * Web landing page pipeline: create → layout → assets → publish
 */
import type { CmoWireDefinition } from '../types'

export const WIRE_LANDING_PAGE: CmoWireDefinition = {
  wireId: 'WIRE_LANDING_PAGE',
  name: 'Landing Page Wire',
  channel: 'web',
  description: 'End-to-end landing page: WordPress draft → Elementor layout → media upload → publish live',
  steps: [
    {
      stepId: 'landing-1-create',
      toolId: 'wordpress-create-page',
      description: 'Create WordPress page as draft with SEO metadata and slug',
      inputSchemaRef: 'LandingPageInput',
      outputSchemaRef: '{ pageId: number }',
    },
    {
      stepId: 'landing-2-layout',
      toolId: 'wordpress-update-elementor-element',
      description: 'Build Elementor layout — sections, widgets, CTAs, responsive breakpoints',
      inputSchemaRef: '{ pageId: number, design: LandingPageInput["design"] }',
      outputSchemaRef: '{ layoutApplied: boolean }',
    },
    {
      stepId: 'landing-3-assets',
      toolId: 'wordpress-upload-media',
      description: 'Upload hero images, icons, and media assets to WordPress library',
      inputSchemaRef: '{ heroImageUrl?: string }',
      outputSchemaRef: '{ mediaId?: number, skipped?: boolean }',
    },
    {
      stepId: 'landing-4-publish',
      toolId: 'wordpress-update-page',
      description: 'Set page status to published — go live',
      inputSchemaRef: '{ pageId: number, mediaId?: number }',
      outputSchemaRef: '{ pageId: number, pageUrl: string, status: string }',
    },
  ],
}
