# Sprint 7 -- Builder 71 Report: DEX Core Types + Field Mappings + Taxonomy

**Branch:** `sprint7/dex-core-types-mappings`
**Builder:** 71
**Status:** COMPLETE

---

## What Was Built

### Part 1: Core Types Package (`packages/core/src/dex/`)

Created 6 files comprising the full DEX core module:

| File | Lines | What It Does |
|------|-------|-------------|
| `types.ts` | ~230 | DexForm, DexFieldMapping (15 fields), DexRule (5 layers), DexKit, DexPackage, all enums (FieldType, InputType, MappingStatus, PipelineStatus, FormStatus, DeliveryMethod, RuleLayer), DataSourceNamespace, OptionPresetName, taxonomy types |
| `config.ts` | ~150 | All constants from DEX_Config.gs: PIPELINE_STATUSES, DELIVERY_METHODS, MAPPING_STATUSES, FORM_STATUSES, SOURCES, CATEGORIES, PLATFORMS (13), REGISTRATION_TYPES (7), ACCOUNT_ACTIONS (4), FIELD_TYPES, INPUT_TYPES, COLLECTIONS, FIRM_DATA |
| `mappings.ts` | ~220 | 10 option presets as typed arrays, buildUxConfig/buildUxConfigs, resolveDataSource with full 6-namespace support (client/account/advisor/firm/static/input), parseDataSource, validateMappings, formatFieldValue |
| `taxonomy.ts` | ~170 | Pure functions: filterByDomain, getCarriers, getCarriersByType, getCarrierById, getProducts, getProductsByCategory, getProductById, getAccountTypes, getAccountTypeById, getTransactions, getTransactionById, getTaxonomySummary |
| `rules.ts` | ~270 | evaluateRules(params, allForms) -> layered form list. TAF_MAP (13 platforms), addSchwabForms, addRBCForms, addDisclosures, checkConditions. All pure functions, no Firestore dependency. |
| `index.ts` | ~40 | Barrel export |

**Total:** ~1,080 lines of typed TypeScript.

Added `export * as dex from './dex'` to `packages/core/src/index.ts`.

### Part 2: API Enhancements (`services/api/src/routes/dex.ts`)

- **Enhanced GET `/mappings`**: Added `?ux=true` parameter that enhances each mapping with full UX config via `dex.buildUxConfig()`
- **Added GET `/mappings/presets`**: Returns all 10 option preset arrays from `@tomachina/core`
- **Added GET `/taxonomy/:type`**: Supports `carriers`, `products`, `accountTypes`, `transactions` with optional `?domain=HEALTH|WEALTH|BOTH` filter
- **Imported types from `@tomachina/core`**: Replaced local `FIRM_DATA` constant and `resolveDataSource` with core package versions
- **Replaced hardcoded collection names** with `dex.COLLECTIONS.*` constants

### Part 3: UI Enhancement (`packages/ui/src/modules/DexDocCenter.tsx`)

Enhanced the Form Library tab's field mapping detail panel (right side):
- **Input type badges**: Color-coded by type (text=blue, dropdown/radio/checkbox=purple, date=green, signature=red, ssn/phone/email=amber, currency/percent=sky)
- **Required badge**: Red "req" badge on required fields
- **Options display**: Shows up to 6 option chips for dropdowns/radios, with "+N more" overflow
- **Help text**: Shown in italic muted text below the field
- **Validation rules**: Displays min/max/minLength/maxLength when present
- **Added parsing helpers**: `parseOptions()` handles JSON string or array, `parseValidation()` handles JSON string or object
- **Expanded DexMapping interface** with help_text, options, validation, default_value, notes fields

### Part 4: Seed Scripts

| Script | Records | What It Seeds |
|--------|---------|--------------|
| `scripts/seed-dex-mappings.ts` | 300+ | Full 15-column field mappings across 20+ forms. Uses reusable blocks (personBlock, addressBlock, contactBlock, employmentBlock, idBlock, beneficiaryBlock, firmBlock, advisorBlock, signatureBlock) for consistency. |
| `scripts/seed-dex-taxonomy.ts` | 80+ | 27 carriers (Health + Wealth), 22 products (5 categories), 13 account types, 15 transaction types into 4 Firestore collections |

---

## Files Changed

### Created
- `packages/core/src/dex/types.ts`
- `packages/core/src/dex/config.ts`
- `packages/core/src/dex/mappings.ts`
- `packages/core/src/dex/taxonomy.ts`
- `packages/core/src/dex/rules.ts`
- `packages/core/src/dex/index.ts`
- `scripts/seed-dex-mappings.ts`
- `scripts/seed-dex-taxonomy.ts`
- `SPRINT7_BUILDER_71_REPORT.md`

### Modified
- `packages/core/src/index.ts` (added `export * as dex from './dex'`)
- `services/api/src/routes/dex.ts` (added presets + taxonomy endpoints, enhanced mappings, imported core types)
- `packages/ui/src/modules/DexDocCenter.tsx` (enhanced Form Library field mapping panel)

---

## Verification

- `npx tsc --noEmit --project packages/core/tsconfig.json` -- CLEAN
- `npx tsc --noEmit --project services/api/tsconfig.json` -- CLEAN
- `npx tsc --noEmit --project packages/ui/tsconfig.json` -- CLEAN
- `npm run build` -- 11/11 tasks successful (36s)

---

## Files NOT Touched (per scope)

- `services/api/src/server.ts` (Builder 72)
- `services/api/src/routes/webhooks.ts` (Builder 72)
- `DexDocCenter.tsx` Pipeline/Kit Builder/Tracker tabs (Builder 72)
- `packages/core/src/campaigns/` (Builder 73)
- `packages/ui/src/modules/C3Manager.tsx` (Builder 73)
- `apps/**` (portal pages)
