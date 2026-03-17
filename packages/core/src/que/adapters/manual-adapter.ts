/**
 * Manual Entry Adapter
 *
 * Wraps manually entered quote data into the QueQuote format.
 * Used when an advisor enters carrier quote details by hand
 * (from a carrier portal, printed illustration, or phone quote).
 */

import type { QueAdapterType } from '../types'
import type { QueAdapter, QueAdapterResult } from './base-adapter'

export class ManualEntryAdapter implements QueAdapter {
  source_id = 'QSRC_MANUAL'
  adapter_type: QueAdapterType = 'manual'

  /**
   * Validate that manually entered data has the minimum required fields:
   * carrier_name, product_name, and at least one premium field.
   */
  validate(params: Record<string, unknown>): string | null {
    const errors: string[] = []

    if (!params['carrier_name'] || typeof params['carrier_name'] !== 'string') {
      errors.push('carrier_name is required')
    }

    if (!params['product_name'] || typeof params['product_name'] !== 'string') {
      errors.push('product_name is required')
    }

    const hasMonthly =
      typeof params['premium_monthly'] === 'number' && params['premium_monthly'] > 0
    const hasAnnual =
      typeof params['premium_annual'] === 'number' && params['premium_annual'] > 0
    const hasSingle =
      typeof params['premium_single'] === 'number' && params['premium_single'] > 0

    if (!hasMonthly && !hasAnnual && !hasSingle) {
      errors.push('At least one premium field is required (premium_monthly, premium_annual, or premium_single)')
    }

    return errors.length > 0 ? errors.join('; ') : null
  }

  /**
   * Wrap manually entered data into a QueQuote-shaped result.
   * No async work needed — this is a synchronous transform.
   */
  async quote(params: Record<string, unknown>): Promise<QueAdapterResult> {
    const validationError = this.validate(params)
    if (validationError) {
      return { success: false, quotes: [], error: validationError }
    }

    const carrierName = params['carrier_name'] as string
    const productName = params['product_name'] as string

    // Extract known fields; everything else goes into details
    const knownFields = new Set([
      'carrier_name',
      'product_name',
      'carrier_id',
      'source_id',
      'premium_monthly',
      'premium_annual',
      'premium_single',
      'flags',
    ])

    const details: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (!knownFields.has(key)) {
        details[key] = value
      }
    }

    const flags = Array.isArray(params['flags'])
      ? (params['flags'] as string[])
      : ['manual_entry']

    return {
      success: true,
      quotes: [
        {
          source_id: typeof params['source_id'] === 'string'
            ? params['source_id']
            : 'QSRC_MANUAL',
          carrier_id: typeof params['carrier_id'] === 'string'
            ? params['carrier_id']
            : undefined,
          carrier_name: carrierName,
          product_name: productName,
          premium_monthly:
            typeof params['premium_monthly'] === 'number'
              ? params['premium_monthly']
              : undefined,
          premium_annual:
            typeof params['premium_annual'] === 'number'
              ? params['premium_annual']
              : undefined,
          premium_single:
            typeof params['premium_single'] === 'number'
              ? params['premium_single']
              : undefined,
          details,
          flags,
          fetched_at: new Date().toISOString(),
        },
      ],
    }
  }
}
