# Client Roadmap Template Registry

> **Purpose:** Canonical registry of reusable templates for Client Roadmaps, Recommendation Tabs, Story 1-Pagers, and Print Materials.
>
> **Rule:** Every template here is registered as a named asset. Tabs built for a specific client case should reference a registered template, not one-off markup. When we find a new pattern that should become reusable, promote it here.

## Stage Templates (Client Roadmap Tabs)

| ID | Name | Stage | Path | Owner | Version | Status |
|---|---|---|---|---|---|---|
| `tpl.preserve-stage-analysis` | RPI PRESERVE Stage Analysis | PRESERVE | `client-roadmap/preserve-stage-analysis.html` | VOLTRON (CSO) | v1 | Active |
| `tpl.prosper-stage-analysis` | RPI PROSPER Stage Analysis | PROSPER | *(not yet built)* | VOLTRON (CSO) | — | Planned |
| `tpl.protect-stage-analysis` | RPI PROTECT Stage Analysis | PROTECT | *(not yet built)* | VOLTRON (CSO) | — | Planned |

### Stage VIEW Matrix

Each stage surfaces a different subset of the 8 VIEWs:

| VIEW | PROSPER | PRESERVE | PROTECT |
|---|---|---|---|
| 1. Service Team | ✓ | ✓ | ✓ |
| 2. Health Care | ◐ | ✓ | ✓ |
| 3. Extended Care | ◐ | ✓ | ✓ |
| 4. Portfolio | ✓ | ✓ | ✓ |
| 5. Accumulation | ✓ | ✓ | ◐ |
| 6. Income | ◐ | ✓ | ✓ |
| 7. Estate | ◐ | ✓ | ✓ |
| 8. Legacy | — | ✓ | ✓ |

Legend: ✓ Core · ◐ Contextual · — Not surfaced

## Story 1-Pagers

Registered assets used in three places: (1) Client Roadmap Tab, (2) Print handout, (3) Website CTA.

| ID | Name | Path | Owner | Version | Status |
|---|---|---|---|---|---|
| `tpl.story.were-your-people` | We're Your People™ | `stories/were-your-people.html` | VOLTRON (content) · MUSASHI (design) | v1 | Framed |
| `tpl.story.engage-wealth` | RPI Engage Wealth™ | `stories/engage-wealth.html` | VOLTRON (content) · MUSASHI (design) | v1 | Framed |
| `tpl.story.engage-legacy` | RPI Engage Legacy™ | `stories/engage-legacy.html` | VOLTRON (content) · MUSASHI (design) | v1 | Framed |

### Story Pillars

| Story | Pillar 1 | Pillar 2 | Pillar 3 |
|---|---|---|---|
| We're Your People™ | NewBiz Process | Reactive Service | Proactive Service Model™ |
| RPI Engage Wealth™ | Safety | Liquidity | Growth |
| RPI Engage Legacy™ | Children | Care | Charity |

## Trademark Status Register

> **Single source of truth for the legal status of every trademark across the RPI Engage Ecosystem.** When any mark flips from common-law to filed-pending to registered (®), update here first — downstream assets pick up the change via this register rather than chasing individual files.
>
> **Owner:** MUSASHI (CMO) — will migrate to a TypeScript CMO Registry layer at `packages/core/src/cmo/` during v2 elevation so this becomes queryable from ProDashX.

| Mark | Status | First Use | Filing Date | Registration # | Notes |
|---|---|---|---|---|---|
| We're Your People™ | common-law | TBD | — | — | Hero tagline on retireprotected.com. Status confirmed by Sensei 2026-04-10 (years of public use, not filed). |
| RPI Engage Wealth™ | common-law | TBD | — | — | Product story under the RPI Engage Ecosystem (marketing + comms platform umbrella). Confirmed common-law by Sensei 2026-04-10. |
| RPI Engage Legacy™ | common-law | TBD | — | — | Product story under the RPI Engage Ecosystem. Confirmed common-law by Sensei 2026-04-10. |
| Proactive Service Model™ | common-law | TBD | — | — | Step 4 of RPI 4-step methodology. On retireprotected.com. Confirmed common-law by Sensei 2026-04-10. |

### RPI Engage Ecosystem (context)

Per Sensei's 2026-04-10 directive: **"RPI Engage Ecosystem is the idea about all the Marketing + Communication Platform."** Engage is the umbrella brand family covering both **product stories** and **client-comms tiers**:

**Product Story tier:**
- RPI Engage Wealth™ (Safety · Liquidity · Growth)
- RPI Engage Legacy™ (Children · Care · Charity)

**Client Communications tier** (from retireprotected.com):
- Engage Live™
- Engage Direct™
- Engage Insights™
- Engage Alerts™

MUSASHI is building an "Engage Ecosystem lineage map" (single-page family tree) and adding it to the CMO Registry + AiBot Brand Guide. The 4 Engage Comms marks will be added to this register when that work lands.

### Status Workflow

1. **common-law** — publicly used but not USPTO filed. Treat with ™ glyph. Common-law claim supported by documented first use + continuous use.
2. **filed-pending** — USPTO application submitted, awaiting review. Still ™ glyph until approval.
3. **registered** — USPTO registration granted. Flip to ® glyph across all assets. Update Registration # column.

When a mark transitions, update this register first. Downstream assets (Story 1-Pagers, print materials, website CTAs, Client Roadmap tabs) pick up the change in their next build rather than requiring individual updates.

## Ownership Split

**Content framework (CSO):** Data structure, content headings, data grids, view definitions, technical accuracy, fact-check against ProDashX data model.

**Visual design (CMO):** Typography hierarchy, brand voice, final copy polish, print layout (bleed/margin/trim), web CTA copy, color refinement beyond base palette, photography/imagery direction.

## Planned Next

- `tpl.prosper-stage-analysis` — PROSPER Stage template (accumulation-phase clients)
- `tpl.protect-stage-analysis` — PROTECT Stage template (deep-retirement, legacy-dominant clients)
- `tpl.ar-meeting-agenda` — Analysis + Recommendations meeting agenda
- `tpl.discovery-recap` — Discovery Needs/Concerns Recap (the "CUSTOM" piece referenced in A+R meeting structure)
- `tpl.next-steps` — Next Steps tab (NewBiz Process onboarding flow for approved recommendations)

## How to Use

1. **Reference, don't copy.** When building a client roadmap, import/embed from the template path rather than duplicating the HTML inline.
2. **Parameterize.** Replace `[bracketed]` placeholders with real client data. Never commit a client-populated version into the template path.
3. **Promote patterns.** If you build a new tab for one client and it's reusable across clients, promote it here and register it.
4. **Version bumps.** Any structural change to a template requires a version bump (v1 → v2) and a note below.

## Version History

- **v1 (2026-04-10)** — Initial registry. PRESERVE Stage Analysis + 3 Story 1-Pagers shipped.
