// services/api/src/lib/db.ts — Tenant-aware Firestore accessor
// ZRD-PLAT-MT-001 | Multi-Tenant Firestore Architecture
//
// Single entrypoint for all server-side Firestore access in the API.
// Replaces direct `getFirestore()` calls with a tenant-aware `getDb(partnerId?)`
// so that partner users' requests route to their named Firestore database
// (`partner-<slug>`) and RPI / shared-catalog requests stay on `(default)`.
//
// Usage:
//   import { getDb } from '../lib/db.js'
//   const db = getDb(req.partnerId)                     // tenant-scoped
//   const catalog = getDb()                             // shared catalog only
//
// Physical isolation is enforced by Firestore itself — one DB per tenant.
// A bug in a query can never cross tenants; it errors, it doesn't leak.

import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getApp } from 'firebase-admin/app'

// ─── Connection cache ──────────────────────────────────────────────────────────
// firebase-admin's getFirestore(app, dbId) is cheap on second call, but we
// keep an explicit cache so the shape is obvious and so future instrumentation
// (e.g. per-DB metrics, per-DB connection limits) has one place to live.
const DB_CACHE = new Map<string, Firestore>()

const DEFAULT_DB_ID = '(default)'

/**
 * Normalize a partner slug into the named database id used by GCP Firestore.
 * Slugs are lowercase, hyphen-separated, URL-safe — matches `partner_registry` doc ids.
 * Returns `(default)` when no partnerId is passed — RPI + shared catalogs.
 */
export function partnerDbId(partnerId?: string | null): string {
  if (!partnerId) return DEFAULT_DB_ID
  return `partner-${partnerId}`
}

/**
 * Tenant-aware Firestore accessor.
 *
 * - `getDb()` / `getDb(null)` / `getDb(undefined)` → `(default)` database
 *   (RPI data + shared catalogs: carriers, products, campaigns, users,
 *   partner_registry, atlas registries, tracker_items, etc.)
 *
 * - `getDb('midwest-medigap')` → `partner-midwest-medigap` named database
 *   (partner's isolated tenant data: clients, accounts, revenue, etc.)
 *
 * API route handlers should call `getDb(req.partnerId)` — the auth middleware
 * (MT-002) attaches `req.partnerId` from the verified Firebase ID token's
 * custom claim. RPI users have `req.partnerId === null` and transparently
 * hit the default DB; partner users route to their tenant DB automatically.
 *
 * Shared-catalog routes (carriers, products, campaigns, atlas, admin-*) should
 * explicitly call `getDb()` with no argument to make intent obvious and prevent
 * a future refactor from accidentally passing `req.partnerId` into them.
 */
export function getDb(partnerId?: string | null): Firestore {
  const dbId = partnerDbId(partnerId)
  const cached = DB_CACHE.get(dbId)
  if (cached) return cached

  const app = getApp()
  const db = dbId === DEFAULT_DB_ID ? getFirestore(app) : getFirestore(app, dbId)
  DB_CACHE.set(dbId, db)
  return db
}

/**
 * Explicit shared-catalog accessor. Identical to `getDb()` with no args.
 * Use this in routes that must always hit the default DB regardless of caller
 * tenancy (carriers, products, campaigns, atlas, partner_registry, etc.).
 * Reads as documentation: "this route is a shared-catalog read."
 */
export function getDefaultDb(): Firestore {
  return getDb()
}

/**
 * Test-only: clear the connection cache. Integration tests reuse the same
 * process across multiple admin app lifecycles. Not exported from index.
 */
export function __resetDbCacheForTests(): void {
  DB_CACHE.clear()
}
