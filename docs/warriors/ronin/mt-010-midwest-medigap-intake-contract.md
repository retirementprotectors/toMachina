# MT-010 — Midwest Medigap Intake Wire Contract

> **Ticket:** `ZRD-PLAT-MT-010` | Sprint: `ZRD-PLAT-MT` | Author: RONIN, The Builder
> Related: PR #345 (intake field mapper spec), MT-001 (getDb helper), MT-008 (partner provisioning)

---

## Scope clarification

PR #345 is documentation-only. It describes how Midwest Medigap's carrier-direct BoB exports map into our Firestore schema. It is not executable wire code. MEGAZORD will build the executing wire after MT-001/MT-008 land.

MT-010's deliverable is the contract the executing wire must satisfy. This document is that contract. The ATLAS `tool_registry` seed lands with MEGAZORD's executing-wire sprint so the wire-def doesn't point at nonexistent code.

---

## The contract

### 1. Write target — partner DB only

Every tenant-scoped collection write MUST route to the named Firestore database `partner-midwest-medigap` via the `getDb(slug)` helper in `services/api/src/lib/db.ts`. Never write tenant data with `getFirestore()` (which implicitly targets default).

If the wire accidentally hits default, the cross-tenant isolation test suite (MT-012) catches it and blocks merge.

### 2. Per-partner collections (go to partner DB)

Per Discovery Doc Tab 2:

- `clients` + `clients/*/accounts` + `clients/*/access_items`
- `households`, `revenue`, `opportunities`, `communications`
- `case_tasks`, `activities`, `approval_queue`, `campaign_enrollments`
- `mdj_conversations`, `wire_executions` (immutable audit), `dex_packages` (+ events)
- `org` (partner's own team roster — distinct from RPI's `org` in default)

### 3. Shared-catalog collections (stay in default)

Read-only from the partner's perspective. If the intake needs to reference these, use `getDefaultDb()`:

- `carriers`, `products`, `campaigns`, `templates`, `content_blocks`
- `users` (single auth pool)
- `source_registry`, `tool_registry` (ATLAS)
- `partner_registry` (tenant directory — only written by MT-008 CLI)

### 4. `partner_id` parameter in the ATLAS wire definition

The `tool_registry` entry for this wire must include a `partner_id` parameter of type `string`. For Midwest Medigap the default is `'midwest-medigap'`. Future partners' intake wires copy the shape and set their own slug as default. Parameterization lets MEGAZORD compose the Data Import Ranger across partners without hard-coded tenant context — the wire-def carries the slug, `getDb(slug)` does the routing.

### 5. Audit log

Every `wire_executions` row for a run of this wire goes to `partner-midwest-medigap`, not default. Same `getDb(slug)` pattern applies to the audit write.

Per MT-009's template, `wire_executions` is immutable after create — rule blocks update and delete. Audit integrity is enforced at the rules layer, not the application layer.

### 6. BigQuery streaming

Separate concern wired by MT-011 (see `mt-011-bigquery-per-partner-config.md`). When the wire writes to the partner DB, the streaming pipeline lands the change in BigQuery dataset `partner_midwest_medigap`. No change to the wire itself — streaming is a separate factory in `services/bigquery-stream/` keyed on the named DB id.

---

## Acceptance criteria for the executing wire (when MEGAZORD builds it)

- All tenant-data writes use `getDb('midwest-medigap')`.
- Shared-catalog reads use `getDefaultDb()` or `getDb()`.
- A smoke-test client record appears in `partner-midwest-medigap` clients, not in default clients.
- Wire-def is registered in `tool_registry` with `partner_id: 'midwest-medigap'` default.
- MT-012 cross-tenant isolation tests pass against Cloud Run after 5 sample records run.
- JDM signs off per Discovery Doc Gate 4.

---

## Dependencies

| Ticket | Purpose | Status |
|---|---|---|
| MT-001 | `getDb()` helper | Landed (PR #353) |
| MT-002 | `req.partnerId` middleware | Landed (PR #353) |
| MT-008 | `onboard-partner` CLI | In flight (PR #354) |
| MT-009 | Partner rules template | In flight (PR #354) |
| MT-011 | BigQuery per-partner sink | This PR |
| MEGAZORD executing wire | Actual intake write code | Follow-up sprint |

🗡️ — RONIN, The Builder
