# Runbook — Migrate RPI Data from (default) to partner-rpi

> **Ticket:** `ZRD-PLAT-MT-016` | Sprint: `ZRD-PLAT-MT` | Author: RONIN (draft) / SHINOB1 (owner)
> Status: **Future-proofing document.** This migration is NOT scheduled. Run only after the platform is fully battle-tested on named DBs with multiple partners.

---

## Why this might eventually run

Currently, RPI's own clients, accounts, and business data live in the `(default)` Firestore database alongside the shared catalogs (carriers, products, users, ATLAS registries, etc.). Every partner gets their own named DB (`partner-<slug>`). RPI is architecturally "the default partner."

When we have 3–4 partners live and the multi-tenant plumbing is proven, JDM may want a cleaner separation: RPI's business data moves to a `partner-rpi` named DB, and `(default)` is reduced to shared catalogs only. This makes the mental model uniform ("every tenant has a named DB") and simplifies future cross-tenant support tooling.

This runbook describes HOW to run that migration when the time comes. It does NOT authorize running it.

---

## Pre-migration checklist (no shortcuts)

- [ ] At least 3 partners are live on named DBs, each with ≥30 days of production traffic with zero cross-tenant incidents.
- [ ] MT-012 live isolation test suite has been green for ≥30 consecutive days.
- [ ] Cross-tenant support view (MT-013 RIIMO admin) is stable in production.
- [ ] JDM + SHINOB1 both explicitly authorize the migration.
- [ ] Current production export exists and is verified readable (gcloud firestore export).
- [ ] Cutover window is scheduled (30 minutes minimum) during business-low traffic — weekend 2am Central is the historical norm.
- [ ] RAIDEN and MEGAZORD are in the war room.
- [ ] A rollback plan has been rehearsed (see bottom of this doc).

---

## Procedure (six phases, est. 4–6 hours total active work)

### Phase 0 — Prep (T-7 days)

1. Create the named DB: `gcloud firestore databases create --database=partner-rpi --location=nam5 --type=firestore-native --project=claude-mcp-484718`.
2. Deploy the partner rules template with `PARTNER_SLUG=rpi` substituted (via MT-008's rendering path, or manually through the Firebase Rules REST API).
3. Seed `default/partner_registry/rpi` with `{ slug: 'rpi', db_name: 'partner-rpi', domain: 'retireprotected.com', display_name: 'Retirement Protectors, Inc.', status: 'pending_migration', created_at: <now> }`.
4. Rehearse Phase 2–3 on a copy of production data in a staging project.

### Phase 1 — Pre-cutover export (T-0, 2am)

1. `gcloud firestore export gs://tm-migrations/rpi-pre-cutover-<timestamp> --project=claude-mcp-484718 --collection-ids=clients,accounts,households,revenue,opportunities,communications,case_tasks,activities,approval_queue,campaign_enrollments,mdj_conversations,wire_executions,dex_packages`
2. Verify the export manifest and GCS bucket are readable.
3. Freeze writes: set a feature flag in the API that returns 503 on all tenant-collection write endpoints. Reads continue normally.

### Phase 2 — Import to partner-rpi

1. `gcloud firestore import gs://tm-migrations/rpi-pre-cutover-<timestamp> --database=partner-rpi --project=claude-mcp-484718`
2. Verify row counts per collection match the export manifest.
3. Spot-check 5 random documents per major collection (clients, accounts, revenue) — values must match byte-for-byte.

### Phase 3 — Re-point code

The API currently treats `req.partnerId === null` (RPI users) as "use default DB." Switch this:
1. Set env var `RPI_PARTNER_SLUG=rpi` on tm-api Cloud Run.
2. In the auth middleware (`services/api/src/middleware/auth.ts`), when a user has `role: 'rpi'`, set `req.partnerId = process.env.RPI_PARTNER_SLUG || null`. (Currently RPI users have `req.partnerId = null`.)
3. In VOLTRON / mdj-agent, apply the same env-var-driven rewrite for `role: 'rpi'` conversations.
4. Deploy API + MDJ Agent.

### Phase 4 — Cutover switch

1. Unfreeze writes.
2. Monitor Cloud Monitoring for 15 minutes: read/write rate on `partner-rpi` should mirror prior (default) traffic; errors should be zero.
3. Manual smoke test in ProDashX: view a client, edit a record, confirm writes landing in `partner-rpi`.
4. Update `partner_registry/rpi` status to `active`.

### Phase 5 — Legacy default cleanup (T+30 days)

After 30 days with zero rollback signals:
1. Delete the migrated collections from `(default)` — they are now orphaned.
2. Verify shared catalogs (carriers, products, users, atlas, partner_registry, tracker_items, org, etc.) remain in `(default)`.
3. Update all docs + CLAUDE.md files to reflect that `(default)` holds shared catalogs only.

---

## Rollback plan

**If anything breaks during Phase 4 cutover:**
1. Revert env var `RPI_PARTNER_SLUG` to empty.
2. Redeploy API + MDJ Agent (existing code falls back to null → default DB).
3. RPI users are back on the default DB; the partner-rpi DB exists but is unused.
4. Investigate, fix, retry Phase 4 at next scheduled window.

**If a data-mismatch is discovered post-cutover:**
1. Do NOT delete the default-DB originals (Phase 5 is the safety buffer).
2. Freeze writes again.
3. Re-run Phase 2 import with the latest export.
4. Compare partner-rpi against a fresh default export to find the delta.

---

## Estimated effort (RONIN execution, if authorized)

- Phase 0: 2 hours (mostly waiting on GCP provisioning)
- Phase 1: 30 minutes
- Phase 2: 45 minutes (depends on collection sizes)
- Phase 3: 1 hour (env var + code + deploy)
- Phase 4: 30-minute cutover window
- Phase 5: 1 hour (deferred 30 days)

**Total active work:** ~4 hours spread across a weekend. Cutover window: 30 minutes.

---

## Do-not-run checklist

This runbook is DRAFT and UNAUTHORIZED. Running it requires:
- JDM explicit approval in writing (Slack DM is sufficient)
- SHINOB1 review + sign-off on the exact migration timestamp
- Pre-migration checklist complete with all boxes ticked
- Rollback rehearsed in staging at least once

Until all three are true, this document is informational only.

🗡️ — RONIN, The Builder (draft) | Owner: SHINOB1, CTO
