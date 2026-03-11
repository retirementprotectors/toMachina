# Builder 3 Report — 2026-03-10
> Scope: Core Business Logic Port (Phase 1.4)
> Builder: Claude Opus 4.6 (worktree)
> Source: RAPID_CORE GAS files (read-only)
> Worktree: `~/Projects/toMachina-builder3` on branch `builder-3/core-logic-port`

---

## Checkpoint 1: GAS Source Analysis

| GAS File | Key Contents | Items Counted |
|----------|-------------|---------------|
| `CORE_Database.gs` | FIELD_NORMALIZERS (lines 1278-1369), TABLE_ROUTING (53-147), normalizeData_() | 16 normalizer types, 90+ fields, 75 table routes |
| `CORE_Match.gs` | fuzzyMatch, levenshteinDistance, matchClient/Account/Agent, findDuplicates, batchMatch | 10 functions |
| `CORE_Financial.gs` | FYC, renewal, override, NPV, IRR, DCF, bookValue, revenue projections | 11 functions |
| `CORE_Entitlements.gs` | USER_LEVELS (4), TOOL_SUITES (5), MODULES (39), ROLE_TEMPLATES (6), UNIT_DEFAULTS (3) | 39 modules (not 46 as stated in task -- GAS source has exactly 39) |
| `CORE_Validation_API.gs` | validatePhoneAPI, validateEmailAPI, validateAddressAPI, lookupCityState, lookupRouting, scoreContactQuality | 6 API wrappers (server-side only, not ported) |

**Note on module count:** The task referenced "46 MODULES" but the GAS source `CORE_Entitlements.gs` contains exactly 39 module definitions in the `MODULES` object. The discrepancy may come from counting the 39 MODULES + 3 UNIT_MODULE_DEFAULTS + 4 USER_LEVELS = 46 total configurable items. All 39 module definitions are ported.

---

## Commits

| Commit | Hash | Description |
|--------|------|-------------|
| Phase 1.4: Core business logic port | `f4a2537` | All normalizers, matching, financial, users, validators, collections, types |

---

## Checkpoint 2: Build Status

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS (0 errors) |
| `turbo run build --filter=@tomachina/core` | PASS |
| TypeScript strict mode | Enabled (inherited from root tsconfig) |
| Zero `any` types | Confirmed |

---

## Modules Ported

### Normalizers

| Normalizer Type | Fields Covered | Source Line Reference |
|----------------|---------------|---------------------|
| `name` | 12 fields (first_name, last_name, middle_name, preferred_name, spouse_name, child_1-6_name, insured_name) | CORE_Database.gs:1280-1284 |
| `phone` | 5 fields (phone, cell_phone, alternate_phone, spouse_phone, contact_phone) | :1287-1288 |
| `email` | 4 fields (email, secondary_email, spouse_email, contact_email) | :1291-1292 |
| `date` | 24 fields (dob, spouse_dob, effective_date, issue_date, maturity_date, etc.) | :1295-1304 |
| `state` | 3 fields (state, mailing_state, driver_license_state) | :1311 |
| `zip` | 2 fields (zip, mailing_zip) | :1314 |
| `carrier` | 3 fields (carrier_name, custodian, institution_name) | :1317 |
| `product` | 3 fields (product_type, core_product_type, policy_type) | :1322 |
| `product_name` | 1 field (product_name) | :1325 |
| `plan_name` | 1 field (plan_name) | :1328 |
| `imo` | 1 field (imo_name) | :1331 |
| `status` | 5 fields (status, client_status, account_status, policy_status, agent_status) | :1334-1335 |
| `bob` | 1 field (book_of_business) | :1338 |
| `address` | 4 fields (address, address_2, mailing_address, mailing_address_2) | :1341-1342 |
| `city` | 2 fields (city, mailing_city) | :1345 |
| `amount` | 47 fields (premium, account_value, face_amount, death_benefit, etc.) | :1348-1368 |
| `skip` | 5 fields (created_at, updated_at, deleted_at, ghl_created_at, ghl_updated_at) + 2 (parent_carrier, naic_code) | :1307-1319 |

**Total: 16 normalizer types, 123 field mappings (90+ unique fields, some have compound counts)**

**NEW: `normalizeData()` dispatcher** -- port of `normalizeData_()` from CORE_Database.gs. Routes any data object through the full normalizer pipeline. Safety net preserves original values on normalizer failure.

### Matching

