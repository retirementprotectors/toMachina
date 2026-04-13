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
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { onRequest } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
if (getApps().length === 0) {
    initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' });
}
/** Default super-admin emails. Override via SUPERADMIN_EMAILS env var. */
const DEFAULT_SUPERADMINS = ['josh@retireprotected.com', 'john@retireprotected.com'];
function getSuperAdminEmails() {
    const raw = process.env.SUPERADMIN_EMAILS;
    if (raw && raw.trim().length > 0) {
        return new Set(raw
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean));
    }
    return new Set(DEFAULT_SUPERADMINS.map((e) => e.toLowerCase()));
}
/**
 * Look up a partner slug by email domain in the default Firestore DB.
 * partner_registry docs are keyed by slug; each doc has a `domain` field.
 * Returns the slug string or null if not found.
 */
async function findPartnerSlugByDomain(domain) {
    const db = getFirestore();
    const snap = await db
        .collection('partner_registry')
        .where('domain', '==', domain)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return doc.data().slug ?? null;
}
/**
 * Firebase Auth v2 beforeUserCreated trigger.
 *
 * Returns custom claims that Firebase automatically attaches to the new user's
 * ID token. No explicit setCustomUserClaims() call is needed — the
 * beforeUserCreated trigger's return value IS the claim payload.
 */
export const onPartnerUserCreate = beforeUserCreated({ region: 'us-central1' }, async (event) => {
    const user = event.data;
    if (!user) {
        console.warn('onPartnerUserCreate: event.data is undefined — skipping claim assignment');
        return {};
    }
    const email = (user.email ?? '').toLowerCase();
    if (!email) {
        console.warn(`onPartnerUserCreate: user ${user.uid} has no email — skipping claim assignment`);
        return {};
    }
    const superAdmins = getSuperAdminEmails();
    // 1. Super-admin check (most privileged — runs first)
    if (superAdmins.has(email)) {
        console.log(`onPartnerUserCreate: ${email} → superadmin`);
        return { customClaims: { role: 'superadmin' } };
    }
    const domain = email.split('@')[1] ?? '';
    // 2. RPI internal domain
    if (domain === 'retireprotected.com') {
        console.log(`onPartnerUserCreate: ${email} → rpi`);
        return { customClaims: { role: 'rpi' } };
    }
    // 3. Partner domain lookup in partner_registry
    try {
        const slug = await findPartnerSlugByDomain(domain);
        if (slug) {
            console.log(`onPartnerUserCreate: ${email} → partner_agent (partner_id: ${slug})`);
            return { customClaims: { role: 'partner_agent', partner_id: slug } };
        }
    }
    catch (err) {
        console.error(`onPartnerUserCreate: partner_registry lookup failed for domain "${domain}":`, err);
        // Non-fatal — fall through to default (no claims)
    }
    // 4. Unrecognised domain — no claims assigned; API middleware will block appropriately
    console.log(`onPartnerUserCreate: ${email} — no matching role, claims left empty`);
    return {};
});
/**
 * HTTP trigger for manual claim refresh (e.g. after a partner's status changes).
 * POST body: { uid: string }
 * Deletes existing claims and re-runs the domain lookup logic so the next token
 * refresh picks up the corrected claims.
 *
 * Protected: caller must supply the MDJ shared secret header.
 */
export const refreshPartnerClaims = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '128MiB' }, async (req, res) => {
    // Basic shared-secret guard (same pattern used by other internal HTTP functions)
    const secret = process.env.MDJ_AUTH_SECRET;
    if (secret && req.headers['x-mdj-auth'] !== secret) {
        res.status(401).json({ success: false, error: 'Unauthorised' });
        return;
    }
    const { uid } = req.body;
    if (!uid) {
        res.status(400).json({ success: false, error: 'Missing uid in request body' });
        return;
    }
    try {
        const userRecord = await getAuth().getUser(uid);
        const email = (userRecord.email ?? '').toLowerCase();
        const superAdmins = getSuperAdminEmails();
        let newClaims = {};
        if (superAdmins.has(email)) {
            newClaims = { role: 'superadmin' };
        }
        else {
            const domain = email.split('@')[1] ?? '';
            if (domain === 'retireprotected.com') {
                newClaims = { role: 'rpi' };
            }
            else {
                const slug = await findPartnerSlugByDomain(domain);
                if (slug) {
                    newClaims = { role: 'partner_agent', partner_id: slug };
                }
            }
        }
        await getAuth().setCustomUserClaims(uid, newClaims);
        console.log(`refreshPartnerClaims: updated claims for ${uid}:`, newClaims);
        res.json({ success: true, data: { uid, claims: newClaims } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`refreshPartnerClaims error for uid ${uid}:`, err);
        res.status(500).json({ success: false, error: message });
    }
});
//# sourceMappingURL=onPartnerUserCreate.js.map