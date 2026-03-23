export { levenshteinDistance, fuzzyMatch, isSimilar } from './fuzzy'
export {
  calculateNameScore,
  calculateMatchScore,
  matchClient,
  matchAccount,
  matchAgent,
  findDuplicates,
  batchMatch,
  DEFAULT_DEDUP_THRESHOLDS,
} from './dedup'
export type {
  DedupThresholds,
  MatchResult,
  AccountMatchResult,
  DuplicatePair,
  BatchMatchResults,
} from './dedup'
