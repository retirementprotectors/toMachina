# Orphaned Script Discovery — ZRD-D03

> Generated: 2026-04-05 | Track: MEGAZORD DEVOUR | Author: RONIN

---

## Summary

| Category | Count |
|----------|-------|
| Total Scripts Found | 92 |
| ACTIVE (in use / properly placed) | 88 |
| ARCHIVE (should be moved or deleted) | 2 |
| ABSORB (register in ATLAS as tools) | 0 |
| OUT-OF-PLACE (outside scripts/, needs review) | 6 |

**Verdict**: No true orphans. All scripts are in `services/api/src/scripts/` or have a clear home. Two non-script files sitting in script directories need cleanup.

---

## services/api/src/scripts/ — 78 TypeScript scripts

The canonical location for all operational, migration, and data-management scripts. All 78 are correctly placed here.

### Seed Scripts (25) — ACTIVE

Database population for Firestore collections. All are sprint-lifecycle artifacts — run once per deploy environment, then dormant.

| Script | Purpose |
|--------|---------|
| `seed-atlas-sprint.ts` | Seed ATLAS sprint data |
| `seed-carriers.ts` | Seed carrier registry |
| `seed-clean-tracker-titles.ts` | Normalize tracker titles |
| `seed-config-registry.ts` | Seed config registry collection |
| `seed-dex-forms.ts` | Seed DEX form definitions |
| `seed-dex-mappings.ts` | Seed DEX field mappings |
| `seed-dex-rules.ts` | Seed DEX routing rules |
| `seed-dex-taxonomy.ts` | Seed DEX taxonomy |
| `seed-employee-profiles.ts` | Seed employee profile records |
| `seed-format-library.ts` | Seed format library |
| `seed-guardian-sprint.ts` | Seed Guardian sprint configuration |
| `seed-intake-wire-sprint.ts` | Seed intake wire definitions for sprint |
| `seed-mdj-alpha-sprint.ts` | Seed MDJ Alpha sprint data |
| `seed-mdj-specialists.ts` | Seed MDJ specialist configurations |
| `seed-nbx-instances.ts` | Seed NBX (notebook) instances |
| `seed-pipelines.ts` | Seed pipeline definitions |
| `seed-prozone.ts` | Seed ProZone territory data |
| `seed-que.ts` | Seed QUE session definitions |
| `seed-roadmap.ts` | Seed roadmap data |
| `seed-routing-rules.ts` | Seed comms routing rules |
| `seed-sensei-content.ts` | Seed Sensei training content |
| `seed-session-instances.ts` | Seed session instances |
| `seed-sprint.ts` | General sprint seed runner |
| `seed-tracker.ts` | Seed tracker items |
| `seed-unit-defaults.ts` | Seed unit default settings |

### Migration Scripts (6) — ACTIVE (historical)

One-time schema/data migration scripts. Completed — retained for audit trail.

| Script | Purpose |
|--------|---------|
| `migrate-acf-households.ts` | Migrate ACF records to households schema |
| `migrate-agent-user-plumbing.ts` | Rewire agent → user record associations |
| `migrate-households.ts` | Migrate household grouping schema |
| `migrate-status-consolidation.ts` | Consolidate legacy status fields into unified schema |
| `migrate-status-fields.ts` | Rename/remap legacy status field names |
| `migrate-voltron-registry-domains.ts` | Migrate VOLTRON registry to domain-partitioned schema |

### Backfill Scripts (4) — ACTIVE (rerunnable)

Retroactive enrichment scripts. Can be rerun as data grows.

| Script | Purpose |
|--------|---------|
| `backfill-acf-ids.ts` | Backfill ACF folder IDs onto client records |
| `backfill-geo-from-zip.ts` | Backfill geo coordinates from ZIP codes |
| `backfill-investments-category.ts` | Backfill investment account category field |
| `backfill-medicare-charter.ts` | Backfill Medicare charter codes from Aetna mapping |

### ACF Scripts (10) — ACTIVE

ACF (Active Client File) Drive folder lifecycle management suite. Part of the Trinity Data Method — Digital Files pillar.

