# RPI Portal Design System — Figma Reference

> Reference for Figma MCP generation. Encode these conventions when creating or reviewing Figma designs.

## Portal Themes

| Portal | CSS Variable `--portal` | Brand Color | Port (dev) |
|--------|------------------------|-------------|------------|
| ProDashX | `#4a7ab5` (RPI Blue) | Blue | 3001 |
| RIIMO | `#a78bfa` (Electric Purple) | Purple | 3002 |
| SENTINEL | `#40bc58` (DAVID Green) | Green | 3003 |

## CSS Variable System

```css
/* Portal-level (set per-portal in globals.css) */
--portal: #4a7ab5;
--portal-glow: rgba(74,122,181,0.15);
--portal-accent: #7ba8d4;
--portal-deep: #1a3158;

/* Layout (shared across all portals) */
--bg-page: #0a0e17;
--bg-card: #111827;
--bg-card-hover: #1a2236;
--border-subtle: #1e293b;
--text-primary: #e2e8f0;
--text-muted: #94a3b8;

/* Sidebar */
--module-color: #a78bfa;
--app-color: #f6ad55;
```

## App Brand Colors

| App | Hex | Icon |
|-----|-----|------|
| Pipeline Studio | `#14b8a6` | architecture |
| System Synergy | `#14b8a6` | sync_alt |
| Command Center | `#718096` | speed |
| VOLTRON | `#3b82f6` | bolt |
| MEGAZORD | `#10b981` | hub |
| MUSASHI | `#d4a44c` | palette |
| FORGE/Dojo | `#e07c3e` | temple_buddhist |
| Guardian | `#c8872e` | shield |
| C3 | `#e53e3e` | campaign |
| DEX | `#38a169` | description |
| CAM | `#d69e2e` | payments |
| ProZone | `#0ea5e9` | explore |
| RSP | `#f97316` | conversion_path |

## Dark Theme Palette

```
Background:     #0a0e17
Card:           #111827
Card Hover:     #1a2236
Border:         #1e293b
Text:           #e2e8f0
Text Muted:     #94a3b8
Green:          #22c55e
Blue:           #3b82f6
Red:            #ef4444
Orange:         #f59e0b
Purple:         #a855f7
Teal:           #14b8a6
Gold:           #d4a44c
Cyan:           #06b6d4
```

## Component Patterns

### Card
- Background: `#111827`
- Border: `1px solid #1e293b`
- Border Radius: `12px`
- Padding: `24px`

### Table
- Header: `#1a2236` bg, accent color text, `0.72rem`, uppercase, `700` weight
- Cell: `10px 12px` padding, `#1e293b` bottom border
- First column: `#e2e8f0`, `500` weight
- Other columns: `#94a3b8`

### Status Pills
- Live: `rgba(34,197,94,0.12)` bg, `#22c55e` text
- Next: `rgba(59,130,246,0.12)` bg, `#3b82f6` text
- Plan: `rgba(168,85,247,0.12)` bg, `#a855f7` text
- Hold: `rgba(148,163,184,0.12)` bg, `#94a3b8` text
- Hot: `rgba(239,68,68,0.12)` bg, `#ef4444` text
- Size: `2px 10px` padding, `999px` radius, `0.68rem`, `700` weight, uppercase

### Tabs (Within Apps)
- Active: `2px` bottom border in accent + glow bg
- Inactive: transparent bg, muted text
- Icon: Material Symbols Outlined, `18px`
- Font: `0.82rem`, `600` active / `400` inactive
- Padding: `14px 18px`

### AppWrapper (Brand Bar)
- `4px` solid bar at top in app brand color
- Full-width

### Sidebar
- Width: `64px` collapsed, `240px` expanded
- App icons: `36px` circle, brand color at `15%` opacity, `20px` icon

## Typography

- System font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- Code: `'SF Mono', monospace`
- H1: `1.8-2.4rem`, `800` weight, gradient text
- H2: `1.15rem`
- H3: `0.95rem`
- Body: `0.88rem`
- Labels: `0.72-0.78rem`, uppercase, `600-700` weight
- Links: `#06b6d4`, no underline, underline on hover

## Icons

Material Symbols Outlined — all icons from Google's Material Symbols set.

## Forbidden

- No generated logos — use real assets from `packages/ui/src/logos/`
- No inline color styles — use CSS vars or dark theme palette
- No plain dropdowns for person selection — use SmartLookup
