# Data Audit Report — All Other Collections (Builder 3)

> Generated: 2026-03-11T06:59:27.583Z
> Scope: All collections EXCEPT `clients` and `clients/*/accounts`

## 1a. Collection Inventory

| Collection | Path | Docs | Fields | Errors |
|-----------|------|------|--------|--------|
| carriers | `carriers` | 164 | 13 | - |
| products | `products` | 325 | 14 | - |
| users | `users` | 15 | 23 | - |
| org | `org` | 22 | 14 | - |
| agents | `agents` | 17 | 13 | - |
| opportunities | `opportunities` | 615 | 24 | - |
| revenue | `revenue` | 2274 | 12 | - |
| campaigns | `campaigns` | 53 | 15 | - |
| templates | `templates` | 277 | 18 | - |
| content_blocks | `content_blocks` | 273 | 16 | - |
| pipelines | `pipelines` | 22 | 12 | - |
| case_tasks | `case_tasks` | 15 | 15 | - |
| activities | `activities` | 23 | 12 | - |
| communications | `communications` | 4 | 12 | - |
| source_registry | `source_registry` | 0 | 0 | - |
| producers | `producers` | 0 | 0 | - |
| flow/config/pipelines | `flow/config/pipelines` | 24 | 15 | - |
| flow/config/instances | `flow/config/instances` | 610 | 19 | - |

**Total: 4733 documents across 18 collection paths**

### carriers (164 docs, 13 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `aliases` | 158/164 | 96% |
| `product_types` | 158/164 | 96% |
| `naic_code` | 81/164 | 49% |

### products (325 docs, 14 fields)

All fields present in all docs (100% coverage).

### users (15 docs, 23 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `created_at` | 14/15 | 93% |
| `job_title` | 13/15 | 87% |
| `division_id` | 12/15 | 80% |
| `aliases` | 12/15 | 80% |
| `reports_to` | 11/15 | 73% |
| `slack_id` | 9/15 | 60% |
| `unit_id` | 8/15 | 53% |

### org (22 docs, 14 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `parent_id` | 20/22 | 91% |
| `slack_channel_id` | 8/22 | 36% |

### agents (17 docs, 13 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `last_name` | 16/17 | 94% |
| `first_name` | 16/17 | 94% |
| `updated_at` | 14/17 | 82% |
| `status` | 14/17 | 82% |
| `agent_id` | 4/17 | 24% |
| `created_at` | 4/17 | 24% |
| `gdrive_folder_url` | 2/17 | 12% |

### opportunities (615 docs, 24 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `updated_at` | 614/615 | 100% |
| `created_at` | 612/615 | 100% |
| `opportunity_type` | 608/615 | 99% |
| `opportunity_id` | 608/615 | 99% |
| `name` | 608/615 | 99% |
| `value` | 607/615 | 99% |
| `ghl_opportunity_id` | 606/615 | 99% |
| `client_id` | 572/615 | 93% |
| `assigned_to` | 382/615 | 62% |
| `deal_id` | 7/615 | 1% |
| `entity_name` | 6/615 | 1% |
| `deal_type` | 6/615 | 1% |
| `spreadsheet_id` | 6/615 | 1% |
| `spreadsheet_url` | 6/615 | 1% |
| `folder_url` | 4/615 | 1% |
| `folder_id` | 4/615 | 1% |
| `stage_id` | 3/615 | 0% |
| `pipeline_id` | 3/615 | 0% |
| `notes` | 2/615 | 0% |
| `due_date` | 2/615 | 0% |

### revenue (2274 docs, 12 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `type` | 2272/2274 | 100% |
| `agent_id` | 2257/2274 | 99% |
| `client_name` | 2237/2274 | 98% |
| `account_id` | 1976/2274 | 87% |

### campaigns (53 docs, 15 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `division` | 49/53 | 92% |
| `pillar` | 49/53 | 92% |
| `name` | 49/53 | 92% |
| `type` | 49/53 | 92% |
| `frequency` | 49/53 | 92% |
| `status` | 49/53 | 92% |
| `cadence_series` | 48/53 | 91% |
| `description` | 48/53 | 91% |
| `bob_id` | 2/53 | 4% |
| `trigger_bob` | 1/53 | 2% |
| `trigger_client_status` | 1/53 | 2% |

