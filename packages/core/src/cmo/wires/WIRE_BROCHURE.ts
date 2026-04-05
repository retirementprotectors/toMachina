/**
 * WIRE_BROCHURE (MUS-C08)
 * Print brochure pipeline: design → export → render → archive
 */
import type { CmoWireDefinition } from '../types'

export const WIRE_BROCHURE: CmoWireDefinition = {
  wireId: 'WIRE_BROCHURE',
  name: 'Brochure Wire',
  channel: 'print',
  description: 'End-to-end print brochure: Canva design from brand kit → PDF export → print-spec render → Drive archive',
  steps: [
    {
      stepId: 'brochure-1-design',
      toolId: 'canva-generate-design',
      description: 'Generate brochure design from brand kit template using AI prompt',
    },
    {
      stepId: 'brochure-2-export',
      toolId: 'canva-export-design',
      description: 'Export the approved design to PDF format',
    },
    {
      stepId: 'brochure-3-render',
      toolId: 'pdf-render',
      description: 'Render PDF to print specification (bleed, trim, color profile)',
    },
    {
      stepId: 'brochure-4-archive',
      toolId: 'drive-asset-archive',
      description: 'Archive final print-ready PDF to registered Shared Drive folder',
    },
  ],
}
