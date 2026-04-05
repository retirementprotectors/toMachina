/**
 * WordPress MCP Tools (MUS-C04)
 * 17 tools from rpi-workspace MCP — content management, Elementor, media
 */
import type { CmoRegistryEntry } from '../types'

export const WORDPRESS_TOOLS: CmoRegistryEntry[] = [
  // Posts CRUD
  { id: 'wordpress-list-posts', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'List Posts', description: 'List all WordPress blog posts with filters', channel: 'web' },
  { id: 'wordpress-get-post', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Get Post', description: 'Retrieve a single post by ID with full content', channel: 'web' },
  { id: 'wordpress-create-post', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Create Post', description: 'Create a new blog post (draft or published)', channel: 'web' },
  { id: 'wordpress-update-post', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Update Post', description: 'Update post content, status, or metadata', channel: 'web' },
  { id: 'wordpress-delete-post', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Delete Post', description: 'Move a post to trash', channel: 'web' },

  // Pages CRUD
  { id: 'wordpress-list-pages', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'List Pages', description: 'List all WordPress pages', channel: 'web' },
  { id: 'wordpress-create-page', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Create Page', description: 'Create a new page (landing pages, service pages)', channel: 'web' },
  { id: 'wordpress-update-page', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Update Page', description: 'Update page content or publish status', channel: 'web' },
  { id: 'wordpress-delete-page', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Delete Page', description: 'Move a page to trash', channel: 'web' },

  // Categories & Media
  { id: 'wordpress-list-categories', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'List Categories', description: 'List all post categories for content taxonomy', channel: 'web' },
  { id: 'wordpress-list-media', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'List Media', description: 'List media library items (images, PDFs, videos)', channel: 'web' },
  { id: 'wordpress-upload-media', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Upload Media', description: 'Upload images, PDFs, or other media to the library', channel: 'web' },

  // Site & Users
  { id: 'wordpress-get-user', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Get User', description: 'Retrieve WordPress user profile by ID', channel: 'web' },
  { id: 'wordpress-site-info', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Site Info', description: 'Get WordPress site metadata (title, URL, version)', channel: 'web' },

  // Elementor (layout editing — not just CRUD)
  { id: 'wordpress-get-elementor-data', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Get Elementor Data', description: 'Retrieve Elementor page builder JSON data for a page — the layout structure, widgets, and styling', channel: 'web' },
  { id: 'wordpress-update-elementor-element', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Update Elementor Element', description: 'Modify a specific Elementor widget/element — text, images, buttons, sections. Surgical layout editing.', channel: 'web' },
  { id: 'wordpress-find-elementor-buttons', type: 'TOOL', domain: 'cmo', toolDomain: 'wordpress', name: 'Find Elementor Buttons', description: 'Search for button elements across Elementor pages — useful for CTA audits and link updates', channel: 'web' },
]
