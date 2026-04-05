/**
 * WIRE_BROCHURE Tool Runner (MUS-O02)
 *
 * Step implementations for the Print Artisan wire:
 * Canva design → PDF export → print-spec render → Drive archive
 *
 * Each function maps a stepId to an MCP/API call.
 * The wire executor calls these via the toolRunner callback.
 */
import type { ToolRunner, BrochureInput } from '../types'

const CMO_ASSETS_FOLDER_ID = process.env.CMO_ASSETS_DRIVE_FOLDER_ID || ''

/** Build toolRunner for WIRE_BROCHURE given typed input */
export function createBrochureRunner(
  mcpCall: (tool: string, params: Record<string, unknown>) => Promise<unknown>,
  apiCall: (method: string, path: string, body?: Record<string, unknown>) => Promise<unknown>,
): ToolRunner {
  return async (toolId, _input, context) => {
    const brochureInput = context as unknown as BrochureInput & Record<string, unknown>

    switch (toolId) {
      case 'canva-generate-design': {
        const brandKitId = brochureInput.brandKitId
        if (!brandKitId) {
          // Try to get default brand kit
          const kits = await mcpCall('mcp__rpi-workspace__canva_list_brand_kits', {})
          const kitList = kits as { items?: Array<{ id: string }> }
          if (!kitList.items?.length) {
            return { success: false, error: 'No brand kits found and no brandKitId provided' }
          }
          brochureInput.brandKitId = kitList.items[0].id
        }
        const result = await mcpCall('mcp__rpi-workspace__canva_generate_design', {
          brand_kit_id: brochureInput.brandKitId,
          prompt: `${brochureInput.market} - ${brochureInput.product} brochure for ${brochureInput.target}. Tone: ${brochureInput.tone}`,
        }) as { design_id?: string; id?: string }
        const designId = result.design_id || result.id
        if (!designId) {
          return { success: false, error: 'Canva did not return a design ID' }
        }
        return { success: true, output: { designId } }
      }

      case 'canva-export-design': {
        const designId = context.designId as string
        if (!designId) {
          return { success: false, error: 'No designId in context from previous step' }
        }
        const result = await mcpCall('mcp__rpi-workspace__canva_export_design', {
          design_id: designId,
          format: 'pdf',
        }) as { url?: string; export_url?: string }
        const exportUrl = result.url || result.export_url
        if (!exportUrl) {
          return { success: false, error: 'Canva export did not return a URL' }
        }
        return { success: true, output: { exportUrl } }
      }

      case 'pdf-render': {
        const exportUrl = context.exportUrl as string
        if (!exportUrl) {
          return { success: false, error: 'No exportUrl in context from previous step' }
        }
        const result = await apiCall('POST', '/api/pdf/render', {
          sourceUrl: exportUrl,
          specs: { bleed: '0.125in', colorSpace: 'CMYK', resolution: 300 },
        }) as { data?: { url?: string; renderedPdfUrl?: string } }
        const renderedPdfUrl = result.data?.url || result.data?.renderedPdfUrl
        if (!renderedPdfUrl) {
          return { success: false, error: 'PDF_SERVICE render did not return a URL' }
        }
        return { success: true, output: { renderedPdfUrl } }
      }

      case 'drive-asset-archive': {
        const renderedPdfUrl = context.renderedPdfUrl as string
        const market = brochureInput.market || 'unknown-market'
        const product = brochureInput.product || 'unknown-product'
        if (!renderedPdfUrl) {
          return { success: false, error: 'No renderedPdfUrl in context from previous step' }
        }
        if (!CMO_ASSETS_FOLDER_ID) {
          return { success: false, error: 'CMO_ASSETS_DRIVE_FOLDER_ID not configured' }
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = `${market}-${product}-brochure-${timestamp}.pdf`
        const result = await mcpCall('mcp__gdrive__upload_file', {
          folder_id: CMO_ASSETS_FOLDER_ID,
          name: fileName,
          url: renderedPdfUrl,
          mime_type: 'application/pdf',
        }) as { id?: string; webViewLink?: string }
        const driveFileUrl = result.webViewLink || `https://drive.google.com/file/d/${result.id}`
        return {
          success: true,
          output: { driveFileUrl, driveFileId: result.id, fileName },
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolId}` }
    }
  }
}
