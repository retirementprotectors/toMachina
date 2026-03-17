/**
 * Playwright Adapter (Placeholder)
 *
 * Will automate carrier portal quoting via browser automation.
 * Not yet implemented — returns a clear error directing users to manual entry.
 */

import type { QueAdapterType } from '../types'
import type { QueAdapter, QueAdapterResult } from './base-adapter'

export class PlaywrightAdapter implements QueAdapter {
  source_id = 'QSRC_PLAYWRIGHT'
  adapter_type: QueAdapterType = 'playwright'

  /**
   * Placeholder — always returns valid (null) since we can't validate
   * carrier-specific form requirements until automation is built.
   */
  validate(_params: Record<string, unknown>): string | null {
    return null
  }

  /**
   * Placeholder — not yet implemented.
   */
  async quote(_params: Record<string, unknown>): Promise<QueAdapterResult> {
    return {
      success: false,
      quotes: [],
      error: 'Playwright automation not yet implemented. Use manual entry.',
    }
  }
}
