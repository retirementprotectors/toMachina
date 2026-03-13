# RPI Retirement Portfolio Insights — Design Handoff

**Created:** 2026-03-12
**Art Direction:** Josh D. Millang (JDM)
**File:** `RPI Retirement Portfolio Insights.html`
**Purpose:** Print-ready 2-page one-pager for B2C client acquisition (Blue → Yellow stage)

---

## Brand Identity

### Product Names (Banked)
| Name | Use | Status |
|------|-----|--------|
| **Retirement Portfolio Insight** (singular) | Initial report suite — the educational "here's what we see" | Active (this document) |
| **Retirement Portfolio Intelligence** | Ongoing monitoring/dashboard — the retention play | Banked for future |

Both map to the **RPI** acronym. Same letters, two products, two stages of the relationship.

### Brand Colors (Exact Values)
| Token | Hex | Usage |
|-------|-----|-------|
| `--navy` | `#1a3158` | Primary text, dark sections, numbered circles |
| `--rpi-blue` | `#4a7ab5` | Accent borders, highlighted letters (P, I in title) |
| `--rpi-blue-pale` | `#edf2f8` | Section backgrounds (Gradient, CTA, walkaway) |
| Header cooled | `#e5ecf6` | Headers ONLY — compensates for shield SVG warm tones |
| `--charcoal` | `#5a6270` | Secondary icon strokes |
| `--text-primary` | `#1a1a1a` | Body text |
| `--text-secondary` | `#4a5568` | Description text |
| `--text-muted` | `#718096` | Footer, labels |
| `--border` | `#e2e5ea` | Card borders |
| `--bg-light` | `#f8f9fa` | Walkaway section background |

### Why `#e5ecf6` for headers
The RPI shield SVG (from retireprotected.com) is an embedded PNG with laurel wreaths that have warm/green undertones. On `#edf2f8` the header reads greenish vs. the other pale blue sections. `#e5ecf6` is ~3% cooler and compensates for the optical shift. Apply this to ANY section that contains the RPI shield on a pale blue background.

---

## Typography

### Font Stack
`'Inter', -apple-system, sans-serif` — loaded from Google Fonts (weights 300-800)

### Type Scale (Print-Optimized for Seniors)
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| **Page Title** | 28pt | 800 | "Retirement Portfolio Insights", "How It Works" |
| **Section Header** | 14pt | 800 | "What We Analyze", "What You'll Walk Away With", "Gradient Investments, LLC" |
| **CTA Title** | 19pt | 800 | "Ready to See What We Find?" |
| **Card/Step Title** | 12pt | 700 | Report names (1-6), step titles (1-4) |
| **Body** | 11pt | 400 | ALL descriptions, intro, CTA strip, promise, walkaway items, contacts |
| **Contact** | 13pt | 600 | Email, phone, website in CTA box |
| **Powered-By Label** | 11pt | 700 | "*Analysis Suite Powered By" (uppercase, letter-spaced) |
| **Footer** | 9pt | 400 | Disclaimers, address |

### Key: All body text is 11pt
This is a senior-facing document. Every description, every paragraph, every bullet point is 11pt minimum. No exceptions.

---

## Layout System

### Page Dimensions
- Width: 8.5in
- Height: 11in (min-height, flex column)
- Side margins: 0.55in

### Section Spacing
**0.175in** uniform gap between ALL sections on both pages. This is the magic number — tested through multiple iterations.

### Alternating Section Pattern (CRITICAL)
Both pages follow the same 4-section alternating background pattern:

| Section | Background | Text Color | Example (Page 1) | Example (Page 2) |
|---------|-----------|------------|-------------------|-------------------|
| 1 (Header band) | `#e5ecf6` pale blue | Navy | Header | "How It Works" header |
| 2 (Dark) | `#1a3158` navy | White | "The RPI Approach" / "Getting Started" | Steps 1-4 |
| 3 (White) | transparent/white | Navy | Report cards grid | "What You'll Walk Away With" |
| 4 (Pale blue) | `#edf2f8` + blue border | Navy | Gradient Investments | "Ready to See What We Find?" |

Footer sits below with `margin-top: auto` (pushed to bottom).

---

## Component Patterns

