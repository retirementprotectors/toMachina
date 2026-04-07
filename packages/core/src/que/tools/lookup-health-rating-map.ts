/** lookup-health-rating-map — Health condition to rate class */
import type { HealthRating } from './data/health-rating-map'
import { findHealthRating } from './data/health-rating-map'

export function lookupHealthRatingMap(condition: string): HealthRating | undefined {
  return findHealthRating(condition)
}
