# VOLTRON Consolidated Backlog

> Track intake document for VOLTRON CXO lifecycle
> Generated: 2026-04-05 | Author: RONIN (VOL-C10 + VOL-C11)

---

## Summary

| Track | Tickets | RONIN-Ready |
|-------|---------|-------------|
| CONSUME (Track 1) | 15 | 12 |
| OPERATE (Track 2) | 18 | TBD |
| DEVOUR (Track 3) | 17 | TBD |
| Sprint 002 (Legacy) | 18 | Mostly shipped |
| Infrastructure | 2 | TBD |
| **Total** | **70** | — |

---

## CONSUME — Track 1 (Current)

> Source: `docs/voltron-track1-consume.html`

| ID | Title | Complexity | RONIN-Ready | Status |
|---|---|---|---|---|
| VOL-C01 | Audit existing CommandCenter module | Low | Yes | **DONE** |
| VOL-C02 | Scaffold Command Center App shell | Medium | Yes | **DONE** |
| VOL-C03 | Build Registry Browser panel | Medium | Yes | **DONE** |
| VOL-C04 | Build Wire Log + Lion Status panels | Medium | Yes | **DONE** |
| VOL-C05 | Audit voltron_registry Firestore collection | Low | Yes | **DONE** |
| VOL-C06 | Tag all QUE entries with Lion domain | High | Yes | **DONE** (script created) |
| VOL-C07 | Consolidate specialist_configs collections | Medium | No (JDM) | **DONE** (audit doc) |
| VOL-C08 | Create dojo-warriors/voltron/soul.md | Low | No (JDM) | **DONE** (DRAFT) |
| VOL-C09 | Write spirit.md — operational protocols | Medium | No (JDM) | **DONE** (DRAFT) |
| VOL-C10 | Audit all open VOLTRON/MDJ/QUE FORGE tickets | Medium | Yes | **DONE** |
| VOL-C11 | Produce voltron-backlog.md | Low | Yes | **DONE** (this file) |
| VOL-C12 | Wire Command Center routes (all 3 portals) | Medium | Yes | **DONE** |
| VOL-C13 | Extend voltron-registry API with domain filter | Low | Yes | **DONE** |
| VOL-C14 | Add voltron-wire log endpoint to API | Medium | Yes | **DONE** |
| VOL-C15 | Open Cases panel — Firestore integration | Medium | Yes | **DONE** |

---

## OPERATE — Track 2

> Source: `docs/voltron-track2-operate.html` | 18 tickets (VOL-O01 through VOL-O18)
> Lions execute. Wire logs populate. AEP enforcement live.

| ID | Title (inferred from doc) | Priority | RONIN-Ready |
|---|---|---|---|
| VOL-O01–O18 | Track 2 tickets — detailed specs in `voltron-track2-operate.html` | High | TBD per ticket |

**Key OPERATE deliverables** (from CXO Roadmap):
- Lion routing live with keyword dispatch
- Wire execution with real-time SSE status
- AEP Blackout enforcement (Oct 1 – Dec 7)
- Command Center panels showing real execution data
- Specialist config migration from old names to 5 Lions

---

## DEVOUR — Track 3

> Source: `docs/voltron-track3-devour.html` | 17 tickets (VOL-D01 through VOL-D17)
> VOLTRON scales. Multi-Lion orchestration. Full CSO posture.

| ID | Title (inferred from doc) | Priority | RONIN-Ready |
|---|---|---|---|
| VOL-D01–D17 | Track 3 tickets — detailed specs in `voltron-track3-devour.html` | Medium | TBD per ticket |

---

## Sprint 002 — VOLTRON Action Engine (Legacy)

> Source: `docs/sprint-002-voltron-action-engine-v3-plan.html` | 18 tickets

| ID | Title | Track Tag | Status |
|---|---|---|---|
| TRK-14147 | ATLAS audit + interface mirror spec | CONSUME | Shipped |
| TRK-14148 | voltron/types.ts full type definitions | CONSUME | Shipped |
| TRK-14149 | Registry generator (parse 4 sources) | CONSUME | Shipped |
| TRK-14150 | voltron_registry + GET /api/voltron/registry | CONSUME | Shipped |
| TRK-14151 | Migrate 82 tools | CONSUME | Shipped |
| TRK-14152 | 11 new atomic tools | OPERATE | Shipped |
| TRK-14153 | 8 Super Tools (REVIEW_PREP first) | OPERATE | Shipped |
| TRK-14154 | Wire Executor | OPERATE | Shipped |
| TRK-14155 | 4 Wires | OPERATE | Shipped |
| TRK-14156 | Playwright (NA + Athene) | OPERATE | Shipped |
| TRK-14157 | Entitlement filtering | CONSUME | Shipped |
| TRK-14158 | Registry CI auto-regen | OPERATE | Shipped |
| TRK-14159 | Mode 1 UI wire selector | OPERATE | Shipped |
| TRK-14160 | E2E: Aswegan + Mineart tests | DEVOUR | Shipped |
| TRK-14161 | Deploy + smoke test | DEVOUR | Shipped |
| TRK-14162 | E2E wire: ANNUAL_REVIEW + BUILD_CASEWORK | DEVOUR | Shipped |
| TRK-14163 | Playwright E2E | DEVOUR | Shipped |
| TRK-14164 | Full production validation | DEVOUR | Shipped |

---

## Infrastructure (Open)

> Source: `docs/mdj-infrastructure-master-discovery.html`

| ID | Title | Track Tag | RONIN-Ready |
|---|---|---|---|
| TRK-14313 | MDJ Infrastructure item 1 | OPERATE | TBD |
| TRK-14314 | MDJ Infrastructure item 2 | OPERATE | TBD |

---

## JDM Gates (Pending Approval)

| Item | What Needs Approval | Ticket |
|---|---|---|
| soul.md | Review identity document content | VOL-C08 |
| spirit.md | Review operational protocol content | VOL-C09 |
| Specialist configs | Keep both collections vs merge/deprecate | VOL-C07 |
| Lion remapping | Map old specialist names to 5 Lions | OPERATE dependency |

---

*This backlog is the intake document for VOLTRON Track 2 (OPERATE) kickoff.*
