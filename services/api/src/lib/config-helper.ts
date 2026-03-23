/**
 * Config Registry Helper — reads platform configs from Firestore with TTL cache.
 *
 * Usage:
 *   import { getConfig, invalidateConfig } from '../lib/config-helper.js'
 *   const thresholds = await getConfig('dedup_thresholds', DEFAULT_THRESHOLDS)
 *
 * Cache: 60-second TTL per key. PUT /api/config/:key calls invalidateConfig().
 */

import { getFirestore } from 'firebase-admin/firestore'

const COLLECTION = 'config_registry'
const CACHE_TTL_MS = 60_000

interface CacheEntry<T> {
  data: T
  expires: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>()

/**
 * Read a config from Firestore with in-memory TTL cache.
 * Returns fallback if Firestore is unavailable or doc doesn't exist.
 */
export async function getConfig<T>(key: string, fallback: T): Promise<T> {
  // Check cache first
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expires) {
    return cached.data as T
  }

  try {
    const db = getFirestore()
    const doc = await db.collection(COLLECTION).doc(key).get()
    if (doc.exists) {
      const data = doc.data() as T
      cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
      return data
    }
  } catch {
    // Firestore unavailable — use fallback
  }

  return fallback
}

/** Invalidate a single config key's cache (called after PUT). */
export function invalidateConfig(key: string): void {
  cache.delete(key)
}

/** Invalidate all cached configs. */
export function invalidateAllConfigs(): void {
  cache.clear()
}
