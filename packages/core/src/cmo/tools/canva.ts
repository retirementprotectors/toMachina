/**
 * Canva MCP Tools (MUS-C03)
 * 21 tools from rpi-workspace MCP — design, export, asset management
 */
import type { CmoRegistryEntry } from '../types'

export const CANVA_TOOLS: CmoRegistryEntry[] = [
  // Design Creation & Import
  { id: 'canva-generate-design', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Generate Design', description: 'Generate a new Canva design from a text prompt using AI', channel: ['print', 'digital', 'social'] },
  { id: 'canva-create-from-candidate', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Create from Candidate', description: 'Create a design from a generated candidate (AI design refinement)', channel: ['print', 'digital', 'social'] },
  { id: 'canva-import-design', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Import Design', description: 'Import an external design file into Canva', channel: ['print', 'digital', 'social'] },

  // Design Read & Search
  { id: 'canva-get-design', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Get Design', description: 'Retrieve design metadata by ID', channel: ['print', 'digital', 'social'] },
  { id: 'canva-get-design-content', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Get Design Content', description: 'Retrieve full design content including pages and elements', channel: ['print', 'digital', 'social'] },
  { id: 'canva-get-design-pages', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Get Design Pages', description: 'List all pages in a multi-page design', channel: ['print', 'digital', 'social'] },
  { id: 'canva-search-designs', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Search Designs', description: 'Search designs by query string across the team workspace', channel: ['print', 'digital', 'social'] },

  // Export
  { id: 'canva-export-design', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Export Design', description: 'Export design to PDF, PNG, JPG, or other format', channel: ['print', 'digital', 'social'] },
  { id: 'canva-get-export-formats', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Get Export Formats', description: 'List available export formats for a design', channel: ['print', 'digital', 'social'] },

  // Presentations
  { id: 'canva-get-presenter-notes', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Get Presenter Notes', description: 'Retrieve presenter notes from a presentation design', channel: 'digital' },

  // Folder Management
  { id: 'canva-list-folder-items', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'List Folder Items', description: 'List all items in a Canva folder', channel: ['print', 'digital', 'social'] },
  { id: 'canva-search-folders', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Search Folders', description: 'Search folders by name in the team workspace', channel: ['print', 'digital', 'social'] },
  { id: 'canva-create-folder', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Create Folder', description: 'Create a new folder in Canva for organizing designs', channel: ['print', 'digital', 'social'] },
  { id: 'canva-move-to-folder', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Move to Folder', description: 'Move a design into a specific folder', channel: ['print', 'digital', 'social'] },

  // Assets
  { id: 'canva-upload-asset', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Upload Asset', description: 'Upload an image or media asset to Canva library', channel: ['print', 'digital', 'social'] },

  // Brand
  { id: 'canva-list-brand-kits', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'List Brand Kits', description: 'List all brand kits with colors, fonts, and logos', channel: ['print', 'digital', 'social'] },

  // Comments & Collaboration
  { id: 'canva-list-comments', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'List Comments', description: 'List all comments on a design', channel: ['print', 'digital', 'social'] },
  { id: 'canva-comment-on-design', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Comment on Design', description: 'Add a comment to a design for review workflow', channel: ['print', 'digital', 'social'] },
  { id: 'canva-list-replies', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'List Replies', description: 'List replies to a specific comment thread', channel: ['print', 'digital', 'social'] },
  { id: 'canva-reply-to-comment', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Reply to Comment', description: 'Reply to a comment on a design', channel: ['print', 'digital', 'social'] },

  // Shortlinks
  { id: 'canva-resolve-shortlink', type: 'TOOL', domain: 'cmo', toolDomain: 'canva', name: 'Resolve Shortlink', description: 'Resolve a Canva shortlink to its full design URL', channel: ['print', 'digital', 'social'] },
]
