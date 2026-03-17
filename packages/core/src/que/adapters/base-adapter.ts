/**
 * QUE Adapter Base Types
 *
 * Defines the contract that all QUE source adapters must implement.
 * Adapters bridge the gap between QUE sessions and external quote sources
 * (carrier APIs, manual entry, Playwright automation, MCP tools).
 */

import type { QueQuote, QueAdapterType } from '../types'

// ============================================================================
// ADAPTER CONFIGURATION
// ============================================================================

export interface QueAdapterConfig {
  source_id: string
  adapter_type: QueAdapterType
  config: Record<string, unknown>
}

// ============================================================================
// ADAPTER RESULT
// ============================================================================

export interface QueAdapterResult {
  success: boolean
  quotes: Omit<QueQuote, 'quote_id' | 'session_id' | 'score' | 'rank'>[]
  error?: string
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

export interface QueAdapter {
  source_id: string
  adapter_type: QueAdapterType

  /**
   * Validate that the provided parameters are sufficient for quoting.
   * Returns null if valid, or a human-readable error string if invalid.
   */
  validate(params: Record<string, unknown>): string | null

  /**
   * Execute the quote request.
   * Returns structured results or an error.
   */
  quote(params: Record<string, unknown>): Promise<QueAdapterResult>
}
