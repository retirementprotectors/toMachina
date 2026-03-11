# Sprint 6 — Builder 61 Report: DEX Modernization

**Branch:** `sprint6/dex-modernization`
**Status:** COMPLETE — Build 11/11 successful

---

## Part 1: DEX Data Migration Scripts

3 scripts in `scripts/` to seed Firestore collections:

| Script | Collection | Records | Purpose |
|--------|-----------|---------|---------|
| `load-dex-forms.ts` | `dex_forms` | 38 forms | Form catalog (36 ACTIVE, 2 TBD) across 9 categories |
| `load-dex-mappings.ts` | `dex_field_mappings` | 30 mappings | Representative field definitions (structure for 300+) |
| `load-dex-rules.ts` | `dex_rules` | 15 rules | Kit assembly rules for GWM, RBC, VA, FIA, 401k combos |

Run: `npx tsx scripts/load-dex-forms.ts` (etc.)

---

## Part 2: DEX API Routes

**File:** `services/api/src/routes/dex.ts` (380 lines)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/dex/forms` | List forms (filter by source, category, document_type, status) |
| GET | `/api/dex/forms/:id` | Form detail + field mappings |
| POST | `/api/dex/forms` | Create form entry |
| PATCH | `/api/dex/forms/:id` | Update form |
| GET | `/api/dex/mappings` | List field mappings (filter by form_id, carrier) |
| POST | `/api/dex/mappings` | Create/update mapping |
| GET | `/api/dex/rules` | Get kit rules (filter by product_type, registration_type, action) |
| POST | `/api/dex/rules` | Create/update rule |
| POST | `/api/dex/kits/build` | Build kit: match rule, fetch forms + mappings, resolve client data, return layered form set |
| GET | `/api/dex/kits` | List generated kits (filter by client_id, status) |
| GET | `/api/dex/kits/:id` | Kit detail with forms |
| POST | `/api/dex/kits/:id/fill` | Fill PDF fields — resolves data sources, returns filled + missing fields |

**Kit Build Logic (the core DEX feature):**
1. Match rule by (product_type, registration_type, action)
2. Collect form IDs from 5 rule layers
3. Fetch form metadata + field mappings
4. Read client data from Firestore
5. Resolve data sources (client.*, firm.*, input.*, static.*)
6. Return layered form set with pre-filled values

---

## Part 3: DexDocCenter Shared Module Rewrite

**File:** `packages/ui/src/modules/DexDocCenter.tsx` (475 lines, complete rewrite)

**Tab 1: Pipeline** — 3-stage visualization (Intake → Processing → Filing) with real counts from `dex_kits` collection

**Tab 2: Form Library** — Full rebuild:
- Searchable/filterable grid of forms from `dex_forms`
- Category + status dropdown filters
- Click form → detail panel with field mapping list from `dex_field_mappings`
- Dynamic mapping load per selected form

**Tab 3: Kit Builder** — 5-step wizard (THE killer feature):
1. Select client (type-ahead search from `clients` collection)
2. Select parameters (platform, registration type, action)
3. Review selections
4. Build kit (calls `/api/dex/kits/build`)
5. View result (layered form set with form names per layer)

**Tab 4: Tracker** — Table of generated kits from `dex_kits` with client, platform, registration, form count, status, date

---

## Files Owned (7)

| File | Action |
|------|--------|
| `scripts/load-dex-forms.ts` | NEW |
| `scripts/load-dex-mappings.ts` | NEW |
| `scripts/load-dex-rules.ts` | NEW |
| `services/api/src/routes/dex.ts` | NEW |
| `services/api/src/server.ts` | MODIFIED (added dex import + mount) |
| `packages/ui/src/modules/DexDocCenter.tsx` | REWRITE |
| `SPRINT6_BUILDER_61_REPORT.md` | NEW |

## Not Touched
- Other shared modules, `apps/**` portal pages, `packages/core/**`, other API routes
