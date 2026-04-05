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
    },
    {
      stepId: 'landing-2-layout',
      toolId: 'wordpress-update-elementor-element',
      description: 'Build Elementor layout — sections, widgets, CTAs, responsive breakpoints',
    },
    {
      stepId: 'landing-3-assets',
      toolId: 'wordpress-upload-media',
      description: 'Upload hero images, icons, and media assets to WordPress library',
    },
    {
      stepId: 'landing-4-publish',
      toolId: 'wordpress-update-page',
      description: 'Set page status to published — go live',
    },
  ],
}
