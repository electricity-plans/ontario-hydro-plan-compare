# Verification report: v2.0 beta (public redesign)

Date: October 22, 2026. Build: `dist/index.html`, version 2.0.0-beta.
Goal: the redesign changes how results are shown, never the results themselves.

## Summary

| Check | Result | Who ran it |
|---|---|---|
| Existing tests | 66 public, 76 with private files: all pass | Automated (Node, and CI on every push) |
| Tests inside the built page | 63 of 63 pass in the browser; 39 browser regression tests | Automated (Chromium) |
| Same numbers as v1.0 | Identical, except the intended changes recorded below (after-tax totals = v1.0 x 0.973; no Tiered figure for partial months) | Automated (Playwright) |
| Accessibility rules | 0 issues on 12 screens x 2 themes (3,000+ text elements checked) | Automated, partial substitute for axe |
| axe DevTools | **Passed**: 0 issues on every screen (October 2026) | Author, axe DevTools for Chrome |
| Lighthouse accessibility | **Passed**: 100 on every screen, Snapshot and Navigation modes (October 2026) | Author, Chrome DevTools |
| Keyboard only | Whole flow completed; every focused element has a visible outline | Automated (Playwright keyboard) |
| NVDA screen reader | **To do** | You (script below) |
| Colour blindness | Price periods stay distinct under protanopia, deuteranopia, tritanopia | Machado et al. 2009 simulation |
| Reading level | Every public screen grade 8.3 or below (Flesch-Kincaid) | Automated |
| Usability test | Plan ready: `docs/usability-test-plan.md` | You, with 5 testers |

## UI/UX batch (GPT-6 review, October 2026)

Shorter name in the header (**Ontario Hydro Plan Compare**); the repository name is unchanged.

