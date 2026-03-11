# Builder 3 Phase 4+5 Report -- 2026-03-10
> Scope: Thin RAPID_CORE + Hookify Pruning
> Builder: Claude Opus 4.6 (worktree)
> Worktree: `~/Projects/toMachina-builder3-p4` on branch `builder-3/phase-4-core-thinning`

---

## CP1: Phase 4c Verification -- All Ported Functions Confirmed

Cross-referenced every GAS source file against packages/core:

| GAS File | packages/core Location | Status |
|----------|----------------------|--------|
| CORE_Normalize.gs | `src/normalizers/` -- 16 types, normalizeData() | CONFIRMED |
| CORE_Financial.gs | `src/financial/` -- all 14 functions | CONFIRMED |
| CORE_Match.gs | `src/matching/` -- levenshtein, fuzzy, nameScore, matchScore, dedup | CONFIRMED |
| CORE_Entitlements.gs | `src/users/` -- 39 MODULES, USER_LEVELS, TOOL_SUITES, evaluateAccess, resolveUser | CONFIRMED |
| CORE_Compliance.gs | **NOT PORTED in Round 1** | Ported in this session (CP2) |
| CORE_Validation_API.gs | `src/validators/` -- 11 local validators, rules engine, quality score | CONFIRMED |

**Build:** `turbo run build --filter=@tomachina/core` PASSES (0 errors).

---

## CP2: CORE_Compliance.gs Ported

Created `packages/core/src/compliance/index.ts` (265 lines) in worktree.

Functions ported:
- `maskSSN(ssn)` -- SSN masking, show last 4
- `ssnLast4(ssn)` -- extract last 4 digits
- `isValidSSNFormat(ssn)` -- 9-digit format check
- `maskDOB(dob, options)` -- DOB masking with age/year/full modes
- `calculateAge(dob)` -- age from DOB
- `maskPhone(phone)` -- phone masking, show last 4
- `maskMBI(mbi)` -- Medicare Beneficiary Identifier masking
- `sanitizeForLog(obj, additionalFields)` -- auto-mask sensitive fields
- `SENSITIVE_FIELDS` constant -- 21 field names
- `MaskDOBOptions` interface

Note: `safeLog()` was NOT ported -- it wraps `Logger.log()` which is GAS-specific. In toMachina, consumers should use `sanitizeForLog()` before logging.

**Commit:** `0b49e16` in worktree branch `builder-3/phase-4-core-thinning`

---

## CP3: RAPID_CORE Thinned

| Action | File | Lines Removed |
|--------|------|---------------|
| DELETE | CORE_Financial.gs | 544 |
| DELETE | CORE_Compliance.gs | 363 |
| UPDATE | Code.gs | ~63 lines (exports + tests removed) |
| **Total** | | **~970 lines** |

### What Was NOT Thinned (and Why)

| File | Why It Stays |
|------|-------------|
| CORE_Entitlements.gs (1,798 lines) | Constants (USER_LEVELS, MODULES, TOOL_SUITES, etc.) are referenced by getUserHierarchy(), userHasModuleAccess(), getToolSuitesForUser() and other Sheets-dependent functions IN THE SAME FILE. Removing constants breaks those functions. resolveUser() reads from Sheets via getMATRIX_SS(). |
| CORE_Match.gs (565 lines) | Pure functions (levenshteinDistance, fuzzyMatch, calculateNameScore) are called by matchClient(), matchAccount(), matchAgent() IN THE SAME FILE. Cannot remove without breaking the matchers. |
| CORE_OrgAdmin.gs (674 lines) | ALL functions read/write Sheets (getAllUsersForPlatform, getCompanyStructure, saveUser, etc.). Zero pure logic to remove. |
| CORE_Validation_API.gs (717 lines) | ALL functions are UrlFetchApp wrappers (validatePhoneAPI, validateEmailAPI, validateAddressAPI, etc.). The "local validators" ported to packages/core were new TypeScript implementations, not extracted from this file. |
| CORE_Normalize.gs | Kept per plan (Option A: frozen copy for GAS consumers). |

**Architecture Decision:** The plan estimated ~3,200 lines removable. Reality: only ~970 lines safely removable. The remaining ~2,230 lines cannot be removed because GAS files have no module system -- functions within the same file call each other, and constants are consumed by Sheets-dependent functions that must stay. The thinning is limited to deleting entire files where NO internal GAS consumer calls the exported functions via `RAPID_CORE.xyz()`.

**Consumer verification via grep:** Confirmed zero GAS consumer calls to `RAPID_CORE.calculateFYC|calculateNPV|...` (Financial) and `RAPID_CORE.maskSSN|maskDOB|...` (Compliance).

**Commit:** `d29aa46` in `~/Projects/gas/RAPID_CORE` on `main`

---

## CP4: Consumer DEBUG_Pings -- BLOCKED

**Blocker:** `clasp push --force` fails with `invalid_grant / invalid_rapt` error. JDM needs to run `clasp login` to refresh OAuth.

The thinned code is committed locally but NOT pushed to GAS. Consumer verification requires the push first.

**JDM Action Required:**
1. Open terminal
2. `cd ~/Projects/gas/RAPID_CORE`
3. `clasp login`
4. Authorize in browser
5. Tell Claude "TCO" -- Claude will then push and verify

