/**
 * Veo Video Tools (MUS-C05)
 * 5 tools from rpi-workspace MCP — AI video generation and management
 */
import type { CmoRegistryEntry } from '../types'

export const VEO_TOOLS: CmoRegistryEntry[] = [
  { id: 'veo-generate-video', type: 'TOOL', domain: 'cmo', toolDomain: 'veo', name: 'Generate Video', description: 'Generate a video from a text prompt using Google Veo AI', channel: ['video', 'social'] },
  { id: 'veo-generate-video-from-image', type: 'TOOL', domain: 'cmo', toolDomain: 'veo', name: 'Generate Video from Image', description: 'Generate a video using an image as the starting frame', channel: ['video', 'social'] },
  { id: 'veo-check-video-status', type: 'TOOL', domain: 'cmo', toolDomain: 'veo', name: 'Check Video Status', description: 'Check the generation status of a pending video job', channel: 'video' },
  { id: 'veo-download-video', type: 'TOOL', domain: 'cmo', toolDomain: 'veo', name: 'Download Video', description: 'Download a completed generated video', channel: 'video' },
  { id: 'veo-list-video-models', type: 'TOOL', domain: 'cmo', toolDomain: 'veo', name: 'List Video Models', description: 'List available Veo video generation models and capabilities', channel: 'video' },
]