| Area | Change | Test |
|---|---|---|
| Navigation | The logo goes to the start screen without clearing the file ("Continue where you left off"); "Clear my data and start over" is a separate, confirmed action; browser Back and Forward move between screens (only the screen name is stored); a step indicator (Get your file, Answer questions, Compare plans); leaving the file screen while a file loads stops the loading | 5 browser tests |
| Get your file | A real "Choose XML file" button (the file field's own label, so Enter, Space and clicks are handled by the browser); "What file do I need?"; "come back to this tab"; stage-based progress words with Cancel | 1 browser test, keyboard flow |
| Questions | "Your file is ready" summary; a one-line description of each plan; "I don’t know" reassures; the charging question describes what was found and offers "I’m not sure"; the change question asks whether it reflects your routine now, with "I’m not sure" | 1 browser test |
| Result | Recommendation first ("Your lowest estimated-cost option" or "A seasonal switch may save the most"); "Why?" in the household's own figures; the saving always names what it is compared with; under $20 a year is "These options are close"; one main next step; "Edit my answers" and "Open a different file"; both answers shown when unsure; "Recommended plan by month"; "Seasonal switching"; "Changes start with a billing period" | 5 browser tests |
| Explanations | "How the estimate works" (method, known limits, prices and sources, report a problem) is separate from "Technical checks" (the app's tests and file details); the tests run only on Technical checks | existing tests |
| Responsive | One column on phones, tablets and at high zoom; the calendar wraps into two rows of six | no sideways scrolling at 390, 768 and 320 px |

Zoom test after the change: no sideways scrolling at 100% to 200% zoom on 1366 and 1920-pixel screens, nothing cut off.
This removes the reflow limitation recorded in the second pass. Numbers: identical to the previous pass (same intended
differences from v1.0). Unit tests 66 / 76, browser tests 50 / 50, 0 accessibility issues on every screen including
"How the estimate works", keyboard flow complete, reading level 7.3 or below. A bug found along the way: a syntax error
in the page code made the app blank; the build test now checks the page code is valid JavaScript.

## Code review, second pass (October 2026)

**Daylight saving, measured.** Worst case: 1 kW household plus a car adding 3 kW from midnight to 4 a.m. every
night, so every charge crosses the repeated or missing hour; history and forecast years each contain both changes.
Compared with pricing every real clock hour: energy +3.1 kWh in 13,140 (0.02%); Time-of-Use +$0.27, Ultra-Low
Overnight +$0.11, Tiered +$0.40 a year; the gap between Time-of-Use and Ultra-Low Overnight +$0.16 (forecast $112.01,
real hours $111.85). Decision: document the 24-hour-day approximation; a test fails if the gap error reaches $1.

**Accessibility.** The heatmap's numbers are also a table; the tab panel can be reached with Tab from the selected
tab; every bill-form error is marked on its field and linked to its message. Zoom test (sample household result):

| Screen | Zoom | CSS width | Sideways scrolling | Content cut off |
|---|---|---|---|---|
| 1366 px | 100% | 1366 | no | none |
| 1366 px | 125% to 200% | 1093 to 683 | yes | none |
| 1920 px | 100% to 150% | 1920 to 1280 | no | none |
| 1920 px | 175% to 200% | 1097 to 960 | yes | none |

The page does not reflow below 1,100 CSS pixels, so it does not meet WCAG 2.1 1.4.10 (Reflow); this is stated in the
app and the README, and no claim of full WCAG conformance is made.

**Continuous testing.** `.github/workflows/tests.yml`: the build is reproducible (`BUILD_DATE`), and CI checks
that `dist/index.html` matches a rebuild of the sources, then runs the Node tests, browser tests, schema checks and
the Python reference. Every step was simulated locally and passes; the rebuild is byte-for-byte identical.

**Prices checked against the sources** (October 22 2026). All 51 prices in `tariffs/rpp.js` (TOU, ULO and Tiered,
6 effective dates) match the OEB's "Historical electricity rates" page, as do the Tiered thresholds (600 kWh summer,
1,000 kWh winter). Rebate rates: 23.5% from Nov 1 2025 and 13.1% from Nov 1 2024 (utility notices; O. Reg. 24/25
changed 19.3% to 13.1%, confirming 19.3% for Nov 2023); 15.7% from Nov 1 2026 (OEB release); 11.7% for 2022-23
(Alectra bill insert). The 2026 holiday schedule matches the OEB's published list (unit test).

## Code review, first pass: Milestone 3 and minimum XML safeguards (October 2026)

**XML reader** (`src/xml.js`, rewritten). Entries must be real Atom children of the Atom `<feed>` root, and the feed
must be closed. Comments and CDATA are never read as markup, a quoted `>` inside an attribute is handled, and DOCTYPE
or entity declarations and unknown entities are refused. Nesting depth, entry size and entry count are limited
while reading. Every ESPI and Atom field is matched by namespace, and a field that may appear once can't appear twice.
12 tests on variants of one small file: 6 must read exactly like it, 6 must be refused. 10 of them fail on the old
reader, each for its own rule; the CDATA and cut-off-file cases were already handled. Reading time for a year of
15-minute data: 855 ms before, about 1,150 ms after; full page load 2.38 s.

**Milestone 3**, each with a test that fails on the code from before this pass for the reason it targets:

| Item | Change |
|---|---|
| Whole-bill ranking | Each forecast month carries its own tax-and-rebate factor; the plan ranking, schedule search, $20 threshold, scenario check and headline all use the cost after tax and rebate. Cards show it, with the electricity charges underneath |
| Switching steps | Generated from the month-by-month plan, including the first switch when the current plan differs |
| Bill-match notice | Cleared at once on any edit, on a check that stops on an error, and on a refused bill; the message names the checked billing period |
| Input checks | The engine refuses negative, infinite or impossible values (charging per week 0 to 2,000 kWh: more than an 11.5 kW charger delivers running nonstop is not a household), impossible dates and invalid bill amounts; the page shows a field-level message and keeps what was typed |
| Reading alignment | Only 5, 15, 30 or 60-minute readings, each starting on its own clock grid; others are refused as an unsupported format. Register reads are checked separately |
| "Verified" | Exact hostname of the selected meter's links; uom, multiplier, interval and flow checked |
| Reports | Check codes only, never text from the file; both report kinds have a preview; length bounded |
| Edge cases | Charging runs after a gap are found (and marked "clipped", counted for frequency, not per-session energy); a ULO bill from before May 2023 gets a plain message; partial months get no Tiered figure; tolerances shown per column |
| Page fixes | "(partial)" marker on month rows; a file with no usage draws its chart; local server refuses paths outside `dist/` and malformed addresses |
| Charging detection | Run once per file (cached by the readings themselves, so a new file never reuses it) |

**Comparison with v1.0.** The month-by-month forecast and break-even tables are identical. History is identical
except that the two partial months no longer show a Tiered figure. The 12-month totals in "How sure are we?" are
now after tax and rebate: for the author's file each equals the v1.0 figure × 0.973, to the cent. The headline
savings are unchanged. Tests: 65 public / 75 private unit tests, 36 browser tests, 63 in-page checks; 0
accessibility issues; reading level 7.3 or below.

## Trimming the repository (October 2026)

The made-up test files are no longer stored: `tests/synthetic.js` creates them when the tests run (in memory for the
Node tests, in a temp folder for the browser tests and the Python checks). Screenshots were reduced to 128 colours.
Two unused lines were removed from the page code. The repository went from about 1.9 MB to 0.97 MB. All tests pass
unchanged, the Python reference reproduces the stored result exactly, and every v1.0 number is unchanged.

## Follow-up: Gemini review (October 2026)

| Item | Outcome | Test |
|---|---|---|
| Charging baseline on hourly data | **Fixed.** The household baseline is now the readings in the 2 hours before a session, counted in time, not the 8 readings before it (which for hourly data reached back 8 hours into the dinner-time peak). On an hourly test file with a known 21 kWh per session, the old code measured 13.5 kWh; the fixed code measures 21 | 1 unit test |
| Bill form cleared when switching tabs | **Fixed.** Entered figures are kept for the visit | 1 browser test (fails on beta13) |
| Page jumping while editing assumptions | **Fixed.** The page stays put and focus stays on the field | 1 browser test (fails on beta13) |
| Smaller data from the background thread | **Kept, after a closer measurement.** A whole-load timing first showed no difference (run-to-run variation of about 0.4 s hid it). Timing the copy step itself: 62.7 → 27.2 ms for a year of 15-minute data, 124.2 → 52.3 ms for two years. Median load afterwards 2.48 s (2.60 s before) | Measurement |
| Leap-year proration | **Documented.** Monthly charges use days ÷ (365 ÷ 12), confirmed on a non-leap-year bill; leap years to be confirmed with a 2028 bill (about a cent either way) | — |
| Overlap count, schedule ties, bundler | No change needed (the review's own analysis found them sound) | — |

**A bug found while doing this:** an editing mistake left a syntax error in the worker file. The page silently fell
back to reading files without the background thread, so every existing test still passed. Two guards now catch it:
the build test checks the worker is valid JavaScript, and a browser test confirms the file was read by the background
thread. Both were confirmed to fail when the error is put back.

The author's own results are unchanged (15-minute data: 8 readings were already exactly 2 hours). The sample household
(hourly data) now measures 92 kWh of charging a week instead of less, and its headline saving moved from $75 to $83 a year.
Unit tests 39 public / 49 private, browser tests 27 / 27, in-page checks 37 / 37.

## Follow-up: prices by month and the rate zone (CR-12, CR-13)

- **CR-12:** each forecast month is now priced at the OEB prices in effect that month, instead of the latest prices
  for all 12 months. Months after the next expected price change (normally November 1) use the latest known prices,
  and the result says so. The result note and the disclaimer describe the prices actually used. The estimate starts
  the month after the last day the file covers. Tests: an estimate starting in October 2026 prices October at the
  November 2025 prices; a month after the next price change is marked as assumed.
- **CR-13:** the rate zone doesn't affect the recommendation (plan comparisons use province-wide prices, HST and the
  rebate). It only matters for the optional whole-bill check, which never chooses a zone for you and now shows
  "Rate zone used: …".
- The author's own estimate is unchanged (all 12 months fall in the November 2026 price period). The sample
  household's headline saving moved from $73 to $75 a year, because its October is now priced correctly.
  Unit tests 38 public / 48 private, browser tests 24 / 24, in-page checks 36 / 36.

## Milestone 2 of the code review: accurate explanations

| Review item | Fix | Test |
|---|---|---|
| CR-08 Complete months and days | A month is complete only if readings cover all of its time, not just every date. The forecast uses only fully covered days, and counts charging sessions only on those days | 2 unit tests, 1 browser test |
| CR-09 Confidence | A scenario counts only if the recommendation is still strictly the cheapest option there (no $10 tolerance). The page says what was compared, that the switching schedule is the one worked out for "like recent months", and "No car charging is included" when none is modelled | 1 unit test, 1 browser test |
| CR-12 Old files | The estimate starts the month after the file ends, or this month if the file is older. Files more than 2 months old get a notice naming the last day covered | 1 browser test |
| CR-13 Utility rules | The rate zone is never chosen for you. Optional bill date picks the rebate rate. Bills dated before the tool's tariff are flagged. Alectra's billing-date rule is labelled as an assumption for other utilities | 1 browser test |
| CR-15 Public reports | Allowlisted metadata and issue codes only: no channel titles or other text from the file. A preview shows exactly what will be sent | 1 unit test, 1 browser test |

After Milestone 2: unit tests 36 public / 46 private, browser tests 24 / 24, in-page checks 34 / 34; every number
v1.0 showed is unchanged; the confidence result unchanged;
0 accessibility issues; keyboard flow complete; reading level 8.3 or below.

## Milestone 1 of the code review: safe data and state

The October 2026 code review (GPT-6 and Gemini) found real bugs, confirmed in the code before fixing.
Each fix has a test that reproduces the original problem.

| Review item | Fix | Test |
|---|---|---|
| CR-01 Invalid readings | Every reading is checked (time, length, value, units, file span) before anything is calculated; unusable files are rejected with a plain reason | 4 unit tests |
| CR-02 Duplicates and overlaps | Identical repeats count once; conflicting repeats and overlaps reject the file; gaps use the time actually covered | 3 unit tests |
| CR-03 Channel selection | Net metering rejected; files with several meters, or several candidate channels, rejected rather than guessed; register reads must belong to the same meter | 3 unit tests |
| CR-04 Bill check | Each line has a status (matches, doesn't match, used as an input, from your bill, not checked); total usage compared on its own; a partly covered period can't "match"; Tiered whole-bill check off; numbers validated; a later failed check removes the "matches" notice | 7 browser tests |
| CR-05 State per file | All file-dependent settings reset together when a new file starts loading | 1 browser test |
| CR-06 Stale jobs | Only the newest file can change the page; older work is stopped and ignored; starting over cancels it | 2 browser tests |
| CR-07 Charging override | Unticking "treat as car charging" always takes effect | 1 browser test |
| CR-16 Form and focus | Changing the cross-check month keeps entered figures; focus returns after editing an assumption | 3 browser tests |

The browser tests (`tests/browser/regression.py`) fail on the pre-fix build (beta8) for the bugs they target, and
pass on the fixed build. After the fixes: unit tests 33 public / 43 private, browser tests 19 / 19, in-page checks
31 / 31; every number v1.0 showed is unchanged (the bill check now also shows a Total usage row, a new line, not
a changed one); 0 accessibility issues; keyboard flow complete; reading level 8.3 or below.

## Re-run after the disclaimer and wording review

After the disclaimer review (hobby-project status, no-support and no-warranty wording, corrected rebate and
privacy statements, "latest prices", estimated-result labels, confidence wording for homes without a car,
narrower bill-match message, public-GitHub warning and a "Report a problem" link), every check above was run
again: tests 24 / 34 pass, all 296 numbers still identical to v1.0, 0 accessibility issues, keyboard flow
complete, every public screen grade 8.3 or below.

## 1. Numbers: v1.0 versus v2.0

Same file, same answers to the questions, and the same bill in both versions. (The file, answers and bill are the author’s and are kept private.)
Every number in each table was extracted from both versions and compared as a whole set.

| Table | Numbers | Result |
|---|---|---|
| Monthly costs at today's prices | 75 | Identical |
| Monthly costs at the prices then | 75 | Identical |
| 12-month totals, 3 scenarios | 12 | Identical (the 13th "number" is the "12" in the new heading) |
| Month-by-month forecast | 72 | Identical |
| Break-even charging | 36 | Identical |
| Bill check, line by line | 16 | Identical |
| Whole bill | 22 | Identical |
| Headline savings on the whole bill | 2 | Identical, now rounded to whole dollars |

Before and after screenshots with real data are kept in `private/verification/` (not committed).

## 2. Accessibility

Automated checks on every screen (start, can't help, get your file with and without a utility, file error,
questions, result with each of the four evidence tabs, How we know, disclaimer), in light and dark mode:
`lang` set; header, main and footer landmarks; one `h1` per screen; no skipped heading levels; no duplicate IDs;
every ARIA reference points to an existing element; every form field has a label; every button and link has a
name; every SVG is either labelled (`role="img"` + `aria-label`) or hidden; no positive `tabindex`; and the
contrast of every visible text element against its actual background (4.5:1, or 3:1 for large text).

Found and fixed during verification: skipped heading levels on three screens, and the "Best for you" tag in
dark mode (2.2:1, now 8.9:1). Lowest text contrast after the fixes: 5.35:1 (light), 6.31:1 (dark).

This is not a substitute for axe or Lighthouse. Run them as described in section 6.

## 3. Keyboard only

Completed the whole flow with Tab, Shift+Tab, Space, Enter and the arrow keys only:
first Tab reaches "Skip to content"; Space selects answers; arrow keys move within answer groups; Enter on the
drop zone opens the file chooser; focus moves to the result heading when the result appears; arrow keys switch
the four evidence tabs; the footer links and the Back button work. No focused element lacked a visible outline.

Fixed during verification: the "Get your usage file" heading was in the right-hand column, so it took 9 Tab
presses to reach the utility list; the heading now sits above both columns (1 Tab press). Date fields had no
outline while typing into their parts; fixed.

Note: in Chrome, Tab moves through the month, day and year parts of a date field before leaving it. That is
standard browser behaviour.

## 4. Colour blindness

The four price-period colours were chosen with the Machado et al. (2009) simulation. Smallest colour difference
(CIE ΔE) between any two periods under any simulated condition: **34.5** (v1.0: 15.3, where protanopes nearly
confused off-peak with on-peak). Plan colours: smallest difference 21.5 (tritanopia), and every plan colour keeps
white text at 5.4:1 or more. Colour is never the only cue: every coloured block also has a text label.

Simulated screenshots (sample household): `docs/verification/cvd-calendar.png`, `cvd-heatmap.png`, `cvd-bars.png`.

## 5. Reading level

Flesch-Kincaid grade of the visible text (tables excluded):

| Screen | Grade |
|---|---|
| Start | 7.3 |
| Can't help (retailer) | 8.3 |
| Get your file (Alectra) | 7.0 |
| Questions | 2.0 |
| Result | 5.0 |
| Your past year | 4.7 |
| Check a bill | 4.2 |
| Data quality | 6.0 |
| How sure are we? | 5.5 |
| Disclaimer | 7.1 |

"How we know" is for developers and is not included.

## 6. What you still need to run

**Serve the page.** Lighthouse can't audit a file opened from disk, so serve it locally:

```bash
cd /c/TestProjects/pricecompare
node tools/serve.mjs
```

Then open http://localhost:8080 in Chrome.

**Lighthouse.** In Chrome, open DevTools (F12), then the **Lighthouse** tab.

1. Choose **Snapshot** mode, **Desktop**, and only the **Accessibility** category.
2. Take a snapshot on each of these screens: Start; Get your file; Questions (after opening your file); Result.
   Then take one on each evidence tab, How we know, and the Disclaimer.

Target: 100 on every screen. Snapshot mode is needed because the result only appears after you interact.

**axe.** Install the free **axe DevTools** extension for Chrome. On each screen above, open DevTools, go to the
**axe DevTools** tab and click **Scan all of my page**. Target: 0 issues. Note anything flagged under
"needs review" too.

**NVDA** (free, from nvaccess.org). Start NVDA, open the page in Chrome, and use only the keyboard. Check that:

1. The first Tab announces "Skip to content, link".
2. On the start screen, Tab into the choices announces the question ("Who sends your electricity bill?, grouping")
   and each choice with its description. Space selects.
3. On the file screen, the drop zone announces as a button with its instructions. While reading, the progress
   text is announced ("Reading your file… 40%"). An unusable file announces its error message.
4. On the questions screen, each question announces as a group with its hint. The checkbox announces its full
   sentence. "Show my result" announces as unavailable until everything is answered.
5. When the result appears, NVDA reads the heading "Your best plan for …". The calendar announces as one image
   that lists every month and plan.
6. Under "See why", the tabs announce as "tab, 1 of 4" and so on. Arrow keys move between them.
7. In tables, Ctrl+Alt+arrow keys read the row and column headers with each number.
8. Press H to jump from heading to heading on each screen: the order should make sense.

Write down anything that is announced unclearly, or not at all.