---

## CP5: RAPID_CORE Deployed -- BLOCKED

Same blocker as CP4. After clasp login:
```bash
cd ~/Projects/gas/RAPID_CORE
NODE_TLS_REJECT_UNAUTHORIZED=0 clasp push --force
NODE_TLS_REJECT_UNAUTHORIZED=0 clasp version "v1.18.0 - Phase 4 thinning: Financial + Compliance moved to toMachina"
```

Note: RAPID_CORE is a library, not a web app. Only push + version needed (no deploy).

---

## CP6: Hookify Rules Pruned

### Deleted (15 rules)

| Rule | Reason |
|------|--------|
| block-forui-no-json-serialize | GAS serialization -- not relevant in TypeScript |
| block-let-module-caching | GAS var vs let -- not relevant in ES modules |
| block-hardcoded-colors | Tailwind handles this in toMachina |
| block-hardcoded-matrix-ids | Firestore, not Sheets IDs |
| block-anyone-anonymous-access | Firebase Auth handles access |
| block-alert-confirm-prompt | React components, no alert() possible |
| block-drive-url-external | Firestore, not Drive URLs |
| block-direct-matrix-write | Bridge handles all writes |
| warn-date-return-no-serialize | Firestore Timestamps, no GAS Date bug |
| warn-modal-no-flexbox | React Modal component handles this |
| warn-plain-person-select | SmartLookup is a React component |
| warn-missing-structured-response | TypeScript interfaces enforce return types |
| quality-gate-deploy-verify | Auto-deploy pipeline |
| quality-gate-commit-remind | CI/CD handles build verification |
| intent-sendit | Simplified deploy (just push to main) |

### Kept (13 rules)

| Rule | Category |
|------|----------|
| block-hardcoded-secrets | Universal security |
| block-credentials-in-config | Universal security |
| block-phi-in-logs | Universal PHI compliance |
| warn-phi-in-error-message | Universal PHI compliance |
| warn-inline-pii-data | Universal PHI compliance |
| intent-session-start | Session protocol trigger |
| intent-immune-system-check | Compliance briefing trigger |
| intent-plan-mode | Planning phase trigger |
| intent-execute-plan | Execution phase trigger |
| intent-atlas-consult | Data import guard |
| quality-gate-phase-complete | Phase tracking |
| quality-gate-audit-verify | Builder audit workflow |
| quality-gate-plan-format | Plan quality |

### Cleanup

- 330 orphan symlinks deleted across all projects
- `setup-hookify-symlinks.sh` updated: new project paths (toMachina, gas/, services/), 14 active project targets
- Script run verified: all 14 projects configured, 0 skipped

**Commit:** `c3ec455` in `~/Projects/_RPI_STANDARDS` on `main`

---

## Commits Summary

| Repo | Commit | Description |
|------|--------|-------------|
| toMachina worktree | `0b49e16` | Phase 4c: Port CORE_Compliance.gs to packages/core/compliance |
| gas/RAPID_CORE | `d29aa46` | v1.18.0: Delete Financial + Compliance, update Code.gs |
| _RPI_STANDARDS | `c3ec455` | Phase 5c: Prune 15 hookify rules, update symlinks script |

---

## Files Changed

### Created
- `packages/core/src/compliance/index.ts` (toMachina worktree)

### Modified
- `packages/core/src/index.ts` (toMachina worktree) -- added compliance export
- `gas/RAPID_CORE/Code.gs` -- v1.18.0, removed Financial + Compliance exports/tests

### Deleted
- `gas/RAPID_CORE/CORE_Financial.gs` (544 lines)
- `gas/RAPID_CORE/CORE_Compliance.gs` (363 lines)
- 15 hookify rule files from `_RPI_STANDARDS/hookify/`
- 330 orphan symlinks across all project .claude/ directories
- 15 broken symlinks from `~/.claude/`

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| clasp auth expired | BLOCKER | JDM needs `clasp login` before RAPID_CORE push. Code is committed locally but not pushed to GAS. |
| Thinning less than planned | INFO | Plan estimated ~3,200 lines removable. Only ~970 lines safely removable due to GAS files having no module system (intra-file dependencies prevent constant/function removal). |
| CLAUDE.md updated by Builder 1 | INFO | Builder 1 already updated `_RPI_STANDARDS/CLAUDE.md` (new deploy rules, project locations, etc.). My hookify commit does NOT touch CLAUDE.md to avoid conflicts. |

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Only delete entire files, not thin individual functions | GAS has no module system. Functions within the same file call each other. Removing `USER_LEVELS` constant breaks `getUserHierarchy()` in the same file. Removing `fuzzyMatch()` breaks `matchClient()`. Safe thinning = delete files where NO internal consumers exist. |
| Port `safeLog()` as NOT NEEDED | `safeLog()` wraps `Logger.log()` which is GAS-specific. toMachina consumers use `sanitizeForLog()` + their own logging. |
| Keep `resolveUser()` in GAS | 4 consumer projects (RAPID_FLOW, ATLAS, RAPID_API, RAPID_IMPORT) actively call `RAPID_CORE.resolveUser()`. Cannot remove until those consumers are migrated. |
| Keep all CORE_OrgAdmin.gs | Every function writes to Sheets. Zero pure logic to extract. |
