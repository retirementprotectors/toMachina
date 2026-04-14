/**
 * WIRE_MEDSUPP_QUOTE (TRK-EPIC-07)
 * Trigger: Medicare Supplement quote requested by user/agent.
 * Sequence: AEP blackout check -> quoteMedsupp super tool -> normalized quote list.
 *
 * HTTP boundary: CSG fetch happens at the API layer
 * (POST /api/medicare-quote/quotes). The wire executor passes the raw quote
 * results into this wire as `rawQuotes`.
 */

import {
  quoteMedsupp,
  type QuoteMedsuppInput,
  type RawCsgQuote,
  type QuoteMedsuppResult,
} from '../super-tools/quote-medsupp'

const AEP_END_DAY = 7

export function isAepBlackout(date: Date = new Date()): boolean {
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (m === 10 || m === 11) return true
  if (m === 12 && d <= AEP_END_DAY) return true
  return false
}

export interface MedsuppQuoteWireInput {
  quoteInput: QuoteMedsuppInput
  rawQuotes: RawCsgQuote[]
  /** Override blackout reference date for testing or backdated quotes */
  asOf?: Date
}

export interface MedsuppQuoteWireResult {
  success: boolean
  wire: 'WIRE_MEDSUPP_QUOTE'
  trigger: string
  blackout: boolean
  quoteResult?: QuoteMedsuppResult
  error?: string
}

export function wireMedsuppQuote(input: MedsuppQuoteWireInput): MedsuppQuoteWireResult {
  if (isAepBlackout(input.asOf)) {
    return {
      success: false,
      wire: 'WIRE_MEDSUPP_QUOTE',
      trigger: 'Medicare Supplement quote requested',
      blackout: true,
      error:
        'AEP Blackout active (Oct 1 - Dec 7). Medicare plan changes are not available during Annual Enrollment Period.',
    }
  }

  const quoteResult = quoteMedsupp(input.quoteInput, input.rawQuotes)

  return {
    success: quoteResult.success,
    wire: 'WIRE_MEDSUPP_QUOTE',
    trigger: 'Medicare Supplement quote requested',
    blackout: false,
    quoteResult,
    error: quoteResult.error,
  }
}
