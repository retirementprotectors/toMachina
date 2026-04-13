# MT-014 — VOLTRON (MDJ Agent) Partner Context Awareness

> **Ticket:** `ZRD-PLAT-MT-014` | Sprint: `ZRD-PLAT-MT` | Author: RONIN, The Builder
> **Non-negotiable gate:** Must land before ANY partner user receives portal access.

---

## Belt (shipped this PR) — MDJ Panel partner-hide feature flag

Portal-side guard landed in `packages/auth/src/provider.tsx` + all three portal layouts.

- `AuthProvider` now reads `partner_id` and `role` custom claims from the Firebase ID token on every `onAuthStateChanged` event and exposes them on `AuthUser.partnerId` / `AuthUser.role`.
- `apps/{prodash,riimo,sentinel}/app/(portal)/layout.tsx` wrap `<MDJPanel>` in `{!user?.partnerId && (...)}` — MDJ Panel is not rendered for partner users until MT-014 suspenders ship.
- Super-admins (JDM/John with `role: 'superadmin'`) have `partnerId === null`, so they retain full MDJ Panel access.

This is the **non-negotiable guard**: even if a partner user somehow reaches the portal before MT-014 lands, they cannot open VOLTRON and therefore cannot receive data from the default (RPI) Firestore DB through the AI layer.

---

## Suspenders (MT-014 proper) — Contract for the MDJ Agent repo

The MDJ Agent lives at `/home/jdm/mdj-agent/` on MDJ_SERVER as a standalone repo (per global `CLAUDE.md` — "never part of the toMachina monorepo"). The following changes land there, not in this PR.

### Required changes in `~/mdj-agent/`

1. **Extract `partner_id` from the incoming request.**
   The portal MDJ Panel sends the end-user's Firebase ID token in the `Authorization: Bearer <token>` header (or whatever header the agent currently reads for user identity). The agent already verifies this token via `getAuth().verifyIdToken()`. Add one line after verification:
   ```
   const partnerId = typeof decoded.partner_id === 'string' ? decoded.partner_id : null
   ```

2. **Thread `partnerId` into the per-request context** so every Firestore tool call the specialist makes during that conversation turn knows which DB to hit. The agent's request context object (typically passed to tool handlers) gains a `partnerId: string | null` field.

3. **Replace `getFirestore()` in tool handlers with a tenant-aware accessor.**
   Same pattern as the API's `services/api/src/lib/db.ts`:
   ```
   function getDb(partnerId) {
     if (!partnerId) return getFirestore(adminApp)
     return getFirestore(adminApp, `partner-${partnerId}`)
   }
   ```
   Cache the `Firestore` instances in a `Map<string, Firestore>` keyed by `databaseId`. The `mdj-agent` SA key at `/home/jdm/mdj-agent/sa-key.json` already has project-level Firestore access (per global `CLAUDE.md`); named databases are included automatically — no new IAM needed.

4. **Specialist system prompts — partner boundary language.**
   Each of the five Lion specialists (Medicare / Annuity / Life+Estate / Investment / Legacy+LTC) should include a line in its system prompt along the lines of "You are serving {partner_display_name}'s clients. Never reference clients outside this tenant." When `partnerId !== null`, resolve `partner_display_name` from the `partner_registry` doc in the default DB at conversation start.

5. **AEP Blackout still applies.**
   Medicare wires are blocked October 1 – December 7 regardless of partner context. The existing AEP blackout check remains; just make sure any partner-specific Medicare tools are subject to the same gate.

### Acceptance for MT-014 proper

- Matt's staff user opens the MDJ Panel (once belt is lifted), asks "show me my Medicare clients," and VOLTRON returns results from `partner-midwest-medigap`, NOT from the default DB.
- An RPI internal user asking the same question gets RPI's default-DB clients.
- A super-admin can pass `?context=midwest-medigap` and get Matt's data explicitly (logged to `guardian_audits`).
- Unit test in `~/mdj-agent/tests/`: mock a partner-token request, assert the Firestore tool invocation targets `partner-<slug>`.

### When to lift the belt

After MT-014 lands and the contract above is verified end-to-end in production, remove the `{!user?.partnerId && ...}` guards in the three portal layouts. That lets partner users open the MDJ Panel and interact with VOLTRON against their own tenant DB.

Leaving the belt in place for longer than necessary is safe — it just blocks a feature. Lifting it prematurely is not safe — it risks a silent HIPAA exposure.

---

## Dependencies

| Ticket | Purpose | Status |
|---|---|---|
| MT-001 | `getDb()` helper in API | Landed (PR #353) |
| MT-002 | `req.partnerId` middleware in API | Landed (PR #353) |
| MT-007 | `onPartnerUserCreate` Cloud Function (sets the claim this reads) | Landed (PR #354) |
| MT-014 belt | MDJ Panel feature flag | THIS PR |
| MT-014 proper | MDJ Agent partner-context | Handoff to SHINOB1 (separate repo) |

🗡️ — RONIN, The Builder
