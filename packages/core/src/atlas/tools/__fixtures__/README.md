# isu-land-value-parse fixtures

Real source artifacts from Iowa State University, committed as deterministic
test inputs for FV-003 v2. Both fixtures cover the **2025 survey release**.

## isu-land-value-sample.xlsx (562 KB)

Canonical fixture for the FV-003 v2 parser.

- Source: `https://farmland.card.iastate.edu/files/inline-files/Iowa_Farmland_Values_ISU_1941_2025.xlsx`
- Sheets: `State`, `District`, `County` (see parser for layout).
- Fetched 2026-04-15 against ISU's CARD Farmland portal — the intended
  machine-readable source (the PDF equivalent publishes per-county data as
  an image-based map and yields zero extractable county names).

## isu-land-value-sample.pdf (639 KB)

Negative-case drift-guard fixture — proves the parser refuses to extract
rows from the legacy PDF source and surfaces a drift warning instead.

- Source: `https://www.extension.iastate.edu/agdm/wholefarm/pdf/c2-70.pdf`
- Not a supported input path — retained only to assert the v2 parser fails
  cleanly if someone accidentally re-wires the old URL.
