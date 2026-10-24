# Changelog

Each release says whether **results may change** compared with the previous one, and which **OEB prices** it uses.
The full verification record is in `docs/verification-v2.0.md`.

## 2.0.0-beta.1 (first public beta)

**Prices:** OEB prices from November 1, 2026 (and earlier, back to November 1, 2022, for your past year).

- Guided steps: get your file, answer a few questions, compare plans. Result first, with the evidence underneath.
- Recommendations use the cost after tax and rebate, with each month's own prices and rebate rate.
- Strict checks on every file before anything is calculated; unusual files are refused with a plain reason.
- Bill check with a status for each line; works for any utility, with Alectra's PowerStream rate zone built in.
- Works on computers, tablets and phones, and at high browser zoom. Lighthouse accessibility 100, axe 0 issues.
- A visible notice if the app's prices haven't been updated for a new November 1.

**Results may change** compared with v1.0: twelve-month totals are now shown after tax and rebate, and months the
file only partly covers no longer get a Tiered figure. Everything else matches v1.0.