| Function | Purpose | Source |
|----------|---------|--------|
| `levenshteinDistance` | Classic DP edit distance | CORE_Match.gs:348-372 |
| `fuzzyMatch` | 0-100 similarity score | CORE_Match.gs:327-340 |
| `isSimilar` | Threshold shorthand | CORE_Match.gs:381-383 |
| `calculateNameScore` | Weighted name scoring (60% last, 40% first) | CORE_Match.gs:269-281 |
| `calculateMatchScore` | Multi-field match scoring | CORE_Match.gs:290-315 |
| `matchClient` | Client matching with 5-tier priority | CORE_Match.gs:20-108 |
| `matchAccount` | Account matching across 4 tabs | CORE_Match.gs:126-205 |
| `matchAgent` | Agent matching (NPN, email, name) | CORE_Match.gs:212-257 |
| `findDuplicates` | O(n^2) duplicate finder | CORE_Match.gs:396-413 |
| `batchMatch` | Batch matching wrapper | CORE_Match.gs:422-450 |

### Financial

| Function | Purpose | Source |
|----------|---------|--------|
| `roundCurrency` | 2-decimal rounding | CORE_Financial.gs:20-23 |
| `normalizeRate` | % to decimal (15 -> 0.15) | CORE_Financial.gs:30-37 |
| `normalizeAmount` (financial) | Non-negative validation | CORE_Financial.gs:44-47 |
| `calculateFYC` | First Year Commission | CORE_Financial.gs:168-172 |
| `calculateRenewal` | Renewal commission | CORE_Financial.gs:181-188 |
| `calculateOverride` | Override commission | CORE_Financial.gs:197-200 |
| `calculateNPV` | Net Present Value | CORE_Financial.gs:273-288 |
| `calculateIRR` | Internal Rate of Return (Newton-Raphson) | CORE_Financial.gs:298-342 |
| `calculateBookValue` | Revenue multiple valuation | CORE_Financial.gs:354-358 |
| `calculateDCF` | DCF with Gordon Growth Model | CORE_Financial.gs:369-398 |
| `calculateAnnualRevenue` | Account-based annual revenue | CORE_Financial.gs:59-82 |
| `calculateMonthlyRevenue` | Monthly breakdown | CORE_Financial.gs:90-117 |
| `projectRevenue` | Multi-year with growth rate | CORE_Financial.gs:127-156 |
| `projectCashFlow` | Revenue vs expenses projection | CORE_Financial.gs:214-265 |

### Users

| Function | Purpose | Source |
|----------|---------|--------|
| `resolveUser` (sync overload) | Resolve from array | CORE_UserResolve.gs (full file) |
| `resolveUser` (async overload) | Resolve from Firestore lookup | CORE_UserResolve.gs (full file) |
| `evaluateAccess` | Module access check | CORE_Entitlements.gs |
| `evaluateActionAccess` | Action-level access check | CORE_Entitlements.gs |
| `getAccessibleModules` | List accessible modules | CORE_Entitlements.gs |
| `getToolSuitesForUser` | Filtered suites for user | CORE_Entitlements.gs |
| `getModulesForPlatform` | Modules by platform | CORE_Entitlements.gs |
| `computeModulePermissions` | Role template + unit computation | CORE_Entitlements.gs |

### Module Definitions

- **Total:** 39 modules
- **By suite:** RAPID_TOOLS: 11, DAVID_TOOLS: 6, RPI_TOOLS: 14, PIPELINES: 5, ADMIN_TOOLS: 3
- **By status:** active: 33, planned: 6
- **Role templates:** 6 (owner, superadmin, admin, service, sales, readonly)
- **Unit defaults:** 3 (MEDICARE, RETIREMENT, LEGACY)

### Validators

| Function | Purpose | Source |
|----------|---------|--------|
| `isValidEmail` | Email format check | CORE_Validation_API.gs (local) |
| `isValidPhone` | 10-digit phone check | CORE_Validation_API.gs (local) |
| `isValidNPI` | NPI with Luhn checksum | CORE_Validation_API.gs (local) |
| `isValidZip` | ZIP format (5 or 5+4) | CORE_Validation_API.gs (local) |
| `isValidSSNLast4` | 4-digit check | CORE_Validation_API.gs (local) |
| `isValidState` | US state code check | NEW (derived from normalizer) |
| `isValidDate` | YYYY-MM-DD format + validity | NEW |
| `isValidRoutingNumber` | ABA checksum | NEW (from CORE_Validation_API.gs pattern) |
| `isRPIEmail` | Domain restriction check | NEW |
| `validateRecord` | Rules engine for any record | NEW |
| `scoreContactQualityLocal` | Client-side quality score | NEW (client-safe version of server-side API) |

### Collections

| Item | Count | Source |
|------|-------|--------|
| TABLE_ROUTING entries | 75 tabs | CORE_Database.gs:53-147 |
| FIRESTORE_COLLECTIONS entries | 30 mappings | Plan Phase 0.2 design |
| Helper functions | 3 (`getTablePlatform`, `getTablesForPlatform`, `getFirestoreCollection`) | |

---

## Files Created/Modified

