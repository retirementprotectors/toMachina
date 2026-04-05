/**
 * CMO Artisan Configuration (MUS-O06)
 *
 * Three artisans for OPERATE phase:
 * - Print Artisan → WIRE_BROCHURE (Canva, PDF_SERVICE, Drive)
 * - Digital Artisan → WIRE_CAMPAIGN (C3 API, COMMS)
 * - Web Artisan → WIRE_LANDING_PAGE (WordPress MCP, Elementor)
 *
 * Static config data, not a class with state. Pure data export.
 */
import type { CmoArtisan, CmoChannel } from './types'

export const CMO_ARTISANS: CmoArtisan[] = [
  {
    id: 'print-artisan',
    name: 'Print Artisan',
    channel: 'print',
    wireId: 'WIRE_BROCHURE',
    toolDomains: ['canva', 'pdf', 'drive'],
    description: 'Brochure and print collateral production — Canva design → PDF render → Drive archive',
    status: 'active',
  },
  {
    id: 'digital-artisan',
    name: 'Digital Artisan',
    channel: 'digital',
    wireId: 'WIRE_CAMPAIGN',
    toolDomains: ['c3'],
    description: 'Digital campaign execution — C3 create → audience target → schedule → send',
    status: 'active',
  },
  {
    id: 'web-artisan',
    name: 'Web Artisan',
    channel: 'web',
    wireId: 'WIRE_LANDING_PAGE',
    toolDomains: ['wordpress'],
    description: 'Landing page production — WordPress draft → Elementor layout → media → publish',
    status: 'active',
  },
  {
    id: 'social-artisan',
    name: 'Social Artisan',
    channel: 'social',
    wireId: 'WIRE_SOCIAL',
    toolDomains: ['canva', 'veo'],
    description: 'Social media production — content calendar → Canva social asset → optional Veo clip → Drive archive',
    status: 'active',
  },
  {
    id: 'video-artisan',
    name: 'Video Artisan',
    channel: 'video',
    wireId: 'WIRE_VIDEO',
    toolDomains: ['veo', 'wordpress'],
    description: 'Video production — script brief → Veo text-to-video → Drive archive → optional WordPress embed',
    status: 'active',
  },
]

/** Look up a single artisan by ID */
export function getArtisan(id: string): CmoArtisan | undefined {
  return CMO_ARTISANS.find((a) => a.id === id)
}

/** Look up an artisan by content channel */
export function getArtisanByChannel(channel: CmoChannel): CmoArtisan | undefined {
  return CMO_ARTISANS.find((a) => a.channel === channel)
}

/** Look up an artisan by wire ID */
export function getArtisanByWire(wireId: string): CmoArtisan | undefined {
  return CMO_ARTISANS.find((a) => a.wireId === wireId)
}
