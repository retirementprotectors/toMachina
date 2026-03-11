# Builder 3 Report -- 2026-03-10

> Scope: Core Business Logic Port (Phase 1.4)
> Builder: Claude Opus 4.6 (worktree)
> Plan: `~/.claude/plans/valiant-napping-waterfall.md`
> Source: RAPID_CORE GAS files (read-only)

## Status: IN PROGRESS

## Checkpoint 1 -- Source Analysis Complete

### FIELD_NORMALIZERS (CORE_Database.gs ~line 1278)
- **16 normalizer types**: name, phone, email, date, state, zip, amount, carrier, product, product_name, plan_name, imo, status, bob, address, city, skip
- **91 field mappings** (already ported in field-normalizers.ts -- VERIFIED match with GAS source)
- Existing normalizers/index.ts has all 16 types implemented (7 basic + 9 extended)

### CORE_Match.gs
- **Functions**: matchClient, matchAccount, matchAgent, calculateNameScore, calculateMatchScore, fuzzyMatch, levenshteinDistance, isSimilar, findDuplicates, batchMatch
- **Scoring weights**: Name = 60% last + 40% first, fuzzy threshold 75 (client), 85 (agent)
- **Match thresholds**: SSN+name=100, email=95, phone+lastname=90, name+DOB=85, fuzzy>=75

### CORE_Financial.gs
- **Functions**: calculateFYC, calculateRenewal, calculateOverride, calculateAnnualRevenue, calculateMonthlyRevenue, projectRevenue, projectCashFlow, calculateNPV, calculateIRR, calculateBookValue, calculateDCF
- **Helpers**: _roundCurrency, _normalizeRate, _normalizeAmount

### CORE_Entitlements.gs
- **USER_LEVELS**: 4 (OWNER=0, EXECUTIVE=1, LEADER=2, USER=3)
- **TOOL_SUITES**: 5 (RAPID_TOOLS, DAVID_TOOLS, RPI_TOOLS, PIPELINES, ADMIN_TOOLS)
- **MODULES**: 46 total
  - RAPID_TOOLS: 11 (ATLAS, C3, CAM, DEX, MCP_HUB, MY_RPI, RAPID_IMPORT, CONTRACT_GENERATOR, LC3, PROPOSAL_MAKER, TOMIS)
  - DAVID_TOOLS: 6 (DAVID_HUB, SENTINEL_V2, SENTINEL_DEALS, SENTINEL_PRODUCERS, SENTINEL_ANALYSIS, SENTINEL_ADMIN)
  - RPI_TOOLS: 14 (PRODASH, QUE_MEDICARE, QUE_ANNUITY, QUE_LIFE, QUE_MEDSUP, PRODASH_CLIENTS, PRODASH_ACCOUNTS, PRODASH_PIPELINES, PRODASH_CAMPAIGNS, RMD_CENTER, BENI_CENTER, DISCOVERY_KIT, PRODASH_ACTIVITY, PRODASH_ADMIN)
  - PIPELINES: 5 (DATA_MAINTENANCE, OFFBOARDING, ONBOARDING, SECURITY, TECH_MAINTENANCE)
  - ADMIN_TOOLS: 3 (ORG_STRUCTURE, PERMISSIONS, RPI_COMMAND_CENTER)
  - **By status**: active=39, planned=7 (TOMIS, PROPOSAL_MAKER, CONTRACT_GENERATOR, LC3, QUE_LIFE, QUE_ANNUITY, QUE_MEDSUP)
- **resolveUser()**: In CORE_UserResolve.gs. Accepts email/slack_id/name/alias. Match priority: email > slack_id > first+last name > aliases[] > fuzzy first name
- **Key functions**: evaluateAccess, userHasModuleAccess, getUserAccessibleModules, getToolSuitesForUser, getUserEntitlements, getEntitlementsForPlatform, validateScopedAdmin, getScopedUsers

### CORE_Validation_API.gs
- **Functions**: validatePhoneAPI, validateEmailAPI, validateAddressAPI, lookupCityStateAPI, lookupRoutingNumberAPI, scoreContactQuality
- **Decision**: These are external API wrappers (GAS-specific with UrlFetchApp). Port as TYPE DEFINITIONS only -- actual API calls will be in services/api. Validation rules (format checks) already ported in validators/index.ts.

### TABLE_ROUTING (CORE_Database.gs)
- **Total tabs**: ~80 across 3 platforms
- PRODASH: 18 tabs (clients, accounts, pipelines, campaigns, etc.)
- SENTINEL: 4 tabs (agents, producers, opportunities, revenue)
- RAPID: ~58 tabs (carriers, products, config, ATLAS, FLOW, etc.)

### Existing Code State
- `types/index.ts`: 7 entity types + UserLevel + Entitlement (needs expansion)
- `validators/index.ts`: 5 validators (email, phone, NPI, zip, SSN last 4) -- COMPLETE
- `normalizers/index.ts`: All 16 normalizer types implemented -- COMPLETE
- `normalizers/field-normalizers.ts`: Full 91-field map + all alias maps -- COMPLETE
- `matching/`, `financial/`, `users/`, `collections/` -- EMPTY directories

### What Needs Building
1. `matching/fuzzy.ts` -- Levenshtein + fuzzyMatch + isSimilar
2. `matching/dedup.ts` -- matchClient, matchAccount, matchAgent, calculateNameScore, calculateMatchScore, findDuplicates, batchMatch
3. `financial/fyc.ts` -- calculateFYC, calculateRenewal, calculateOverride
4. `financial/npv.ts` -- calculateNPV, calculateIRR
5. `financial/dcf.ts` -- calculateDCF, calculateBookValue
6. `financial/revenue.ts` -- calculateAnnualRevenue, calculateMonthlyRevenue, projectRevenue, projectCashFlow
7. `users/resolve.ts` -- resolveUser (sync with array, async with Firestore)
8. `users/modules.ts` -- 46 MODULE defs, 5 TOOL_SUITES, 4 USER_LEVELS, evaluateAccess
9. `collections/index.ts` -- TABLE_ROUTING collection map
10. `types/index.ts` -- Expand with Module, ToolSuite, UserLevelDef types
11. `index.ts` -- Re-export everything
