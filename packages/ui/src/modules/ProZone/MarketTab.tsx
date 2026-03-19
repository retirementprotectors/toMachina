'use client'

import TerritoryBuilder from './TerritoryBuilder'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MarketTabProps {
  portal: string
}

// ---------------------------------------------------------------------------
// MarketTab — Surfaces TerritoryBuilder + ZIP Override UI inside MARKET tab
// ---------------------------------------------------------------------------

export default function MarketTab({ portal }: MarketTabProps) {
  return (
    <TerritoryBuilder portal={portal as 'prodashx' | 'riimo' | 'sentinel'} />
  )
}
