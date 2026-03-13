# Builder 1 Phase 4+5 Report — 2026-03-11

> Builder: Claude Opus 4.6 (1M context) — Builder 1 (primary, owns `main`)
> Scope: `~/Projects/toMachina/.claude/PHASE_4_5_BUILDER_1.md`

---

## Pre-Phase: Builder 3 Round 3 Merge

| Step | Result |
|------|--------|
| Merge `builder-3/portal-polish` | **Clean** — 2,171 lines (portal polish, PortalSwitcher, entitlement gating) |
| Add PortalSwitcher to ProDash TopBar | **Done** — import + one line in TopBar.tsx |
| `turbo run build` | **9/9 workspaces, 0 errors, 29s** |
| Push to main | **Done** — `335ad0f`, auto-deploy triggered |

---

## Phase 4a: Archive Portals — COMPLETE (CP1)

7 repos tagged `pre-migration-archive` and pushed to GitHub, then moved to `~/Projects/archive/`:

| Repo | Source | Archive Path | Tag Pushed |
|------|--------|-------------|------------|
| PRODASHX | `PRODASHX_TOOLS/PRODASHX` | `archive/PRODASHX` | Yes |
| RIIMO | `RAPID_TOOLS/RIIMO` | `archive/RIIMO` | Yes |
| sentinel-v2 | `SENTINEL_TOOLS/sentinel-v2` | `archive/sentinel-v2` | Yes |
| sentinel | `SENTINEL_TOOLS/sentinel` | `archive/sentinel-v1` | Yes |
| DAVID-HUB | `SENTINEL_TOOLS/DAVID-HUB` | `archive/DAVID-HUB` | Yes |
| CEO-Dashboard | `RAPID_TOOLS/CEO-Dashboard` | `archive/CEO-Dashboard` | Yes |
| RPI-Command-Center | `RAPID_TOOLS/RPI-Command-Center` | `archive/RPI-Command-Center` | Yes |

GAS web app deployments NOT disabled (requires JDM clasp auth).

---

## Phase 4e: Archive App UIs — COMPLETE (CP2)

26 HTML files deleted across 4 GAS projects. All doGet() functions updated to return JSON.

| Project | Path | HTML Deleted | doGet() | clasp push |
|---------|------|-------------|---------|------------|
| CAM | `gas/CAM` | 9 files | JSON status | FAILED (auth expired) |
| DEX | `gas/DEX` | 3 files | JSON status | FAILED (auth expired) |
| C3 | `gas/C3` | 6 files | JSON status | FAILED (auth expired) |
| ATLAS | `gas/ATLAS` | 8 files | JSON status | FAILED (auth expired) |

**JDM action needed:** Run `clasp login` to re-authenticate, then push all 4:
```bash
cd ~/Projects/gas/CAM && clasp push --force
cd ~/Projects/gas/DEX && clasp push --force
cd ~/Projects/gas/C3 && clasp push --force
cd ~/Projects/gas/ATLAS && clasp push --force
```

---

## Phase 5a: Folder Reorganization — COMPLETE (CP3)

| Directory | Contents | Count |
|-----------|----------|-------|
| `~/Projects/toMachina/` | THE PLATFORM (monorepo) | 1 |
| `~/Projects/gas/` | GAS engines (maintenance) | 9 (RAPID_CORE, RAPID_IMPORT, RAPID_COMMS, RAPID_FLOW, RAPID_API, CAM, DEX, C3, ATLAS) |
| `~/Projects/services/` | Standalone backends | 8 (MCP-Hub, PDF_SERVICE, QUE-API, Marketing-Hub, Document-Processor, Drive-Tools, NBX, QUE) |
| `~/Projects/archive/` | Pre-toMachina (read-only) | 8 (7 repos + The-Machine) |
| `~/Projects/_RPI_STANDARDS/` | Standards + governance | 1 |

**Verified:**
- All git remotes intact after move
- All `.clasp.json` files have correct scriptIds
- Old SuperProject folders (RAPID_TOOLS, SENTINEL_TOOLS, PRODASHX_TOOLS) still exist but mostly empty

---

## Phase 5b: CLAUDE.md Reduction — COMPLETE (CP4)

| Metric | Before | After |
|--------|--------|-------|
| **Lines** | 1,239 | 987 |
| **Removed** | — | 252 lines of GAS-specific content |
| **Added** | — | ~30 lines (toMachina platform section) |

**Removed:**
- GAS Gotchas (all 14 items, ~196 lines)
- 6-Step Deploy process
- Deploy Report format
- GAS Self-Check checklists (commit + deploy)
- GAS Editor Instructions
- GAS Project Session Start protocol
- Detailed execute_script documentation
- Organization-Only Access (condensed to 1 line)
- GCP Project Linking (condensed to 1 line)

**Added:**
- toMachina Platform section (domains, stack, deploy, dev commands, GAS maintenance note)
- Updated Session URLs (toMachina portals + Firebase/GCP consoles)
- Updated Project Locations tree (toMachina/, gas/, services/, archive/)

**Updated:**
- Deployment Rules → toMachina-first, GAS maintenance fallback
- New Project Setup → Turborepo conventions primary
- Session Protocol → `npm run dev` primary, `.clasp.json` fallback
- Standard Definitions → route groups instead of .gs files
- MCP source path → `~/Projects/services/MCP-Hub/`

**Preserved (untouched):** Golden Rules, PHI rules, team info, MCP tools, hookify, ATLAS, communication style, Hall of Fame.

Backup at: `~/.claude/CLAUDE.md.pre-phase5`

---

## Phase 5d: Maintenance Scripts — IN PROGRESS (CP5)

| Script | Status | Changes |
|--------|--------|---------|
| `clone-all-repos.sh` | **Updated** | 27 repos → 19 active, new directory structure (toMachina/, gas/, services/, archive/) |
| `setup-hookify-symlinks.sh` | **Not yet updated** | Needs path updates for gas/ directory |
| MONITORING.md | **Not yet updated** | |
| POSTURE.md | **Not yet updated** | |

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| clasp push failed on 4 GAS projects | MEDIUM | JDM needs `clasp login` — HTML deletion is local only until pushed |
| setup-hookify-symlinks.sh not updated | MEDIUM | Still references old RAPID_TOOLS paths |
| MONITORING.md / POSTURE.md not updated | LOW | Reference docs, not blocking |
| Old SuperProject folders not cleaned up | LOW | RAPID_TOOLS, SENTINEL_TOOLS, PRODASHX_TOOLS mostly empty but not deleted |
| firebase.json — DO NOT TOUCH | HIGH | Builder 2 broke Firebase Hosting, needs to fix. I did not push any firebase.json changes. |

---

## Scope Compliance

| Boundary | Status |
|----------|--------|
| `~/.claude/CLAUDE.md` | Modified — within scope |
| `~/Projects/_RPI_STANDARDS/scripts/` | Modified — within scope |
| `~/Projects/gas/**` (HTML deletion + doGet) | Modified — within scope |
| `~/Projects/toMachina/**` (code) | Only TopBar.tsx (PortalSwitcher) — within scope |
| `services/**` | NOT touched |
| `packages/core/**` | NOT touched |
| `firebase.json` | NOT touched (per auditor instruction) |
