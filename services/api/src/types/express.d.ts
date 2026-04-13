// services/api/src/types/express.d.ts — Express Request augmentation
// ZRD-PLAT-MT-002 | Multi-Tenant Firestore Architecture
//
// Adds `req.partnerId` (string | null) — attached by the auth middleware
// from the verified Firebase ID token's `partner_id` custom claim.
//
// - RPI users → `null` (route to `(default)` Firestore database)
// - Partner users → their slug (route to `partner-<slug>` named database)
// - Used by `getDb(req.partnerId)` in route handlers.
//
// Also surfaces the auth-enriched `user` object we already attach to the
// request in `middleware/auth.ts`, for type-safe access in route handlers.

import type { DecodedIdToken } from 'firebase-admin/auth'

declare global {
  namespace Express {
    interface Request {
      /**
       * Partner slug from the verified ID token's `partner_id` custom claim.
       * `null` for RPI users (no partner claim) and unauthenticated contexts.
       * Downstream: passed to `getDb(req.partnerId)` for tenant routing.
       */
      partnerId?: string | null

      /**
       * Auth-enriched user attached by `requireAuth`. Superset of the
       * decoded Firebase token plus Firestore user-profile fields.
       */
      user?: DecodedIdToken & {
        level: number
        user_level: string
        role_template?: string
        module_permissions?: Record<string, string[]>
      }
    }
  }
}

export {}
