# Wire Library Edge Cases — MEGAZORD OPERATE Audit (ZRD-O07)

> Audited: 2026-04-05 | Auditor: RONIN | All 8 E2E test files verified present

## E2E Coverage Matrix

| Wire | Test File(s) | Coverage Type |
|------|-------------|---------------|
| `WIRE_DATA_IMPORT` | cluster2-intake, cluster3-atlas | Full chain + structural |
| `WIRE_COMMISSION_SYNC` | cluster2-intake (partial) | Via SPC intake path |
| `WIRE_REFERENCE_SEED` | cluster4-data-sync (NAIC dry-run) | Dry-run only |
| `WIRE_INCOMING_CORRESPONDENCE` | mail-intake, acf-scan | Full chain (mail path) |
| `WIRE_ACF_CLEANUP` | cluster8-acf-lifecycle, acf-upload | Structural + upload flow |

## Known Edge Cases by Wire

### WIRE_DATA_IMPORT
- **Date formats**: Carriers use MM/DD/YYYY, YYYY-MM-DD, M/D/YY inconsistently. The normalizer handles all three but logs a warning for 2-digit years.
- **Encoding**: Some carrier CSVs export as UTF-16LE with BOM. SUPER_EXTRACT strips BOM but UTF-16 requires explicit detection.
- **Empty rows**: Carriers pad CSVs with trailing empty rows. SUPER_VALIDATE filters these but they inflate `records_in` counts.
- **Merged cells**: XLSX exports with merged headers break column mapping. SUPER_EXTRACT flattens merges but loses multi-line header context.
- **Carrier-specific**: Athene commission CSVs use semicolon delimiters. National Western uses pipe delimiters.

### WIRE_COMMISSION_SYNC
- **Negative amounts**: Chargebacks appear as negative `gross_commission`. SUPER_VALIDATE flags but does not reject — allows negative revenue records.
- **Split commissions**: Some carriers report split commissions on separate rows (agent + override). SUPER_MATCH must correlate by policy_number.
- **Currency formatting**: Carriers inconsistently use `$1,234.56` vs `1234.56` vs `(1,234.56)` for negatives. Normalizer strips all formatting.
- **Penny rounding**: IEEE 754 float precision issues. All commission amounts stored as cents (integer) internally, converted to dollars on display.

### WIRE_REFERENCE_SEED
- **NAIC code changes**: Carriers occasionally change NAIC codes after mergers. SUPER_MATCH uses carrier name + state as fallback dedup key.
- **Product discontinuation**: Seeding does not auto-archive products. Stale products must be manually flagged.
- **Rate table versioning**: Multiple rate tables per product (by effective date). SUPER_WRITE upserts by product_id + effective_date composite key.

### WIRE_INCOMING_CORRESPONDENCE
- **Multi-document PDFs**: Physical mail scans often contain multiple documents in a single PDF. SUPER_CLASSIFY handles boundary detection but accuracy drops below 85% for pages with mixed orientations.
- **Handwritten content**: Claude Vision can read printed text but struggles with cursive handwriting. Flagged for manual review automatically.
- **Fax artifacts**: Fax transmittal sheets create false positives in classification. Known pattern: skip pages with "FAX TRANSMITTAL" header.
- **Low-resolution scans**: Below 200 DPI, OCR accuracy drops significantly. SUPER_PREPARE logs a warning but does not halt.

### WIRE_ACF_CLEANUP
- **Permission errors**: Legacy Google Drive folders may have incompatible sharing settings. SUPER_FOLDER_CLEANUP catches 403 errors and logs but continues with next client.
- **Orphan files**: Files in root ACF folder (not in any subfolder) are routed to "Reactive" subfolder by default.
- **Duplicate detection**: File dedup uses SHA-256 hash + filename. Same-content different-name files are flagged but not auto-merged.

## Test File Verification (8/8 present)

- [x] `tests/e2e/intake/cluster2-intake.test.ts`
- [x] `tests/e2e/atlas/cluster3-atlas.test.ts`
- [x] `tests/e2e/data-sync/cluster4-data-sync.test.ts`
- [x] `tests/e2e/acf/cluster8-acf-lifecycle.test.ts`
- [x] `tests/e2e/intake/acf-scan.test.ts`
- [x] `tests/e2e/intake/acf-upload.test.ts`
- [x] `tests/e2e/intake/mail-intake.test.ts`
- [x] `tests/e2e/intake/spc-intake.test.ts`

## Gaps Identified

1. **No isolated SUPER_TOOL E2E tests** — Super tools are tested within wire chains but not independently
2. **WIRE_COMMISSION_SYNC** lacks a dedicated full-chain E2E test (covered partially via SPC intake)
3. **WIRE_REFERENCE_SEED** only has dry-run coverage in cluster4
4. **No multi-carrier format tests** — Each test uses one carrier format; spec calls for 2+ per wire
