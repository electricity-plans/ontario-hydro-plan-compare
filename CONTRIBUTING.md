# Contributing

Thanks for your interest! **Ontario Hydro Plan Compare** is a free hobby project. Every report is read, but replies,
fixes and new features aren't guaranteed.

## The quickest ways to help

- **Try it with your own file** and tell us whether the result made sense. Reports from utilities other than Alectra
  are especially useful: use the **"My utility's file doesn't work"** template if anything looks off.
- **Report a bug** with the **Bug report** template.
- **Suggest an idea** with the **Feature idea** template, or start a conversation in **Discussions**.

## Privacy: please read this first

GitHub issues and discussions are **public**.

- **Never attach your bill or your usage (Green Button) file**, even with your name removed. A year of readings shows
  when someone is usually home.
- Never post account numbers, addresses or meter numbers.
- The app can produce descriptions for reports that contain **no readings and no text from your file**: use those.

If something personal is posted by mistake, it will be removed.

## What the tool covers

Households that buy electricity directly from their local utility on one of the Ontario Energy Board's price plans
(Time-of-Use, Ultra-Low Overnight, Tiered). Retailer contracts, sub-metered condos, homes with solar or other
generation, and businesses are outside its scope for now. Ideas outside that scope may be closed as "out of scope",
which isn't a judgement on the idea.

## Changing the code

The app is plain JavaScript with no dependencies. You need Node.js 22.

```bash
node tests/run.mjs        # unit tests (also run inside the built page)
node tools/build.mjs      # builds dist/index.html from src/, tariffs/ and app/
node tools/serve.mjs      # serves dist/ at http://localhost:8080
```

Optional: browser tests and the independent Python checks need Python 3 with Playwright and lxml (see the README).

**Two rules that protect the privacy promise:**

- **No dependencies.** The app has no libraries, on purpose: everything it does can be read in this repository, and
  nothing changes underneath it. Pull requests that add packages (npm or otherwise) won't be merged.
- **Careful review.** Changes to how files are read, to what goes into public reports, or to prices are reviewed line
  by line by the maintainer before merging, however small.

**Before opening a pull request:**

1. Run `node tests/run.mjs` and `node tools/build.mjs`, and commit the rebuilt `dist/index.html`.
2. Add a test for any change in behaviour. A bug fix should come with a test that fails without the fix.
3. Use **made-up data only.** Test files are created by `tests/synthetic.js`; never add a real usage file or bill,
   even anonymised.
4. Keep text plain and short: the app is written for households, at about a grade 8 reading level.
5. Price changes need a source: add the OEB page or regulation to `tariffs/`, next to the numbers.

The CI workflow runs every test on each pull request, and `main` only accepts changes that pass.

## Licence

The project is under the [MIT License](LICENSE). By contributing, you agree that your contribution is licensed under
the same terms.
