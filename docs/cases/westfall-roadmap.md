# Chris + Colleen Westfall — Pre-Retirement Income Roadmap

> **Draft — 2026-04-14** · VOLTRON CSO · Source: Josh Archer case notes + existing Firestore client record + Farm Bureau policy PDF (scanned, CamScanner — full extraction pending platform intake fix). Data gaps flagged inline.

## Household

| | |
|---|---|
| **Chris E Westfall** | `client_id: dc40f681-7ac4-47d4-bd6e-6ebdaec6488b` · Iowa City IA 52240 · phone 319-351-4584 · ACF `11zME7DVhM9Rc0hS8llf3TSkF8GFg-jQD` · Active Client (imported from `cof_members_q126` via sheets_migration) |
| **Colleen Westfall** | New record pending ingest — household spouse of Chris, existing Firestore record not yet located |
| **⚠️ DOB discrepancy (Chris)** | **Firestore: `1959-12-21` (would be age 66) · Archer's notes: `12/29/66` (age 59)** — 7-year gap. Archer's planning narrative (deferring SSI to FRA kicks in Sept/Oct, 3-4 year GMIB cook) fits age 59 cleanly; Firestore DOB likely mangled by the sheets migration. **JDM-blocked:** which DOB is correct? Roadmap uses Archer's number (age 59) for planning math; Firestore record stays as-is until JDM rules. |

## Case Framing — Pre-Retirement Income Structure

Chris is the active planning subject: pre-FRA, farm-income-heavy, structuring pre-retirement annuity strategy with a 3-4 year deferral window. Colleen is already past FRA and drawing SSI + IPERS. Goals: bridge Chris to SSI activation (Sept/Oct this year per Archer), structure his lump-sum assets to cook through FRA, then fire income for remaining retirement.

## Income Profile

### Chris (pre-FRA, age ~59 per Archer)
| Source | Amount | Timing |
|---|---|---|
| Farm rent | **~$3,000/mo** (~$36K/yr) | Ongoing |
| Machinery lease | **~$20,000/yr** | Until ~age 70 |
| **SSI (deferred to FRA)** | **$2,400/mo** | Kicks in **Sept/Oct** (current year) |
| Total annual income (post-SSI-activation) | ~$85K/yr | |

### Colleen (past FRA, age ~68)
| Source | Amount | Notes |
|---|---|---|
| SSI | **$1,200/mo** ($14.4K/yr) | Drawing now |
| IPERS | **$1,006/mo** ($12K/yr) | Iowa Public Employees Retirement System — confirm earnings test status |
| Total | ~$26K/yr | |

### Household combined
**~$111K/yr** once Chris SSI activates. Before activation: ~$83K (farm rent + lease + Colleen).

## Asset Inventory (partial — pending full extraction)

**⚠️ Note:** The `Westfall Farm Bureau (1).pdf` in Kim's inbox is a CamScanner scan with no text layer. Can't parse programmatically without OCR. Content below is from Archer's notes + household context. Full extraction runs when `services/intake` Cloud Function is fixed (`ZRD-INTAKE-WIRE-TRIGGER-PROD-BROKEN`).

### Bank CDs
- **4 CDs · combined $160,000 @ 3.00%**
- Carrier/maturity TBD on extraction

### Chris's IRA
- Chris has an IRA. Value + custodian TBD on extraction.
- **Planning lever: cook 3-4 years** before activating GMIB rider (per Archer)
- Candidate strategy: roll into FIA with GMIB, let rollup compound to 2029-2030, then activate lifetime income stream that stacks on top of his SSI

### Colleen's Roth IRA
- Scan mix-up per Archer: Chris's IRA statement + Colleen's Roth IRA statement + stray Minearts sig page ended up in the same scan. Ownership attribution needed on extraction.
- **Planning lever:** let Colleen's IRA cook **until age 73** (per Archer) — max Roth tax-free growth window before RMDs aren't an issue (Roth has no RMD for original owner, so "cook til 73" probably refers to Trad IRA if she has one, not the Roth).

### COF Policies
- **Chris's COF policy** — currently assigned to RPI
- **Colleen's COF policy** — **NOT assigned to RPI** (assignment ask on the table with Archer)
- Details + values TBD on extraction

### Farm Business
- Farm rent to a tenant (~$36K/yr revenue to Chris)
- Machinery leased out (~$20K/yr revenue, ends ~age 70)
- Legal structure (sole prop / LLC / trust) TBD — likely sole prop given Iowa farm pattern

## Action Items

### Pre-meeting
- [ ] Resolve Chris's DOB (12/29/66 vs 1959-12-21) — Archer should have a copy of his driver's license or birth certificate
- [ ] Verify SSI activation timing with Chris (Sept or Oct 2026?)
- [ ] Confirm 4 CDs: carrier(s), maturity dates, account numbers
- [ ] Chris IRA: custodian, value, product type (is it already an annuity or a brokerage IRA?)
- [ ] Colleen IRA: Traditional or Roth (the "cook til 73" reasoning only applies to Trad for RMD purposes)
- [ ] Get Colleen's COF policy details + discuss assignment-to-RPI
- [ ] Stray Minearts sig page (in the Westfall scan bundle) — classify + route to Minearts casework separately

### Product recommendations (draft — pending numbers)
- [ ] **Chris: FIA with GMIB rider · 3-4 year deferral.** Target: activate 2029-2030, stacks on SSI ($2,400/mo) + farm rent + machinery lease. Candidate carriers: Nationwide, Athene, Global Atlantic, Allianz, Pacific Life.
- [ ] **Colleen: preserve Roth, let Trad cook to 73.** If Trad IRA value is meaningful, consider Roth conversion strategy during Chris's low-income years (pre-SSI-activation window is shrinking — Sept is close).
- [ ] **CDs: reposition to MYGA or FIA.** $160K @ 3% is underperforming current MYGA rates (4.0-5.25%). Non-qualified so 1035 exchange not applicable; simple rollover at maturity.
- [ ] **Legacy structure:** if Chris + Colleen have specific children/grandchildren for farm succession, mirror the Thurman "DB-to-grandson" pattern consideration.

### Platform blockers
- `ZRD-INTAKE-WIRE-TRIGGER-PROD-BROKEN` (P0) — blocks the Farm Bureau PDF extraction
- DOB reconciliation on Firestore record — JDM ruling needed

---

*Chris + Colleen Westfall · Pre-Retirement Income Roadmap · 2026-04-14 · VOLTRON CSO · Retirement Protectors, Inc.*
