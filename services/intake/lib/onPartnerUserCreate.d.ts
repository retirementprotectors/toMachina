/**
 * MT-007 — onPartnerUserCreate Cloud Function
 *
 * Firebase Auth onCreate trigger. Assigns custom claims to every new user
 * based on their email domain:
 *
 *  1. Super-admin allowlist (SUPERADMIN_EMAILS env var, comma-separated)
 *     → { role: 'superadmin' }
 *
 *  2. @retireprotected.com domain
 *     → { role: 'rpi' }
 *
 *  3. Domain matches a partner_registry doc in the default Firestore DB
 *     → { role: 'partner_agent', partner_id: <slug> }
 *
 * Claims are immutable to end-users; only server-side code can set them.
 * The auth middleware in services/api reads these claims to enforce tenant
 * isolation and route requests to the correct named Firestore DB.
 */
/**
 * Firebase Auth v2 beforeUserCreated trigger.
 *
 * Returns custom claims that Firebase automatically attaches to the new user's
 * ID token. No explicit setCustomUserClaims() call is needed — the
 * beforeUserCreated trigger's return value IS the claim payload.
 */
export declare const onPartnerUserCreate: import("firebase-functions/v1").BlockingFunction;
/**
 * HTTP trigger for manual claim refresh (e.g. after a partner's status changes).
 * POST body: { uid: string }
 * Deletes existing claims and re-runs the domain lookup logic so the next token
 * refresh picks up the corrected claims.
 *
 * Protected: caller must supply the MDJ shared secret header.
 */
export declare const refreshPartnerClaims: import("firebase-functions/v2/https").HttpsFunction;
//# sourceMappingURL=onPartnerUserCreate.d.ts.map