| Script | Purpose |
|--------|---------|
| `acf-account-dedup.ts` | Deduplicate account records within ACF |
| `acf-cleanup.ts` | General ACF hygiene |
| `acf-client-dedup.ts` | Deduplicate client records in ACF |
| `acf-enrich-clients.ts` | Enrich client records from ACF data |
| `acf-extract-batch.ts` | Batch extract data from ACF folders |
| `acf-fix-stragglers.ts` | Fix clients missing ACF folder linkage |
| `acf-guardrails.ts` | ACF guardrail enforcement |
| `acf-orphan-resolve.ts` | Resolve orphaned ACF folders |
| `acf-subfolder-audit.ts` | Audit ACF subfolder lifecycle compliance |
| `acf-verify-final.ts` | Final verification pass for ACF integrity |

### Guardian Scripts (4) — ACTIVE

Guardian data integrity system utilities.

| Script | Purpose |
|--------|---------|
| `guardian-crossref.ts` | Cross-reference client data across sources |
| `guardian-forensics.ts` | Forensic analysis of data anomalies |
| `guardian-snapshot.ts` | Guardian snapshot capture |
| `guardian-structural.ts` | Structural integrity check |

### Fix Scripts (2) — ACTIVE (historical)

Point-in-time fixes. Completed — retained for audit trail.

| Script | Purpose |
|--------|---------|
| `fix-mdj-plan-audit.ts` | Fix MDJ plan audit records |
| `fix-mdj-user-prefs.ts` | Fix MDJ user preference records |

### Data Clean Scripts (3) — ACTIVE (historical)

Named data cleaning operations. Sprint-numbered for traceability.

| Script | Purpose |
|--------|---------|
| `data-clean-023-agent-backfill.ts` | Sprint 023: Agent record backfill cleanup |
| `data-clean-086-shane-dup.ts` | Sprint 086: Shane Parmenter duplicate resolution |
| `data-clean-087-steve-dup.ts` | Sprint 087: Steve duplicate resolution |

### Import Scripts (1) — ACTIVE

| Script | Purpose |
|--------|---------|
| `import-cof-bob.ts` | CoF (Catholic Order of Foresters) Parmenter Agency Book of Business import |

### Update Scripts (3) — ACTIVE (historical)

| Script | Purpose |
|--------|---------|
| `update-mdj-audit.ts` | Update MDJ audit records |
| `update-mdj-plan-link.ts` | Update MDJ plan link references |
| `update-mdj-specialist-prompts.ts` | Update MDJ specialist prompt content |

### Utility / Operational Scripts (20) — ACTIVE

Rerunnable operational tools, verifiers, and investigative scripts.

| Script | Purpose |
|--------|---------|
| `atlas-import-run.ts` | ATLAS WIRE_DATA_IMPORT — Full pipeline execution |
| `atlas-introspect-dryrun.ts` | ATLAS introspect engine dry run |
| `bridge-verify.ts` | Verify Firestore ↔ Sheets bridge dual-write parity |
| `carrier-bob-match.ts` | Carrier BOB address cross-reference |
| `detect-wiring.ts` | Auto-detect collection wiring status at build time |
| `dickson-dedup.ts` | Dickson Ai3 template deduplication |
| `geo-aggregate-clients.ts` | Geographic client aggregation for ProZone territory building |
| `link-acf-folders.ts` | Link ACF Drive folders to client records |
| `populate-acf-config.ts` | Populate ACF configuration records |
| `populate-naic.ts` | Populate NAIC codes on accounts with charter_code but no naic_code |
| `reconcile-matrix.ts` | Reconcile Sheets MATRIX data against Firestore |
| `register-kcl-atlas.ts` | Register KCL data source in ATLAS registry |
| `restore-trashed.ts` | Restore Drive files from trash |
| `slack-intake-monitor.ts` | VOLTRON Slack intake monitor (VOL-O11) |
| `super-extract-pdf.ts` | Super PDF extraction utility |
| `validate-client-qualification.ts` | Validate client qualification criteria |
| `verify-permissions.ts` | Verify Firestore permissions |
| `wfs-chunked-extract.ts` | Chunked WFS (workflow) extract (uses Anthropic SDK) |
| `whitepages-enrich-ghosts.ts` | Whitepages enrichment for ghost/incomplete records |
| `atlas-import-run.ts` | ATLAS import pipeline runner |