### Checkboxes (Rounded Square)
Used on both pages for non-sequential items.
```
Fill: var(--rpi-blue-pale) (#edf2f8)
Stroke: var(--rpi-blue) (#4a7ab5)
Checkmark stroke: var(--rpi-blue)
Size: 22x22px
Corner radius: 4px
```

### Numbered Circles (Steps 1-4)
Used for sequential processes.
```
Background: rgba(255,255,255,0.15) — subtle against navy
Text: rgba(255,255,255,0.7) — muted white
Size: 30x30px
Border-radius: 50%
Font: 11pt, weight 700
```

### Dark Section (Navy)
```css
background: var(--navy); /* #1a3158 */
border-radius: 6px;
padding: 0.14in-0.18in;
color: var(--white);
/* Titles: white, Body: rgba(255,255,255,0.8), Subtle: rgba(255,255,255,0.7) */
```

### Pale Blue Section (CTA Style)
```css
background: var(--rpi-blue-pale); /* #edf2f8 */
border: 2px solid var(--rpi-blue); /* #4a7ab5 */
border-radius: 8px;
padding: 0.18in 0.22in;
```

### Promise/Trust Box
```css
background: var(--navy);
border-radius: 6px;
/* Lightbulb icon: 38px, pale fill + navy stroke */
/* Text: italic, rgba(255,255,255,0.9) */
```

### 3-Column CTA Grid
```css
display: grid;
grid-template-columns: 90px 1fr 1.6fr;
gap: 0.18in;
align-items: center;
/* Col 1: RPI shield (90x90px) */
/* Col 2: Title (19pt, 800 weight) */
/* Col 3: Contact items stacked (13pt, 600 weight) */
```

### Walkaway Grid (Equal Rows)
```css
display: grid;
grid-template-columns: 1fr 1fr;
grid-template-rows: 1fr 1fr 1fr; /* Forces equal row heights */
gap: 0.12in 0.3in;
```

---

## Assets

| Asset | Location | Notes |
|-------|----------|-------|
| RPI Shield SVG | `apps/prodash/public/rpi-shield.svg` | 39KB, embedded PNG in SVG wrapper. Has warm tones — compensate with `#e5ecf6` bg |
| HTML Source | `apps/prodash/public/RPI Retirement Portfolio Insights.html` | Print-ready, open in Chrome → Print → Save as PDF |
| Google Fonts | `Inter` weights 300-800 | Loaded via Google Fonts CDN |

---

## Print Instructions

1. Open `RPI Retirement Portfolio Insights.html` in Chrome
2. **Cmd+P** → Print
3. Destination: **Save as PDF**
4. Layout: **Portrait**
5. Paper: **Letter (8.5 x 11)**
6. Margins: **None** (the HTML has its own margins)
7. Check: **Background graphics** (MUST be enabled for colors)

---

## Content Reference

### Page 1 — The Menu
- Header: "Retirement Portfolio Insights" (shield as R)
- Intro: "The RPI Approach" — investment analysis suite* with asterisk
- 6 Report Categories (gray checkboxes, not numbered):
  1. Color of Money Risk Analysis
  2. Portfolio Allocation Analysis
  3. Model Portfolio Illustration
  4. Gradient Structured Note & Buffer Analysis
  5. Income & Distribution Analysis
  6. Fee Transparency Comparison
- CTA: "Getting started is simple"
- *Gradient Investments, LLC (asterisk reference)
- Footer: RPI address + phone + RetireProtected.com

### Page 2 — The Process
- Header: "How It Works"
- 4 Steps (numbered circles, navy background):
  1. Share Your Statements
  2. We Run Your Personalized Analysis
  3. Your Review Meeting
  4. You Decide
- What You'll Walk Away With (6 checkbox items, light gray box)
- Trust statement (italic, lightbulb icon, navy background)
- Ready to See What We Find? (3-column CTA with shield + contacts)
- Disclaimer footer

### Tone
100% educational. Not a sales pitch. "We show you what we see. You decide."

---

## Reuse Guide

This design system should be applied to ALL future RPI client-facing collateral:
- **Retirement Portfolio Intelligence** (the monitoring product)
- **Individual report cover pages** (Color of Money, Allocation, etc.)
- **Meeting recap documents**
- **Onboarding welcome packets**

The alternating section pattern, typography scale, color tokens, and component patterns are the RPI print design language.
