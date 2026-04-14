# Robert + Eileen Thurman — Survivor Transition Roadmap

> **Draft — 2026-04-14** · VOLTRON CSO · Source: Josh Archer case notes + Thurman Fact Finder (9.28.23) + KCL Annual Report (6/5/2023). Firestore records are carrier-of-record for client identity; account-level extractions pending platform intake fix (see ZRD-INTAKE-WIRE-TRIGGER-PROD-BROKEN).

## Household

| | |
|---|---|
| **Address** | 1603 Cedar Muscatine Rd, Wilton IA 52778-9280 |
| **Robert Thurman** | `client_id: f6a5da6d-0c76-445d-9aab-7c9729d9d289` · DOB 1947-09-24 (age 78) · phone 563-506-0466 · ACF `1gfAtmRpZnHg_NRHgCN_hQvrsswQ9IsNV` |
| **Eileen Thurman** | `client_id: 66b14a29-b6bd-443f-a4c1-69637be4777f` · DOB 1947-11-22 (age 78) · phone 563-732-3215 · ACF (none yet) |
| **Agent of record** | Robert G King, Retirement Protectors Inc |

## Case Framing — Survivor Transition, Not Accumulation

Archer's notes say the SS Admin was notified and Eileen "will start receiving his SSI soon" + Robert has "2 small life policies yet to pay out." That pattern is a **widow's benefit transition + death-claim pipeline**, not active retirement-income accumulation for Robert. Firestore record for Robert shows `status: Active` but that's stale — Robert is deceased or claim-in-progress. Platform doesn't yet support decedent mode (see `ZRD-SUPER-WRITE-DECEDENT-MODE`); treating Eileen as the active planning subject.

## Health / Capacity

- **Eileen had a stroke recently.** Per Archer: she won't qualify for additional insurance. Her existing KCL IUL policy is therefore higher-value than at issue — can't be replaced.
- No long-term-care coverage noted for either.

## Legacy Goals