### templates (277 docs, 18 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `touchpoint_day` | 276/277 | 100% |
| `channel` | 276/277 | 100% |
| `touchpoint` | 276/277 | 100% |
| `updated_at` | 265/277 | 96% |
| `created_at` | 265/277 | 96% |
| `cta_block` | 223/277 | 81% |
| `greeting_block` | 223/277 | 81% |
| `signature_block` | 223/277 | 81% |
| `compliance_block` | 213/277 | 77% |
| `value_prop_block` | 170/277 | 61% |
| `subject_block` | 160/277 | 58% |
| `pain_point_block` | 160/277 | 58% |
| `intro_block` | 117/277 | 42% |

### content_blocks (273 docs, 16 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `character_count` | 272/273 | 100% |
| `owner` | 271/273 | 99% |
| `version` | 271/273 | 99% |
| `updated_at` | 271/273 | 99% |
| `status` | 271/273 | 99% |
| `notes` | 267/273 | 98% |

### pipelines (22 docs, 12 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `ghl_pipeline_id` | 19/22 | 86% |
| `unit` | 19/22 | 86% |

### case_tasks (15 docs, 15 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `completed_date` | 2/15 | 13% |

### activities (23 docs, 12 fields)

All fields present in all docs (100% coverage).

### communications (4 docs, 12 fields)

All fields present in all docs (100% coverage).

### flow/config/pipelines (24 docs, 15 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `pipeline_description` | 2/24 | 8% |

### flow/config/instances (610 docs, 19 fields)

**Inconsistent fields** (not present in all docs):

| Field | Present In | % Coverage |
|-------|-----------|-----------|
| `entity_id` | 574/610 | 94% |
| `created_by` | 384/610 | 63% |
| `assigned_to` | 384/610 | 63% |
| `pipeline_key` | 5/610 | 1% |
| `current_stage` | 5/610 | 1% |
| `current_step` | 2/610 | 0% |

## 1b. FK Integrity — Cross-Collection

| FK Check | Checked | Valid | Broken | % Valid |
|----------|---------|-------|--------|---------|
| opportunities.client_id -> clients | 572 | 566 | 6 | 99% |
| opportunities.agent_id -> agents | 0 | 0 | 0 | 0% |
| revenue.agent_id -> agents | 2257 | 0 | 2257 | 0% |
| revenue.carrier_name -> carriers | 0 | 0 | 0 | 0% |
| case_tasks.client_id -> clients | 15 | 15 | 0 | 100% |
| case_tasks.assigned_to -> users | 15 | 0 | 15 | 0% |
| products.carrier_id -> carriers | 325 | 325 | 0 | 100% |

### opportunities.client_id -> clients

Broken references (first 20):
- `0612cd98-e23f-4c9d-9539-6edb431f6ff9 -> 61db11ce-9911-48cf-a2ac-c79e74242cb0`
- `0b99385b-1e58-4f58-8c07-3192de4960f9 -> 238fcf1e-6373-419d-bd3c-0fc96e2a2394`
- `178212ef-4770-4d14-8370-0ff0d4a9819d -> a022675e-5fda-4d55-a7b8-45ebf2b0d8ae`
- `4b4a573e-f492-422f-b592-711ef956de4f -> f373d8b7-2240-45dd-b9ca-425829c5bdbf`
- `7e065b0d-aa60-4704-8d80-48033ff265fa -> c6d4c245-8a42-4ab9-9ccd-ad5a406d074f`
- `adf516d2-d78b-49b3-aa6d-9d5b46686a3a -> d2a9d734-8b22-4e30-a327-01f8dc682cdb`

### revenue.agent_id -> agents

