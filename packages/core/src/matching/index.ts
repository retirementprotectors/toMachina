export { levenshteinDistance, fuzzyMatch, isSimilar } from './fuzzy'
export {
  calculateNameScore,
  calculateMatchScore,
  matchClient,
  matchAccount,
  matchAgent,
  findDuplicates,
  batchMatch,
} from './dedup'
export type {
  MatchResult,
  AccountMatchResult,
  DuplicatePair,
  BatchMatchResults,
} from './dedup'