### Created (14 files)
- `packages/core/src/collections/index.ts` -- TABLE_ROUTING + Firestore mapping
- `packages/core/src/financial/helpers.ts` -- roundCurrency, normalizeRate, normalizeAmount
- `packages/core/src/financial/fyc.ts` -- FYC, renewal, override
- `packages/core/src/financial/npv.ts` -- NPV, IRR
- `packages/core/src/financial/dcf.ts` -- DCF, book value
- `packages/core/src/financial/revenue.ts` -- Annual/monthly revenue, projections, cash flow
- `packages/core/src/financial/index.ts` -- Re-exports
- `packages/core/src/matching/fuzzy.ts` -- Levenshtein, fuzzyMatch, isSimilar
- `packages/core/src/matching/dedup.ts` -- Client/account/agent matching, findDuplicates, batchMatch
- `packages/core/src/matching/index.ts` -- Re-exports
- `packages/core/src/normalizers/field-normalizers.ts` -- FIELD_NORMALIZERS map, all alias maps
- `packages/core/src/users/modules.ts` -- USER_LEVELS, TOOL_SUITES, 39 MODULES, role templates, computeModulePermissions
- `packages/core/src/users/resolve.ts` -- resolveUser (sync + async)
- `packages/core/src/users/index.ts` -- Re-exports

### Modified (4 files)
- `packages/core/src/index.ts` -- Added matching, financial, users, collections exports
- `packages/core/src/normalizers/index.ts` -- Added normalizeData() dispatcher + all 16 normalizer functions
- `packages/core/src/types/index.ts` -- Expanded from 7 to 15 entity types + API/dedup/status types
- `packages/core/src/validators/index.ts` -- Expanded from 5 to 11 validators + rules engine + contact quality

**Total: 18 files, 3,787 insertions, 24 deletions**

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| External validation APIs not ported | Expected | Phone validator, NeverBounce, USPS, bank routing -- these are server-side API calls requiring secrets. They belong in `services/api/`, not `packages/core/`. |
| `normalizeData()` does not auto-derive `parent_carrier` | Low | GAS version calls `deriveParentCarrier()` which requires Sheets lookup. In toMachina, this should be a Firestore trigger or bridge-service enrichment. |
| `normalizeData()` does not auto-populate `naic_code` | Low | Same as above -- requires carrier lookup from Firestore, not a pure function concern. |
| Module count discrepancy | Info | Task said "46 MODULES" but GAS source has 39. Ported all 39 accurately. |
| `resolveUser` async mode untested | Low | Async Firestore lookup mode compiles but has no Firestore dependency in this package. Consumer must provide the lookup function. |

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Pure functions only in `@tomachina/core` | No Sheets API, no Firestore imports, no `UrlFetchApp`. Everything is testable without infrastructure. |
| `normalizeData()` is a dispatcher, not a pipeline | Matches GAS `normalizeData_()` behavior exactly. Each field normalized independently; failures preserve original. |
| External API validators excluded from port | Server-side APIs (PhoneValidator, NeverBounce, USPS, bankrouting.io) need API keys stored in env vars. They belong in `services/api/` middleware, not a shared package. |
| `resolveUser` has sync + async overloads | Sync mode accepts `UserRecord[]` for components that already have the user list. Async mode accepts `() => Promise<UserRecord[]>` for Firestore lookups. |
| Role templates and unit defaults ported | These are essential for the entitlement engine used by all 3 portals during sidebar rendering. |
| `UserSuiteDef` interface created | The `getToolSuitesForUser` return type needed a clean interface since `ToolSuiteDef.modules` is `string[]` (keys) but the returned object needs `ModuleDef[]` (full defs). |
| `FIRESTORE_COLLECTIONS` map added | Not in GAS source but essential for bridge service and data migration. Maps MATRIX tab names to Firestore collection paths including subcollection patterns. |

---

## GAS to TypeScript Translation Notes

1. **`var` to `const/let`** -- GAS uses `var` for module-level caching (GAS gotcha #7). Not relevant in TypeScript modules.
2. **`JSON.parse(JSON.stringify())` pattern** -- Not needed. TypeScript doesn't have GAS serialization bugs.
3. **Date handling** -- UTC getters preserved in `normalizeDate()` to prevent timezone shift (GAS gotcha #14).
4. **Empty string guard** -- `''.indexOf('')` returns 0 gotcha (GAS gotcha #12) preserved in matching functions via null guards.
5. **ZIP zero-padding** -- Preserved in `normalizeZip()` (GAS gotcha #13).
6. **`instanceof Date`** -- GAS fails across execution scopes. TypeScript version uses proper `instanceof` since we're in a single runtime.
7. **`{ success, data/error }` return pattern** -- Not used in pure functions (that's a GAS/API convention). Pure functions throw or return values directly. The matching functions return typed `MatchResult<T>` objects instead.
