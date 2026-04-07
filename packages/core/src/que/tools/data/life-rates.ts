/** Life insurance premium lookup tables */

export interface LifeRateEntry {
  productType: 'term10' | 'term20' | 'term30' | 'ul' | 'iul' | 'wl'
  healthClass: 'preferred-plus' | 'preferred' | 'standard' | 'table-1' | 'table-2'
  ageMin: number
  ageMax: number
  faceMin: number
  faceMax: number
  annualPer1000: number
}

const LIFE_RATES: LifeRateEntry[] = [
  // Term 10 — Preferred Plus
  { productType: 'term10', healthClass: 'preferred-plus', ageMin: 25, ageMax: 34, faceMin: 100000, faceMax: 999999, annualPer1000: 0.55 },
  { productType: 'term10', healthClass: 'preferred-plus', ageMin: 35, ageMax: 44, faceMin: 100000, faceMax: 999999, annualPer1000: 0.72 },
  { productType: 'term10', healthClass: 'preferred-plus', ageMin: 45, ageMax: 54, faceMin: 100000, faceMax: 999999, annualPer1000: 1.45 },
  { productType: 'term10', healthClass: 'preferred-plus', ageMin: 55, ageMax: 64, faceMin: 100000, faceMax: 999999, annualPer1000: 3.20 },
  { productType: 'term10', healthClass: 'preferred-plus', ageMin: 65, ageMax: 75, faceMin: 100000, faceMax: 999999, annualPer1000: 8.50 },
  // Term 20 — Preferred Plus
  { productType: 'term20', healthClass: 'preferred-plus', ageMin: 25, ageMax: 34, faceMin: 100000, faceMax: 999999, annualPer1000: 0.75 },
  { productType: 'term20', healthClass: 'preferred-plus', ageMin: 35, ageMax: 44, faceMin: 100000, faceMax: 999999, annualPer1000: 1.05 },
  { productType: 'term20', healthClass: 'preferred-plus', ageMin: 45, ageMax: 54, faceMin: 100000, faceMax: 999999, annualPer1000: 2.10 },
  { productType: 'term20', healthClass: 'preferred-plus', ageMin: 55, ageMax: 64, faceMin: 100000, faceMax: 999999, annualPer1000: 5.80 },
  // Term 20 — Preferred
  { productType: 'term20', healthClass: 'preferred', ageMin: 25, ageMax: 34, faceMin: 100000, faceMax: 999999, annualPer1000: 0.95 },
  { productType: 'term20', healthClass: 'preferred', ageMin: 35, ageMax: 44, faceMin: 100000, faceMax: 999999, annualPer1000: 1.35 },
  { productType: 'term20', healthClass: 'preferred', ageMin: 45, ageMax: 54, faceMin: 100000, faceMax: 999999, annualPer1000: 2.80 },
  { productType: 'term20', healthClass: 'preferred', ageMin: 55, ageMax: 64, faceMin: 100000, faceMax: 999999, annualPer1000: 7.50 },
  // Term 20 — Standard
  { productType: 'term20', healthClass: 'standard', ageMin: 25, ageMax: 34, faceMin: 100000, faceMax: 999999, annualPer1000: 1.40 },
  { productType: 'term20', healthClass: 'standard', ageMin: 35, ageMax: 44, faceMin: 100000, faceMax: 999999, annualPer1000: 2.10 },
  { productType: 'term20', healthClass: 'standard', ageMin: 45, ageMax: 54, faceMin: 100000, faceMax: 999999, annualPer1000: 4.50 },
  { productType: 'term20', healthClass: 'standard', ageMin: 55, ageMax: 64, faceMin: 100000, faceMax: 999999, annualPer1000: 12.00 },
  // Term 20 — Table 1
  { productType: 'term20', healthClass: 'table-1', ageMin: 25, ageMax: 34, faceMin: 100000, faceMax: 999999, annualPer1000: 1.75 },
  { productType: 'term20', healthClass: 'table-1', ageMin: 35, ageMax: 44, faceMin: 100000, faceMax: 999999, annualPer1000: 2.65 },
  { productType: 'term20', healthClass: 'table-1', ageMin: 45, ageMax: 54, faceMin: 100000, faceMax: 999999, annualPer1000: 5.65 },
  { productType: 'term20', healthClass: 'table-1', ageMin: 55, ageMax: 64, faceMin: 100000, faceMax: 999999, annualPer1000: 15.00 },
  // IUL (target premium basis)
  { productType: 'iul', healthClass: 'preferred-plus', ageMin: 25, ageMax: 34, faceMin: 50000, faceMax: 9999999, annualPer1000: 3.50 },
  { productType: 'iul', healthClass: 'preferred-plus', ageMin: 35, ageMax: 44, faceMin: 50000, faceMax: 9999999, annualPer1000: 5.20 },
  { productType: 'iul', healthClass: 'preferred-plus', ageMin: 45, ageMax: 54, faceMin: 50000, faceMax: 9999999, annualPer1000: 8.50 },
  { productType: 'iul', healthClass: 'preferred-plus', ageMin: 55, ageMax: 64, faceMin: 50000, faceMax: 9999999, annualPer1000: 15.00 },
  { productType: 'iul', healthClass: 'standard', ageMin: 25, ageMax: 34, faceMin: 50000, faceMax: 9999999, annualPer1000: 5.25 },
  { productType: 'iul', healthClass: 'standard', ageMin: 35, ageMax: 44, faceMin: 50000, faceMax: 9999999, annualPer1000: 7.80 },
  { productType: 'iul', healthClass: 'standard', ageMin: 45, ageMax: 54, faceMin: 50000, faceMax: 9999999, annualPer1000: 12.75 },
  { productType: 'iul', healthClass: 'standard', ageMin: 55, ageMax: 64, faceMin: 50000, faceMax: 9999999, annualPer1000: 22.50 },
  // Whole Life
  { productType: 'wl', healthClass: 'preferred-plus', ageMin: 25, ageMax: 34, faceMin: 10000, faceMax: 9999999, annualPer1000: 8.00 },
  { productType: 'wl', healthClass: 'preferred-plus', ageMin: 35, ageMax: 44, faceMin: 10000, faceMax: 9999999, annualPer1000: 12.00 },
  { productType: 'wl', healthClass: 'preferred-plus', ageMin: 45, ageMax: 54, faceMin: 10000, faceMax: 9999999, annualPer1000: 18.50 },
  { productType: 'wl', healthClass: 'preferred-plus', ageMin: 55, ageMax: 64, faceMin: 10000, faceMax: 9999999, annualPer1000: 28.00 },
  { productType: 'wl', healthClass: 'standard', ageMin: 25, ageMax: 34, faceMin: 10000, faceMax: 9999999, annualPer1000: 12.00 },
  { productType: 'wl', healthClass: 'standard', ageMin: 35, ageMax: 44, faceMin: 10000, faceMax: 9999999, annualPer1000: 18.00 },
  { productType: 'wl', healthClass: 'standard', ageMin: 45, ageMax: 54, faceMin: 10000, faceMax: 9999999, annualPer1000: 27.75 },
  { productType: 'wl', healthClass: 'standard', ageMin: 55, ageMax: 64, faceMin: 10000, faceMax: 9999999, annualPer1000: 42.00 },
]

export function findLifeRate(productType: string, healthClass: string, age: number, faceAmount: number): LifeRateEntry | undefined {
  return LIFE_RATES.find(r =>
    r.productType === productType &&
    r.healthClass === healthClass &&
    age >= r.ageMin && age <= r.ageMax &&
    faceAmount >= r.faceMin && faceAmount <= r.faceMax
  )
}
