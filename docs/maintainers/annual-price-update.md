# Annual price update

The OEB normally announces new Regulated Price Plan prices in **mid-October**, effective **November 1**. This is the
one fixed yearly job: about 30 to 60 minutes. Copy the checklist below into a new issue each October ("Prices from
November 1, YYYY") so you can tick it off.

## November: new OEB prices

**1. Gather the sources** (all from oeb.ca unless noted):
- [ ] The OEB news release announcing the new prices.
- [ ] The **"Historical electricity rates"** page, once it shows the new row (it usually does by November 1).
- [ ] The new **Ontario Electricity Rebate** percentage: in the OEB release, or the regulation that sets it.
- [ ] Check whether anything else changed: the TOU or ULO hours, the Tiered thresholds (600 kWh May to October,
      1,000 kWh November to April) or the season dates. If anything did, **stop**: that needs code changes, not just
      new prices. Open an issue for it.

**2. Add the prices** in `tariffs/rpp.js`:
- [ ] Add a source to `SOURCES`, for example
      `oeb2027: { title: 'OEB news release, Oct 2027: prices effective Nov 1 2027', url: '…', accessed: 'YYYY-MM-DD' }`.
- [ ] Add one line at the end of `PRICES`, copying the previous line's format:
      `{ effective: 'YYYY-11-01', tou: { off, mid, on }, ulo: { overnight, off, mid, on }, tiered: { t1, t2 }, oer, source, oerSource }`.
      Prices are in cents per kWh, exactly as the OEB publishes them; `oer` is the rebate percentage.

**3. Check every number against the OEB:**
- [ ] Run `node tools/print-prices.mjs` and compare the table, row by row, with the OEB's historical rates page.
      The columns are laid out the same way.

**4. Test and build:**
- [ ] `node tests/run.mjs`: everything should pass. The tests work out their expected figures from the price table,
      so new prices don't break them. If one fails, read why before changing anything.
- [ ] With your own file: run the private tests (see the README). The forecast now uses the new prices, so your
      result can change. If the recommendation changes, update `private/private-expected.json` to match, after
      checking that the change makes sense.
- [ ] `node tools/build.mjs`, then open `dist/index.html`. Check that **"How the estimate works" → "Prices and
      sources"** shows the new row, and that **"See a sample result"** works.
- [ ] The sample household's headline saving will probably change. Update the figure in the five-second test of
      `docs/usability-test-plan.md`, and retake `docs/usability/five-second-test.png` if you still use it.

**5. Release:**
- [ ] Commit (`Prices from November 1, YYYY`), push, and let the CI checks pass.
- [ ] Merge to `main`. The Pages workflow publishes the update.
- [ ] Open the live app and check the new prices row there too.
- [ ] Publish a release (`vX.Y.0`, "Prices from November 1, YYYY").
- [ ] Optional: post in Discussions → Announcements.

## Late December or January: holidays

- [ ] Once the OEB publishes the new year's list (late December or January), run `node tools/print-prices.mjs YYYY`
      for the new year, and compare its holiday list with the OEB's
      **"Holiday schedule - Time-of-Use and Ultra-Low Overnight"** page.
- [ ] If they match, add the year's list to `PUBLISHED_HOLIDAYS` in `tariffs/rpp.js`. The tests then check it every run.
- [ ] If they don't match, the OEB's list wins: open an issue, and fix the rule in `src/holidays.js`.

## January (or whenever they change): utility charges

Utility delivery and regulatory rates usually change on **January 1**, set by an OEB rate order. They only matter for
the whole-bill check, not for the plan comparison.

- [ ] For each utility in `tariffs/utilities.js`, find its new rate order (the OEB's Regulatory Document Search).
- [ ] Update the regulatory charges, the loss factor and `effective`, and add the source to `UTILITY_SOURCES`.
- [ ] Check against a real bill from after the change, using "Check my bill" with "The rest of the bill".

## If you skip a year

The app keeps working with the last prices it knows, and says so: the result notes that prices after the last known
date are assumed to stay the same. Nothing breaks. It's just less accurate until the update.
