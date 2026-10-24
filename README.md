# Ontario Hydro Plan Compare

**[Use the app](https://electricity-plans.github.io/ontario-hydro-plan-compare/) · [Ask a question](../../discussions/categories/q-a) · [Report a problem](../../issues/new/choose)**

> **Public beta.** A free, volunteer-run hobby project. Results are estimates, not guaranteed savings. Your
> electricity file is read on your computer and never uploaded. Please never post bills or usage files on GitHub.

**It covers** Ontario households that buy electricity from their local utility on the OEB's price plans
(Time-of-Use, Ultra-Low Overnight, Tiered). **It doesn't cover** retailer contracts, net metering (solar),
sub-metered condos or businesses. The whole-bill check has one utility's charges built in so far (Alectra,
PowerStream rate zone); for others it takes those lines from your bill. A file format marked "checked" has been
matched against a real bill for that format only; that isn't a guarantee every file or forecast is right.

**Help wanted:** try it with your own file and [tell us how it went](../../issues/new/choose), especially if you're not
on Alectra. See [SUPPORT.md](SUPPORT.md) for what help is available, and [CONTRIBUTING.md](CONTRIBUTING.md) to
contribute.

(Maintained by the [electricity-plans](https://github.com/electricity-plans) organization.)

Compare Ontario's electricity price plans — **Time-of-Use (TOU)**, **Ultra-Low Overnight (ULO)** and **Tiered** —
using your own **Green Button** smart-meter data, and see which plan is likely to be cheapest for you over the
next 12 months, and how confident that answer is.

Everything runs in your browser. Your usage data is never uploaded anywhere.

> **Status: version 2.0 beta (public redesign).** A guided flow for the public: who sends your bill, where to
> find your Green Button file, a few questions, then the result first, with the evidence one level down.
> Developer details are under *How we know*. Desktop only.
> Verification: `docs/verification-v2.0.md`. Usability testing: `docs/usability-test-plan.md`.
>
> **Previously, version 1.0.** Open `dist/index.html` in a browser: load a file, see the data-quality report,
> your history priced under each plan, which plan is likely cheapest over the next 12 months, check a bill
> down to the amount due, and run the app’s own tests in the **Checks and sources** tab.
> Delivery rates for the Alectra PowerStream zone are still to be entered.
> Not affiliated with the Ontario Energy Board or any utility. Results are estimates; check them against your bill.

## Using it

Download `dist/index.html` and open it in Chrome, Edge, Firefox or Safari. It works offline, from your own
computer; there is nothing to install. Then drop in the Green Button XML file from your utility.

## Why

The [OEB bill calculator](https://oeb.ca/consumer-information-and-protection/bill-calculator) asks you to type in
how much electricity you use in each time period. Most Ontario utilities already let you download exactly that,
interval by interval, as a Green Button file. This tool reads that file directly.

## What's verified

| Check | Result |
|---|---|
| ESPI schema (NAESB REQ.21 v4.0) | Real Alectra export: all 1,937 resources valid |
| TOU/ULO period classification | 0 mismatches against the utility's own TOU codes, on every reading of a 12-month export |
| Holidays | Reproduces the OEB's published 2026 holiday schedule, including the weekend rule |
| Bill reconciliation | A real Alectra bill: every period’s kWh exact to 0.001 kWh, every dollar line to the cent |
| Independent check | A separate Python implementation (`reference/`) must agree with the JavaScript engine |
| Whole bill | Alectra bill: loss-adjusted kWh, regulatory, subtotal, HST, rebate and amount due all to the cent (delivery taken from the bill) |
| Forecast | Hand-derived synthetic year (household load + nightly charging): every period total, cost and break-even point exact |

### How the forecast works

1. **Charging is detected** as sustained high-power runs (threshold set from your own data; pauses up to 90 minutes merged; runs under 45 minutes ignored).
2. **Household use** (everything else) is modelled per calendar month as an average weekday and weekend day, from data after your usage-change date where available. Earlier months are adjusted by the change measured on matching days before and after.
3. **Charging** uses your sessions per week and kWh per session since the change date, plus a seasonal increase measured from how much more energy your sessions took in colder months.
4. Each month is **priced under every plan** at the latest OEB prices, in three scenarios: half the charging, like recent months, and 30% more.
5. The app recommends the **best single plan**, or a **schedule with at most two switches a year** when it saves at least $20, and says how confident it is: whether the answer holds in the other two scenarios.

### Supported files

| Level | Meaning |
|---|---|
| ✅ Verified | Export profile checked against a real bill (currently: Alectra Utilities, 15-minute data) |
| ⚠️ Unverified | Valid Green Button data the app can read, but not yet checked against a bill from that utility |
| ⛔ Unsupported | Not readable (not ESPI, not electricity, unknown units, no interval data) |

If your file is unverified or unsupported, the app offers a pre-filled feature request containing only the
file's *profile* (utility, interval length, units) — never your usage values.

## Cross-checking with the OEB calculator

The History tab has a **Cross-check a month with the OEB calculator** section. Pick a month and it lists the
exact kWh to enter in the OEB calculator's advanced mode for each plan, and the electricity-line amounts the
calculator should show at today's prices. The OEB calculator is independent of this app, so a match confirms
the period classification and the prices.

## Publishing

`dist/index.html` is the whole app. `.github/workflows/pages.yml` publishes it to GitHub Pages after the tests pass on
every push to `main` (one-time setup: Settings → Pages → Source: **GitHub Actions**). The app is at
<https://electricity-plans.github.io/ontario-hydro-plan-compare/>.

Pages for a private repository needs a paid GitHub plan. The page makes no network requests, so any static host works.

## Repository layout

```
src/        engine: XML scanner, ESPI parser, Ontario time, holidays, classification, pricing, reconciliation
app/        the page: index.html template, styles.css, ui.js, worker.js
dist/       index.html, the built single-file app (generated: run node tools/build.mjs)
tariffs/    rpp.js — RPP prices, periods and holidays; utilities.js — distributor tariffs (loss factor, regulatory, delivery). Every entry cited
schema/     espi.xsd (corrected copy, see NOTICE.md)
tests/      suite.js (shared tests, also run in the app), synthetic.js (creates every made-up test file), run.mjs (Node runner + private tests), browser/ (page tests), expected/ (Python reference results)
reference/  independent Python implementation and schema validator
tools/      build.mjs (builds dist/index.html), report.mjs (command-line data-quality report)
private/    YOUR files (ignored by git): real export, bill figures
```

## Known limits

- **Daylight saving.** The 12-month estimate treats every day as 24 hours. In a worst-case test (a car charging across
  the changed hour every night), this moves the yearly gap between plans by about 16 cents (`tests/dst-measurement.mjs`).
- **Screens.** Designed for computers, where the usage file is easiest to download. On phones, tablets and at high
  browser zoom the page rearranges into one column, with no sideways scrolling down to 320 CSS pixels (400% zoom on a
  1280-pixel screen). Automated checks, Lighthouse (100) and axe (0 issues) pass; a screen-reader run-through is still
  to do, so no claim of full WCAG conformance is made.

## Maintaining it

Guides for running the project in public are in `docs/maintainers/`: the one-time GitHub setup, inviting testers, the
feedback form, saved replies and moderation, and the **annual price update** each November 1
(`node tools/print-prices.mjs` prints the price table and a year's holidays for checking against the OEB).

## Continuous testing

`.github/workflows/tests.yml` runs on every push: it checks that `dist/index.html` is the build of the current
sources, then runs the Node tests, the browser tests, the schema checks and the independent Python reference.
No personal files are needed; all test data is made up.

## Building

```bash
node tools/build.mjs
```

This bundles `src/`, `tariffs/` and `app/` into `dist/index.html`. Commit the rebuilt file along with your changes.

## Running the tests

Requires Node.js 20 or later.

```bash
node tests/run.mjs
```

To also run the private tests against your own export and bill (these files stay in `private/`, which git ignores):

```bash
REAL_FILE=private/real.xml REAL_BILL=private/real-bill.json REAL_EXPECTED=private/expected-real.json node tests/run.mjs
```

Browser regression tests (need Python 3 and Playwright: `pip install playwright` then `python -m playwright install chromium`):

```bash
node tools/build.mjs
python3 tests/browser/regression.py
```

The test files are all made up, and are created by `tests/synthetic.js` when the tests run, so none are stored in
the repository. For the optional Python checks (schema validation and the independent reference), write them out first:

```bash
node tests/make-fixtures.mjs /tmp/fixtures
python3 reference/validate_schema.py /tmp/fixtures/*.xml
python3 reference/reference_analysis.py /tmp/fixtures/synth-alectra-shape.xml tests/expected/synth-alectra-shape.json
```

Command-line report for any Green Button file:

```bash
node tools/report.mjs path/to/export.xml
```

## Updating prices

Each November 1 the OEB sets new RPP prices. Add one entry to `PRICES` in `tariffs/rpp.js` with its source,
then run the tests.

## Sources

- OEB, [Historical electricity rates](https://oeb.ca/consumer-information-and-protection/electricity-rates/historical-electricity-rates)
- OEB, [Prices effective November 1, 2026](https://www.oeb.ca/newsroom/2026/ontario-energy-board-announces-changes-electricity-prices-households-small-businesses)
- OEB, [Holiday schedule — TOU and ULO](https://www.oeb.ca/consumer-information-and-protection/electricity-rates/holiday-schedule-time-use-and-ultra-low)
- NAESB REQ.21 ESPI schema v4.0 (Apache 2.0)

## License

MIT. The bundled ESPI schema keeps its own Apache 2.0 license (see `schema/NOTICE.md`).
