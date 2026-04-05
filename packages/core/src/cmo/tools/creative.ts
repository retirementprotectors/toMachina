/**
 * Creative Tools (MUS-C07)
 * Standalone tools: PDF_SERVICE, frontend-design skill, Google Drive asset ops
 */
import type { CmoRegistryEntry } from '../types'

export const CREATIVE_TOOLS: CmoRegistryEntry[] = [
  // PDF_SERVICE — Cloud Run render service
  {
    id: 'pdf-render',
    type: 'TOOL', domain: 'cmo', toolDomain: 'pdf',
    name: 'PDF Render Service',
    description: 'Cloud Run service that renders HTML/templates to print-spec PDFs. Final output step for print channel.',
    channel: 'print',
  },

  // frontend-design — Claude Code plugin/skill
  {
    id: 'frontend-design-generate',
    type: 'TOOL', domain: 'cmo', toolDomain: 'frontend-design',
    name: 'Frontend Design Generator',
    description: 'Claude Code skill that generates polished React portal components — landing pages, dashboards, forms.',
    channel: ['digital', 'web'],
  },

  // Google Drive asset operations
  {
    id: 'drive-asset-archive',
    type: 'TOOL', domain: 'cmo', toolDomain: 'drive',
    name: 'Drive Asset Archive',
    description: 'Archive completed creative assets to registered Shared Drive folders for compliance and retrieval.',
    channel: ['print', 'digital', 'web', 'social', 'video'],
  },
  {
    id: 'drive-asset-search',
    type: 'TOOL', domain: 'cmo', toolDomain: 'drive',
    name: 'Drive Asset Search',
    description: 'Search Shared Drive for existing creative assets by name, type, or campaign tag.',
    channel: ['print', 'digital', 'web', 'social', 'video'],
  },
  {
    id: 'drive-folder-manage',
    type: 'TOOL', domain: 'cmo', toolDomain: 'drive',
    name: 'Drive Folder Management',
    description: 'Create and organize Shared Drive folder structures for campaign assets and deliverables.',
    channel: ['print', 'digital', 'web', 'social', 'video'],
  },
]