Robert/Eileen want to leave **grandson** (works in the big garage out back, intended to take over the farm) a share separate from the 3 kids. Hopeful path: a product where the **DB growth** goes to the grandson while **original principal** splits among the kids. Structural options:
- Multi-beneficiary IUL with fixed-amount designation to grandson
- Inherited-IRA stretch for grandson (limited post-SECURE Act 2.0 to 10-yr drain unless eligible designated beneficiary — grandson isn't EDB)
- Dedicated wealth-transfer annuity with enhanced DB + segregated beneficiary allocation

## Asset Inventory (pending full extraction — below is from Archer's notes + parsed PDFs)

### Robert's Modern Woodman IRAs (all out of surrender 12/8/27)

| Policy # | Type per Archer | Value | Surrender out |
|---|---|---|---|
| 9115879 | IRA (5yr) | $10,578 | 12/8/27 |
| 8258565 | IRA | unknown | 12/8/27 |
| 8258566 | IRA | $13,049 | 12/8/27 |
| 8529928 | IRA | $5,643 | 12/08/27 |

**⚠️ Flag from Archer:** 2 of these may actually be NQ despite the "IRA" label — verify on carrier statement when extraction runs. Identical issue dates + surrender dates suggest these were issued as a block, probably from a consolidated rollover.

### Robert's Nationwide FIA
- Per Archer: in January 2026 we moved his GrowthTrack KCL policy to Nationwide to replace the income from Eileen's SPIAs in 2028. GMIB rider.
- **Planning lever:** fire GMIB on the **4/10/27 anniversary** (not 4 months later — Archer's read is right unless there's an anniversary-bonus waiting-game we find)
- Eileen will need this income after her 2 SPIAs exhaust (see below)

### Robert's 2 Small Life Policies (claim pipeline)
- Not yet paid out. Pending death-benefit processing.
- Archer estimates $12-22K incremental incoming; combines with an "already existing balance of $118K" to reach **$130-140K liquid**.
- Beneficiary presumably Eileen (confirm on extraction — claim docs will state).

### Eileen's KCL Indexed Universal Life #2844833 (COMPASS ELITE IUL)
- Issue: 6/5/2017 · Age at issue 70 · Std Non-Tobacco · A-Level Death Benefit
- Face / Current DB: **$52,279**
- Accumulated Value (6/5/2023): $21,912.58 · Cash Surrender Value: $20,540.25 · Surrender charge $1,372.33
- Current allocation: 50% Indexed Account A (cap 8.50%) · 50% Indexed Account C (cap 11.50%) · 0% Fixed
- **Planned Premium: $0** — minimum-premium structure, coverage consuming value at ~$99/mo
- Total premiums paid to date: $21,904.59 (≈ equal to accumulated value — policy hasn't credited meaningful index gains in available history)
- Coverage lapse risk: per Archer, **coverage lapses at age 90 without additional funding.** Eileen is 78 → 12-year runway. Small premium increase could extend materially.
- **Stroke + uninsurable = preserve this policy.** Analysis priority.

### Eileen's 2 SPIAs
- Exhausting **8/27** and **9/27** (August + September 2027)
- Monthly amount TBD on extraction
- **Income-gap concern:** after exhaustion, Eileen loses 2 income streams. Nationwide FIA GMIB fire on 4/10/27 bridges the gap.

### Eileen's Brokerage Account
- Single holding: **Berkshire Hathaway Class B (BRK-B)**
- Solo-name account (not joint)
- Share count + current value TBD on extraction

## Income Transition Plan

```
Before Robert's passing          After Robert's passing
─────────────────────          ─────────────────────
Robert SSI                       Eileen switches to widow SSI (Robert's benefit, likely higher)
Eileen 2 SPIAs                   Continue through 8/27 + 9/27, then exhaust
                                 ┌─────── gap ───────┐
Eileen KCL IUL (asset)           Preserve — uninsurable post-stroke
Robert's 2 life policies         Pay out to Eileen (~$12-22K) → add to her $118K balance → $130-140K liquid
Robert's 4 MW IRAs (~$29K+)      Inherited-IRA rollover to Eileen (spouse eligible); out of surrender 12/8/27
                                 On 4/10/27 → fire GMIB on Nationwide FIA → lifetime income
Robert's Nationwide FIA/GMIB
```

## Action Items

### Pre-meeting with Archer
- [ ] Confirm Robert's date of death (or expected) — Firestore record still shows Active
- [ ] Get current KCL statement (2025 Annual Report) — latest we have is 6/5/2023 (2 years stale)
- [ ] Get current Modern Woodman IRA statements — latest is 9/28/23, pre-surrender-window
- [ ] Verify 2 MW IRAs Archer flagged as possibly NQ (policy #s 8258565, 8529928)
- [ ] Confirm Eileen's 2 SPIA carriers + monthly amounts + exact exhaustion dates
- [ ] Confirm Nationwide FIA details (policy #, cash value, GMIB income calc at 4/10/27 fire)
- [ ] Confirm beneficiary on Robert's 2 small life policies (pending payout)
- [ ] Pull BRK-B brokerage statement — custodian + share count + current value

### Casework deliverables
- [ ] Inherited-IRA rollover paperwork for Eileen (4 MW IRAs)
- [ ] Life-insurance claim processing for Robert's 2 policies
- [ ] Widow SSI benefit switch (confirm date + new monthly amount)
- [ ] Grandson legacy structure: recommend product + beneficiary-split mechanism
- [ ] KCL IUL sustaining-premium analysis (extend past age 90)

### Platform blockers
- `ZRD-INTAKE-WIRE-TRIGGER-PROD-BROKEN` (P0) — blocks automated document ingestion
- `ZRD-SUPER-WRITE-DECEDENT-MODE` (follow-up) — platform capability for decedent client records

---

*Robert + Eileen Thurman · Survivor Transition Roadmap · 2026-04-14 · VOLTRON CSO · Retirement Protectors, Inc.*
