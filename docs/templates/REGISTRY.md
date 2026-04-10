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