Broken references (first 20):
- `000e287a-5044-464f-8075-222fbb532071 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `00db5235-5301-4e11-a25d-6233fde36b5d -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `010af0cd-b1ab-42f2-b308-afd786a0b405 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `011a6ebd-6a17-4be0-a558-49013f5e35cb -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `014542d8-e301-432f-ad2a-252f8fa7abc8 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `0146fe69-5239-4070-b994-a374d14408d1 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `015f6326-234c-46df-b54a-a4d9e429f188 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `01883226-6885-4d34-9a76-8d9a7a2b2de5 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `018e5a52-411b-4360-8845-7bb0cd85aa27 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `01bfd027-fbdd-424d-9985-d27be0cd89a8 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `01d3641e-0d28-4696-8873-0d99d11f8a25 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `01df2636-f513-44c9-9cc4-369f2f26fe4b -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `01f041a3-6ab4-4c26-be89-5b3c23d63108 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `0208c927-b0cf-4b62-b602-fea95db6467f -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `020d24f6-7a3d-43cd-8544-a000cacfd2c2 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `023b8db9-f380-4a09-9ad6-9e024a613fd5 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `02580bc0-b538-4513-88af-1e86eec3451b -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `02583f7f-0e50-4249-bfa0-6898bd95de66 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `029281a1-cd84-4dc1-b91b-2332e18d6fa0 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- `02ef3b63-7873-463b-8adf-98cf417dd861 -> a8f2252f-aec9-4b66-a0b5-db98e4ff0396`
- ... and 2237 more

### case_tasks.assigned_to -> users

Broken references (first 20):
- `178eb59a-8b51-4f33-aceb-f3728dcc8e7d -> josh.d.millang@retireprotected.com`
- `218472d0-0d74-4b59-ae72-d8e01a08f1a5 -> josh.d.millang@retireprotected.com`
- `35594b3d-8afb-40dc-b771-4e2b291580d9 -> josh.d.millang@retireprotected.com`
- `4f6fb734-8f1c-437f-9c33-76c4ffef6ae7 -> josh.d.millang@retireprotected.com`
- `58a7c767-d500-4301-848c-00e9cc4a250b -> josh.d.millang@retireprotected.com`
- `66225e57-8a13-4301-a04c-1d64b6e764ab -> josh.d.millang@retireprotected.com`
- `6f0d7e01-f335-4118-9ba1-e19c5a9e93f4 -> josh.d.millang@retireprotected.com`
- `870e8e1d-0fda-45da-9afa-08890baca510 -> josh.d.millang@retireprotected.com`
- `8b661a43-b720-4a3a-a417-89c79a99a224 -> josh.d.millang@retireprotected.com`
- `9a16146b-befb-4b8a-9ccb-25fb347e4dde -> josh.d.millang@retireprotected.com`
- `9e44221b-625f-49bc-bfd1-edcad0c93069 -> josh.d.millang@retireprotected.com`
- `a1652986-db5e-48b6-b3d7-181718e22645 -> josh.d.millang@retireprotected.com`
- `efe02aa2-8baa-4614-9007-e2fddda7071c -> josh.d.millang@retireprotected.com`
- `f14428ea-6377-4171-a2ef-3d5736cbb90b -> josh.d.millang@retireprotected.com`
- `ff1bec48-6c72-4262-bb30-def84a4253c9 -> josh.d.millang@retireprotected.com`

## 1c. Reference Data Completeness

- AGENT DUP NPN: "TEST123" appears in 2 docs: 9e372ee0-a491-42f2-9cfd-ed2da64eb827, e30de5ac-a693-4769-9150-e8af3ef18e5a

## 1d. Missing / Extra Collections

### Missing (TABLE_ROUTING tab with no Firestore data)
- _SOURCE_REGISTRY -> source_registry (not found or empty in Firestore)
- _TOOL_REGISTRY -> tool_registry (not found or empty in Firestore)
- _IMO_MASTER -> imos (not found or empty in Firestore)
- _ACCOUNT_TYPE_MASTER -> account_types (not found or empty in Firestore)
- _MAPD_COMP_GRID -> comp_grids/mapd (not found or empty in Firestore)
- _LIFE_COMP_GRID -> comp_grids/life (not found or empty in Firestore)
- _ANNUITY_COMP_GRID -> comp_grids/annuity (not found or empty in Firestore)
- _MEDSUP_COMP_GRID -> comp_grids/medsup (not found or empty in Firestore)

### Extra (Firestore collection with no TABLE_ROUTING mapping)
None.

## 1e. Revenue Data Quality

| Metric | Value |
|--------|-------|
| Total docs | 2274 |
| Total amount (sum) | $4,444,839.90 |
| Valid amounts (> 0) | 1910 |
| Zero amounts | 9 |
| Negative amounts | 355 |
| Non-numeric amounts | 0 |
| Has agent_id | 2257 |
| Missing agent_id | 17 |
| Has carrier_name | 0 |
| Missing carrier_name | 2274 |
| Has period/date | 2274 |
| Missing period/date | 0 |

### Revenue Type Distribution

| Type | Count |
|------|-------|
| FYC | 1385 |
| OVR | 674 |
| REN | 212 |
| UNKNOWN | 2 |
| commission | 1 |
