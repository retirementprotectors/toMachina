# VOL-C07: Specialist Configs Audit — Recommendation for JDM

> VOLTRON CONSUME Track | Date: 2026-04-05 | Author: RONIN

---

## Two Collections, Two Purposes

### `specialist_configs` — ProZone Field Scheduling
- **API**: `services/api/src/routes/specialist-configs.ts` (118 lines, full CRUD)
- **UI**: `packages/ui/src/modules/ProZone/SpecialistConfigEditor`
- **Schema**: `config_id`, `specialist_name`, `territory_id`, `origin_zip`, `tier_map[]`, `office_days[]`, `field_days[]`, `slot_templates[]`, `meeting_criteria{}`, `zone_lead_criteria{}`, `team[]`, `status`, `created_at`, `updated_at`
- **Purpose**: Field operations scheduling — territories, drive times, meeting slots. NOT AI routing.
- **Referenced by**: ProZone module only

### `mdj_specialist_configs` — VOLTRON Lions Routing
- **API**: `services/api/src/routes/mdj.ts` line 299 (`GET /api/mdj/specialists`)
- **UI**: MDJPanel (chat specialist picker)
- **Schema**: `specialist_name`, `display_name`, `icon`, `routing_keywords[]`, `required_level`, `status`
- **Purpose**: VOLTRON AI routing — determines which Lion handles a query based on keywords
- **Referenced by**: MDJ chat routing, MDJPanel specialist selector
- **Seeded by**: `services/api/src/scripts/seed-mdj-specialists.ts`

---

## Are They the Same Data?

**No.** These are completely different data structures serving completely different purposes:

| Attribute | `specialist_configs` | `mdj_specialist_configs` |
|---|---|---|
| Purpose | Field scheduling | AI routing |
| Schema overlap | None | None |
| UI consumer | ProZone | MDJPanel |
| API consumer | specialist-configs routes | mdj routes |
| The 5 Lions | Not represented | Yes — general, medicare, securities, service, david, ops |

**Note**: The current `mdj_specialist_configs` uses the OLD specialist names (general, medicare, securities, service, david, ops) — NOT the new 5 Lions (Medicare, Annuity, Investment, Life-Estate, Legacy-LTC). This is a gap that Track 2 (OPERATE) must address.

---

## Recommendation

**Keep both collections. They are NOT duplicates.**

| Action | Rationale |
|---|---|
| **Keep `specialist_configs`** as-is | ProZone field scheduling — unrelated to VOLTRON |
| **Keep `mdj_specialist_configs`** | VOLTRON Lions routing — this IS the active AI routing source |
| **Do NOT merge** | Merging would break both systems — schemas are incompatible |
| **Rename consideration** | Consider renaming `mdj_specialist_configs` → `voltron_lion_configs` in Track 2 for clarity |
| **Update Lion entries** | Current specialists (general/medicare/securities/service/david/ops) need to be mapped to the 5 Lions (medicare/annuity/investment/life-estate/legacy-ltc) in OPERATE track |

---

## JDM Decision Needed

1. **Approve keeping both collections** (recommended — they serve different purposes)
2. **Approve renaming** `mdj_specialist_configs` → `voltron_lion_configs` in OPERATE track
3. **Approve Lion remapping** from old specialist names to 5 Lions in OPERATE track

**No writes until JDM approves.**
