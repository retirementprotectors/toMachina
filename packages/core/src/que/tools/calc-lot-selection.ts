/**
 * calc-lot-selection
 * Optimal tax lot selection for liquidation.
 *
 * NQ Strategy: Sort by gain%, sell lowest gain first (losses => smallest gains)
 *              until target amount reached. Minimizes tax.
 * IRA Strategy: Sort by gain% but sell underperformers first to preserve winners.
 *              Tax is identical (all ordinary income), so optimize portfolio quality.
 *
 * Source: Tax Harvesting templates
 */

import type { CalcResult, CalcLotSelectionInput, CalcLotSelectionResult, SelectedLot, TaxLot } from './types'

function calculateGainPercent(lot: TaxLot): number {
  if (lot.costBasis === 0) return lot.marketValue > 0 ? Infinity : 0
  return (lot.marketValue - lot.costBasis) / lot.costBasis
}

export function calcLotSelection(input: CalcLotSelectionInput): CalcResult<CalcLotSelectionResult> {
  const { lots, targetAmount, strategy = 'nq' } = input

  // Sort lots by gain percentage
  const sortedLots = [...lots].sort((a, b) => {
    const gainA = calculateGainPercent(a)
    const gainB = calculateGainPercent(b)
    // NQ: sell lowest gain first (minimize tax)
    // IRA: sell lowest gain first (underperformers, preserve winners)
    return gainA - gainB
  })

  const selectedLots: SelectedLot[] = []
  let remainingTarget = targetAmount
  let totalProceeds = 0
  let totalGain = 0
  let totalTax = 0

  for (const lot of sortedLots) {
    if (remainingTarget <= 0) break

    const gain = lot.marketValue - lot.costBasis
    const gainPercent = calculateGainPercent(lot)

    if (lot.marketValue <= remainingTarget) {
      // Sell entire lot
      const lotTax = strategy === 'nq'
        ? Math.max(0, Math.round(gain * 0.15 * 100) / 100) // LTCG rate
        : 0 // IRA: no per-lot tax (all ordinary income on distribution)

      selectedLots.push({
        ...lot,
        gain: Math.round(gain * 100) / 100,
        gainPercent: Math.round(gainPercent * 10000) / 100,
        sellAmount: lot.marketValue,
        estimatedTax: lotTax,
      })

      remainingTarget -= lot.marketValue
      totalProceeds += lot.marketValue
      totalGain += Math.max(0, gain)
      totalTax += lotTax
    } else {
      // Partial lot sale
      const sellRatio = remainingTarget / lot.marketValue
      const partialBasis = lot.costBasis * sellRatio
      const partialGain = remainingTarget - partialBasis
      const lotTax = strategy === 'nq'
        ? Math.max(0, Math.round(partialGain * 0.15 * 100) / 100)
        : 0

      selectedLots.push({
        ...lot,
        gain: Math.round(partialGain * 100) / 100,
        gainPercent: Math.round(gainPercent * 10000) / 100,
        sellAmount: Math.round(remainingTarget * 100) / 100,
        estimatedTax: lotTax,
      })

      totalProceeds += remainingTarget
      totalGain += Math.max(0, partialGain)
      totalTax += lotTax
      remainingTarget = 0
    }
  }

  totalProceeds = Math.round(totalProceeds * 100) / 100
  totalGain = Math.round(totalGain * 100) / 100
  totalTax = Math.round(totalTax * 100) / 100
  const shortfall = Math.max(0, Math.round(remainingTarget * 100) / 100)
  const effectiveTaxRate = totalProceeds > 0
    ? Math.round((totalTax / totalProceeds) * 10000) / 100
    : 0

  const notes: string[] = []
  if (shortfall > 0) {
    notes.push(`Target not fully met: $${shortfall.toLocaleString()} shortfall`)
  }

  return {
    value: { selectedLots, totalProceeds, totalGain, totalTax, effectiveTaxRate, shortfall },
    breakdown: { targetAmount, totalProceeds, totalGain, totalTax, shortfall },
    notes: notes.length > 0 ? notes : undefined,
  }
}