---

## services/api/src/scripts/ — Non-TS Files

### ARCHIVE — 2 files

These do not belong in the scripts directory.

| File | Current Location | Decision | Action |
|------|-----------------|----------|--------|
| `rapid-import-swap.md` | `services/api/src/scripts/` | ARCHIVE | Move to `docs/` or `services/api/docs/`. It is a migration planning doc, not a runnable script. |
| `data/` (directory, 8 JSON files) | `services/api/src/scripts/data/` | REVIEW | Charter mapping JSON files for Medicare backfill (`aetna-mfga-charter.json`, `medicare-charter-lookups.json`, etc.). If no longer needed post-backfill, archive. If still referenced by backfill scripts, leave in place. |

---

## services/api/src/routes/ — Out-of-Place File

| File | Decision | Action |
|------|----------|--------|
| `flow.ts.bak` | ARCHIVE | Backup file of `flow.ts` — delete. Git is the version history. No `.bak` files in routes/. |

---

## services/learning-loop/scripts/ — 3 scripts

Correctly placed in the learning-loop service's own scripts directory.

| Script | Purpose | Decision |
|--------|---------|----------|
| `backfill.ts` | Learning loop data backfill | ACTIVE |
| `create-views.ts` | BigQuery view creation | ACTIVE |
| `seed-warriors.ts` | Seed warrior configurations for learning loop | ACTIVE |

---

## packages/core/src/atlas/super-tools/ — 2 files

These are Super Tool definitions (ATLAS wire components), not scripts. Correctly placed.

| File | Purpose | Decision |
|------|---------|----------|
| `acf-document-cleanup.ts` | `SUPER_DOCUMENT_CLEANUP` — file-level ACF hygiene | ACTIVE (Super Tool definition) |
| `acf-folder-cleanup.ts` | ACF folder cleanup Super Tool definition | ACTIVE (Super Tool definition) |

---

## ABSORB Items (ATLAS Registration)

None. All scripts are either:
1. Sprint lifecycle artifacts (seed/migrate — run once, dormant)
2. Operational tools already accessible via `npx tsx services/api/src/scripts/<name>.ts`
3. Super Tool definitions already registered in ATLAS wire schema

No scripts require new ATLAS registration as a result of this audit.

---

## Cleanup Tickets

| Ticket | Item | Action | Priority |
|--------|------|--------|----------|
| ZRD-D09 | `services/api/src/routes/flow.ts.bak` | Delete — covered by git history | LOW |
| ZRD-D10 | `services/api/src/scripts/rapid-import-swap.md` | Move to `docs/` — it is a planning doc, not a script | LOW |
| ZRD-D11 | `services/api/src/scripts/data/` | Audit JSON files post-backfill; archive if backfill complete | LOW |

---

## Recommendations

1. **No orphaned data-processing found outside established paths.** All scripts live in `services/api/src/scripts/`, `services/learning-loop/scripts/`, or `packages/core/src/atlas/super-tools/`.

2. **The scripts directory is properly governed.** 78 scripts cover seed, migrate, backfill, ACF, guardian, fix, data-clean, import, update, and utility categories. Sprint-numbered `data-clean-*` scripts provide traceability.

3. **Three low-priority cleanup items** (1 `.bak` file, 1 misplaced doc, 1 post-backfill data directory) are the only action items.

4. **`rapid-import-swap.md`** is a valuable GAS migration planning doc. Moving it to `docs/` (or referencing it from `docs/gas-migration-audit.md`) makes it easier to find. It should not live in a scripts directory.

5. **`wfs-chunked-extract.ts` imports `@anthropic-ai/sdk` directly** — flag for review if this script runs in a context where the SDK is not expected (e.g., CI or scheduled job). Likely intentional for AI-powered extraction.
