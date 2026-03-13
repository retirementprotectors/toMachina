# Client Data Integrity Verification Report - 2026-03-11

## Executive Summary

**Overall Status: PASS**

| Metric | Before (Phase 1) | After (Phase 3) | Delta |
|--------|-----------------|-----------------|-------|
| Total clients | 5019 | 5019 | +0 |
| Avg quality score | 72.5 | 72.5 | +0.0 |
| client_classification populated | 0% | 100% | +100% |
| status populated | 99.5% | 100% | +0.5% |
| created_at populated | 100% | 100% | +0.0% |
| Broken agent FKs | 1 | 1 | 0 |
| Duplicate GHL IDs | 57 | 57 | 0 |
| Email dup groups | 209 | 209 | 0 |
| Phone dup groups | 347 | 347 | 0 |
| Name+DOB dup groups | 1 | 1 | 0 |

## Phase 3 Fix Results

- **Documents touched by Phase 3**: 5019 of 5019
- **status canonicalized**: 4993 → 5019
- **client_status canonicalized**: Before had 4993 populated → now 5019
- **client_classification backfilled**: 0 → 5019 (was 0% populated)
- **created_at backfilled**: 5018 → 5019

### Classification Distribution

| Classification | Count | % |
|---------------|-------|---|
| Client | 4523 | 90.1% |
| Inactive | 301 | 6.0% |
| Prospect | 92 | 1.8% |
| Active - No Accounts | 74 | 1.5% |
| Unclassified | 29 | 0.6% |

### Status Distribution (after canonicalization)

| Status | Count | % |
|--------|-------|---|
| Active | 4597 | 91.6% |
| Inactive | 301 | 6.0% |
| Prospect | 92 | 1.8% |
| Unknown | 26 | 0.5% |
| Inactive - Duplicate | 3 | 0.1% |

### Client Status Distribution (after canonicalization)

| Client Status | Count | % |
|--------------|-------|---|
| Active | 4592 | 91.5% |
| Inactive - No Active Accounts | 127 | 2.5% |
| Prospect | 92 | 1.8% |
| Inactive - Deceased | 78 | 1.6% |
| Inactive - Fired | 62 | 1.2% |
| Inactive | 32 | 0.6% |
| Unknown | 26 | 0.5% |
| Active - Affiliate Ok | 5 | 0.1% |
| Active - Affiliate Do Not Market | 3 | 0.1% |
| Inactive - Complaint | 2 | 0.0% |

## Field Completeness (Before vs After)

| Field | Before | After | Delta |
|-------|--------|-------|-------|
| first_name | 100% (5017) | 100% (5017) | — |
| last_name | 100% (5018) | 100% (5018) | — |
| email | 35.2% (1769) | 35.2% (1769) | — |
| phone | 76.1% (3819) | 76.1% (3819) | — |
| dob | 85.7% (4299) | 85.7% (4299) | — |
| ssn_last4 | 0% (0) | 0% (0) | — |
| status | 99.5% (4993) | 100% (5019) | +0.5% |
| client_status | 99.5% (4993) | 100% (5019) | +0.5% |
| client_classification | 0% (0) | 100% (5019) | +100.0% |
| state | 87.9% (4410) | 87.9% (4410) | — |
| zip | 87.3% (4381) | 87.3% (4380) | — |
| city | 73.4% (3685) | 73.4% (3685) | — |
| address | 72.9% (3661) | 72.9% (3661) | — |
| source | 0.1% (5) | 0.1% (5) | — |
| created_at | 100% (5018) | 100% (5019) | — |
| updated_at | 100% (5018) | 100% (5018) | — |
| book_of_business | 95.1% (4773) | 95.1% (4773) | — |
| agent_id | 0% (2) | 0% (2) | — |

## Quality Score Distribution (Before vs After)

| Metric | Before | After |
|--------|--------|-------|
| Average | 72.5 | 72.5 |

| Bucket | Before | After | Delta |
|--------|--------|-------|-------|
| 0-20 | 1 | 1 | +0 |
| 21-40 | 547 | 543 | -4 |
| 41-60 | 623 | 624 | +1 |
| 61-80 | 2322 | 2324 | +2 |
| 81-100 | 1526 | 1527 | +1 |

## Remaining Data Gaps (Not Fixed by Phase 3)

These fields were not in scope for Phase 3. They represent pre-existing data gaps from the source Sheets:

- **email**: 35.2% populated (3250 empty)
- **phone**: 76.1% populated (1200 empty)
- **dob**: 85.7% populated (720 empty)
- **ssn_last4**: 0% populated (5019 empty)
- **state**: 87.9% populated (609 empty)
- **zip**: 87.3% populated (639 empty)
- **city**: 73.4% populated (1334 empty)
- **address**: 72.9% populated (1358 empty)
- **source**: 0.1% populated (5014 empty)
- **agent_id**: 0% populated (5017 empty)

---
*Generated 2026-03-11T07:26:16.587Z by verify-clients.ts (read-only) in 6.3s*