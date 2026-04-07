/** Life carrier product specs — 12 carriers */

export interface LifeCarrierProduct {
  carrier: string
  carrierKey: string
  products: Array<{
    type: 'term' | 'ul' | 'iul' | 'wl'
    name: string
    minFace: number
    maxFace: number
    minAge: number
    maxAge: number
    features: string[]
  }>
}

const LIFE_CARRIER_PRODUCTS: LifeCarrierProduct[] = [
  { carrier: 'Catholic Order of Foresters', carrierKey: 'COF', products: [
    { type: 'wl', name: 'Whole Life', minFace: 10000, maxFace: 500000, minAge: 0, maxAge: 85, features: ['fraternal benefits', 'dividends'] },
    { type: 'term', name: 'Term to 80', minFace: 25000, maxFace: 500000, minAge: 18, maxAge: 70, features: ['convertible'] },
  ]},
  { carrier: 'John Hancock', carrierKey: 'JH', products: [
    { type: 'term', name: 'Term 10/20/30', minFace: 100000, maxFace: 10000000, minAge: 18, maxAge: 80, features: ['convertible', 'vitality discount'] },
    { type: 'iul', name: 'Accumulation IUL', minFace: 50000, maxFace: 10000000, minAge: 0, maxAge: 85, features: ['index options', 'chronic illness rider'] },
    { type: 'ul', name: 'Protection UL', minFace: 100000, maxFace: 10000000, minAge: 18, maxAge: 85, features: ['no-lapse guarantee'] },
  ]},
  { carrier: 'Mutual of Omaha', carrierKey: 'MOO', products: [
    { type: 'term', name: 'Term Life Express', minFace: 25000, maxFace: 500000, minAge: 18, maxAge: 75, features: ['simplified issue', 'no exam'] },
    { type: 'wl', name: 'Living Promise', minFace: 2000, maxFace: 40000, minAge: 45, maxAge: 85, features: ['guaranteed issue', 'final expense'] },
    { type: 'iul', name: 'Income Advantage IUL', minFace: 50000, maxFace: 5000000, minAge: 0, maxAge: 80, features: ['income rider', 'chronic illness'] },
  ]},
  { carrier: 'AIG', carrierKey: 'AIG', products: [
    { type: 'term', name: 'Select-a-Term', minFace: 100000, maxFace: 10000000, minAge: 18, maxAge: 75, features: ['convertible', 'accelerated death benefit'] },
    { type: 'iul', name: 'Max Accumulator+', minFace: 25000, maxFace: 10000000, minAge: 0, maxAge: 80, features: ['uncapped index', 'multiplier bonus'] },
  ]},
  { carrier: 'Allianz', carrierKey: 'ALZ', products: [
    { type: 'iul', name: 'Life Pro+ Advantage', minFace: 50000, maxFace: 10000000, minAge: 0, maxAge: 80, features: ['index lock', 'chronic illness rider'] },
  ]},
  { carrier: 'F&G', carrierKey: 'FG', products: [
    { type: 'iul', name: 'ADV IUL', minFace: 50000, maxFace: 5000000, minAge: 18, maxAge: 80, features: ['accumulation focused', 'bonus credits'] },
    { type: 'term', name: 'F&G Term', minFace: 100000, maxFace: 2000000, minAge: 18, maxAge: 70, features: ['convertible'] },
  ]},
  { carrier: 'Kansas City Life', carrierKey: 'KCL', products: [
    { type: 'wl', name: 'Whole Life 100', minFace: 10000, maxFace: 1000000, minAge: 0, maxAge: 80, features: ['paid-up additions', 'dividends'] },
    { type: 'term', name: 'Term 10/20', minFace: 50000, maxFace: 2000000, minAge: 18, maxAge: 70, features: ['convertible'] },
  ]},
  { carrier: 'Lincoln Financial', carrierKey: 'LFG', products: [
    { type: 'term', name: 'TermAccel', minFace: 100000, maxFace: 10000000, minAge: 18, maxAge: 70, features: ['accelerated underwriting', 'convertible'] },
    { type: 'iul', name: 'WealthAccumulate IUL', minFace: 50000, maxFace: 10000000, minAge: 0, maxAge: 85, features: ['multiplier', 'chronic illness rider'] },
    { type: 'ul', name: 'LifeElements UL', minFace: 100000, maxFace: 10000000, minAge: 18, maxAge: 85, features: ['flexible premiums', 'no-lapse guarantee'] },
  ]},
  { carrier: 'North American', carrierKey: 'NAC', products: [
    { type: 'iul', name: 'Builder Plus IUL', minFace: 50000, maxFace: 5000000, minAge: 0, maxAge: 80, features: ['income rider', 'chronic illness', 'bonus'] },
  ]},
  { carrier: 'Nationwide', carrierKey: 'NWF', products: [
    { type: 'term', name: 'YourLife Term', minFace: 100000, maxFace: 5000000, minAge: 18, maxAge: 70, features: ['convertible', 'child rider'] },
    { type: 'iul', name: 'IUL Accumulator II', minFace: 50000, maxFace: 10000000, minAge: 0, maxAge: 80, features: ['uncapped options', 'overloan protection'] },
    { type: 'wl', name: 'Whole Life 121', minFace: 25000, maxFace: 2000000, minAge: 0, maxAge: 75, features: ['dividends', 'paid-up additions'] },
  ]},
  { carrier: 'Protective', carrierKey: 'PRO', products: [
    { type: 'term', name: 'Classic Choice Term', minFace: 100000, maxFace: 10000000, minAge: 18, maxAge: 70, features: ['convertible', 'competitive rates'] },
    { type: 'iul', name: 'Indexed Choice UL', minFace: 50000, maxFace: 10000000, minAge: 18, maxAge: 80, features: ['chronic illness rider'] },
  ]},
  { carrier: 'Symetra', carrierKey: 'SYM', products: [
    { type: 'term', name: 'Rapid Term', minFace: 100000, maxFace: 5000000, minAge: 18, maxAge: 65, features: ['accelerated UW', 'convertible'] },
    { type: 'iul', name: 'Accumulator Plus IUL', minFace: 50000, maxFace: 5000000, minAge: 0, maxAge: 80, features: ['accumulation focused', 'chronic illness'] },
  ]},
]

export function findLifeCarrierProduct(carrierKey: string, productType?: string): LifeCarrierProduct | undefined {
  const carrier = LIFE_CARRIER_PRODUCTS.find(c => c.carrierKey === carrierKey)
  if (!carrier) return undefined
  if (!productType) return carrier
  return {
    ...carrier,
    products: carrier.products.filter(p => p.type === productType),
  }
}

export function getAllLifeCarriers(): LifeCarrierProduct[] {
  return LIFE_CARRIER_PRODUCTS
}
