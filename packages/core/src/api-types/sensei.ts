/**
 * SENSEI Analytics API types — TRK-14146
 *
 * Shared DTOs for the SENSEI heat map + analytics endpoints.
 * Tracks three event sources: RAIDEN TRAIN responses, VOLTRON SENSEI queries,
 * and SENSEI Mode popup views. Aggregates by module for the FORGE dashboard.
 */

// ---------------------------------------------------------------------------
// SENSEI Content (TRK-SNS-001) — training content per module
// ---------------------------------------------------------------------------

/** Template types for training content generation. */
export type SenseiTemplateType = 'workflow' | 'ui' | 'feat'

/** A single SENSEI content entry — one per module. */
export interface SenseiContent {
  module_id: string
  title: string
  description: string
  screenshot_urls: string[]
  stats_query?: string
  template_type: SenseiTemplateType
  role_filter?: string[]
  last_generated?: string
  version: number
  created_at: string
  updated_at: string
}

/** POST body for creating/updating sensei content. */
export interface SenseiContentBody {
  module_id: string
  title: string
  description: string
  screenshot_urls?: string[]
  stats_query?: string
  template_type: SenseiTemplateType
  role_filter?: string[]
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** The three event sources tracked by SENSEI analytics. */
export type SenseiEventType = 'train_response' | 'voltron_query' | 'popup_view'

/** A single analytics event logged to Firestore. */
export interface SenseiAnalyticsEvent {
  event_id: string
  event_type: SenseiEventType
  module_id: string
  module_label: string
  user_id: string
  user_email?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// ---------------------------------------------------------------------------
// Aggregation / heatmap
// ---------------------------------------------------------------------------

/** Per-module breakdown returned by the heatmap endpoint. */
export interface SenseiModuleHeatmapRow {
  module_id: string
  module_label: string
  total: number
  train_response: number
  voltron_query: number
  popup_view: number
}

/** Full heatmap response payload. */
export interface SenseiHeatmapDTO {
  period: '7d' | '30d' | '90d'
  modules: SenseiModuleHeatmapRow[]
}

// ---------------------------------------------------------------------------
// Top-10
// ---------------------------------------------------------------------------

/** Ranked module entry returned by the top endpoint. */
export interface SenseiTopModuleRow {
  rank: number
  module_id: string
  module_label: string
  total: number
  train_response: number
  voltron_query: number
  popup_view: number
}

/** Top-10 response payload. */
export interface SenseiTopDTO {
  period: '7d' | '30d' | '90d'
  modules: SenseiTopModuleRow[]
}

// ---------------------------------------------------------------------------
// Log request body
// ---------------------------------------------------------------------------

/** POST body for logging a single event. */
export interface SenseiLogBody {
  event_type: SenseiEventType
  module_id: string
  module_label: string
  user_id: string
  user_email?: string
  metadata?: Record<string, unknown>
}
