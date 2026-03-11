/**
 * Fuzzy string matching using Levenshtein distance.
 * Ported from CORE_Match.gs fuzzyMatch(), levenshteinDistance(), isSimilar().
 */

/**
 * Calculate Levenshtein distance between two strings.
 * Classic DP approach -- port matches GAS source exactly.
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return dp[m][n]
}

/**
 * Fuzzy string matching -- returns 0-100 similarity score.
 * Ported from CORE_Match.gs fuzzyMatch().
 */
export function fuzzyMatch(str1: string | undefined | null, str2: string | undefined | null): number {
  if (!str1 || !str2) return 0

  const s1 = String(str1).toLowerCase().trim()
  const s2 = String(str2).toLowerCase().trim()

  if (s1 === s2) return 100
  if (s1.length === 0 || s2.length === 0) return 0

  const distance = levenshteinDistance(s1, s2)
  const maxLen = Math.max(s1.length, s2.length)

  return Math.round((1 - distance / maxLen) * 100)
}

/**
 * Check if strings are similar enough (shorthand).
 * Ported from CORE_Match.gs isSimilar().
 */
export function isSimilar(str1: string, str2: string, threshold = 80): boolean {
  return fuzzyMatch(str1, str2) >= threshold
}
