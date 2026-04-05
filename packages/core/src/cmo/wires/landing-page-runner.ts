/**
 * WIRE_LANDING_PAGE Tool Runner (MUS-O04)
 *
 * Step implementations for the Web Artisan wire:
 * WordPress draft → Elementor layout → media upload → publish
 *
 * All steps use the rpi-workspace WordPress MCP tools.
 * Step 3 (media upload) is optional — skipped if no heroImageUrl.
 */
import type { ToolRunner, LandingPageInput } from '../types'

/** Build toolRunner for WIRE_LANDING_PAGE given typed input */
export function createLandingPageRunner(
  mcpCall: (tool: string, params: Record<string, unknown>) => Promise<unknown>,
): ToolRunner {
  return async (toolId, _input, context) => {
    const pageInput = context as unknown as LandingPageInput & Record<string, unknown>

    switch (toolId) {
      case 'wordpress-create-page': {
        const result = await mcpCall('mcp__rpi-workspace__wordpress_create_page', {
          title: pageInput.content.title,
          status: 'draft',
          slug: pageInput.slug,
          content: pageInput.content.bodyText,
        }) as { id?: number; pageId?: number; error?: string }
        const pageId = result.id || result.pageId
        if (!pageId) {
          return { success: false, error: result.error || 'WordPress did not return a page ID — slug may already exist' }
        }
        return { success: true, output: { pageId } }
      }

      case 'wordpress-update-elementor-element': {
        const pageId = context.pageId as number
        if (!pageId) {
          return { success: false, error: 'No pageId in context from previous step' }
        }
        const templateId = pageInput.design?.elementorTemplateId
        const colorScheme = pageInput.design?.colorScheme || 'rpi-blue'
        const params: Record<string, unknown> = {
          page_id: pageId,
          elements: [
            {
              type: 'section',
              settings: {
                headline: pageInput.content.headline,
                subheadline: pageInput.content.subheadline,
                cta_text: pageInput.content.ctaText,
                cta_url: pageInput.content.ctaUrl,
                color_scheme: colorScheme,
              },
            },
          ],
        }
        if (templateId) {
          params.template_id = templateId
        }
        const result = await mcpCall('mcp__rpi-workspace__wordpress_update_elementor_element', params) as { success?: boolean; error?: string }
        if (result.success === false) {
          return { success: false, error: result.error || 'Failed to apply Elementor layout' }
        }
        return { success: true, output: { layoutApplied: true } }
      }

      case 'wordpress-upload-media': {
        const heroImageUrl = pageInput.design?.heroImageUrl
        if (!heroImageUrl) {
          // Step is optional — skip if no image provided
          return { success: true, output: { skipped: true } }
        }
        const result = await mcpCall('mcp__rpi-workspace__wordpress_upload_media', {
          url: heroImageUrl,
          title: `${pageInput.content.title} - Hero Image`,
        }) as { id?: number; mediaId?: number; error?: string }
        const mediaId = result.id || result.mediaId
        if (!mediaId) {
          return { success: false, error: result.error || 'WordPress did not return a media ID' }
        }
        return { success: true, output: { mediaId } }
      }

      case 'wordpress-update-page': {
        const pageId = context.pageId as number
        if (!pageId) {
          return { success: false, error: 'No pageId in context from previous step' }
        }
        const updateParams: Record<string, unknown> = {
          id: pageId,
          status: 'publish',
        }
        // Set featured image if media was uploaded
        const mediaId = context.mediaId as number | undefined
        if (mediaId && !context.skipped) {
          updateParams.featured_media = mediaId
        }
        const result = await mcpCall('mcp__rpi-workspace__wordpress_update_page', updateParams) as {
          link?: string
          url?: string
          error?: string
        }
        const pageUrl = result.link || result.url
        if (!pageUrl) {
          return { success: false, error: result.error || 'WordPress did not return a page URL' }
        }
        return {
          success: true,
          output: { pageId, pageUrl, status: 'publish' },
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolId}` }
    }
  }
}
