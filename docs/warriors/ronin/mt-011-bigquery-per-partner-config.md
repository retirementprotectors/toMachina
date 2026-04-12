# MT-011 — BigQuery Per-Partner Sink Configuration

> **Ticket:** `ZRD-PLAT-MT-011` | Sprint: `ZRD-PLAT-MT` | Author: RONIN, The Builder
> Related: `services/bigquery-stream/`, MT-001 (getDb helper), MT-008 (partner provisioning)

---

## Scope

Each named Firestore database streams to its own BigQuery dataset. Cross-partner rollups happen in BigQuery views, never via live cross-tenant Firestore access.

| Firestore DB | BigQuery Dataset |
|---|---|
| `(default)` | `toMachina` (existing) |
| `partner-midwest-medigap` | `partner_midwest_medigap` |
| `partner-<slug>` (future) | `partner_<slug_underscored>` |

BigQuery dataset names cannot contain hyphens, so the slug is converted to underscores (`midwest-medigap` → `midwest_medigap`).

---

## Architecture decision

Firebase Functions v2 `onDocumentWritten` triggers default to the `(default)` Firestore database. To attach a trigger to a named DB, the trigger declaration includes a `database` option. This is supported from `firebase-functions` v4.3+ (we're on 7.2.3).

## Two-surface implementation

1. **Code (this PR):** `services/bigquery-stream/src/index.ts` gets a factory function `makePartnerStream(databaseId, datasetId)` that returns two Cloud Function handles (top-level + subcollection). Per-partner exports are added in small blocks, one per partner, pointing at their named DB and dataset. The existing default-DB functions remain unchanged.

2. **GCP-side config (provisioning):** When the `onboard-partner` CLI (MT-008) provisions a new partner DB, the BQ dataset needs to exist before the streaming function can insert into it. Create it manually with `bq mk --dataset claude-mcp-484718:partner_<slug_underscored>` before enabling the partner's code block, then redeploy `services/bigquery-stream`.

   Recommended follow-up: add both steps (BQ dataset create + bigquery-stream redeploy) to MT-008's provisioning script so onboarding is truly one command.

---

## Per-partner dataset naming convention

Utility exposed by `services/bigquery-stream/src/index.ts`:

```
partnerDatasetName('midwest-medigap') === 'partner_midwest_medigap'
partnerDatasetName('acme-health')     === 'partner_acme_health'
```

Rule: `'partner_' + slug.replace(/-/g, '_')`.

---

## Dataset schema

All partner datasets carry the same schema as the existing `toMachina.firestore_changes` table:

| column | type | description |
|---|---|---|
| collection | STRING | Firestore collection path |
| document_id | STRING | Document ID |
| operation | STRING | `create`, `update`, `delete` |
| timestamp | TIMESTAMP | Event time |
| data_json | STRING | Post-write document JSON (or pre-delete for delete events) |
| changed_fields | STRING | CSV of changed field names |

This keeps cross-partner rollup views simple (one UNION ALL across datasets).

---

## Adding a new partner — checklist

When `npm run onboard-partner <slug> …` runs (MT-008):

1. Named Firestore DB `partner-<slug>` created by `gcloud firestore databases create`.
2. BigQuery dataset — `bq mk --dataset claude-mcp-484718:partner_<slug_underscored>`.
3. Add a per-partner block to `services/bigquery-stream/src/index.ts` using `makePartnerStream()` (template in the file).
4. Redeploy `services/bigquery-stream`.
5. Verify a test write to the partner DB shows up in its BQ dataset within 60 seconds.

Long-term (out of scope for this sprint), steps 2–4 should auto-generate from `partner_registry` so onboarding a new partner requires no manual code edit.

---

## Cross-partner analytics

All partner datasets plus the default dataset can be joined via BigQuery views. A view like `analytics.all_partner_clients` can `UNION ALL` the `clients` collection across every partner's `firestore_changes` table, tagged by partner slug. Matt's per-partner analytics query only his dataset; JDM's cross-portfolio analytics query the view. Clean separation at the BQ layer, no live cross-tenant Firestore access at runtime.

---

## Dependencies

| Ticket | Purpose | Status |
|---|---|---|
| MT-001 | `getDb()` helper | Landed (PR #353) |
| MT-008 | `onboard-partner` CLI creates the partner DB | In flight (PR #354) |
| MT-010 | Intake wire contract | This PR |
| Future | Auto-generation of per-partner BQ block from `partner_registry` | Follow-up sprint |

🗡️ — RONIN, The Builder
