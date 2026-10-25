# Releases and rollback

## Version numbers

The version in `package.json` is the one shown at the bottom of every page, so each release gets its own number:

- **Betas:** `2.0.0-beta.1`, `2.0.0-beta.2`, …
- **Then:** `2.0.0`; `2.0.1` for fixes; `2.1.0` for new features or new prices; `3.0.0` if results change a lot.

## Making a release

1. Update `"version"` in `package.json` and the version line near the top of `README.md`, and add an entry at the
   top of `CHANGELOG.md` (template below).
2. `node tools/build.mjs` and `node tests/run.mjs`; commit both; push; merge to `main` once CI passes. The Pages
   workflow publishes the app.
3. **Releases → Draft a new release:** tag `v2.0.0-beta.2` (matching `package.json`), paste the changelog entry
   followed by the release footer below, and **attach `dist/index.html`**, so people can save the app and use it
   offline. Set **Release label** to **None**, not Pre-release, so the README's "latest release" link finds it.
4. Open the live app and check the version at the bottom of the page.

### Changelog entry template

```
## 2.0.0-beta.2

**Prices:** OEB prices from November 1, YYYY.

- What changed, in plain words (one line each).

**Results may change:** yes/no. If yes: which figures, and why.
```

### Release footer (end every release description with this)

```
A free, independent hobby project. Not made by, endorsed by or connected to the Ontario Energy Board, the Government
of Ontario, or any electricity utility. Results are estimates, not advice, and your utility's bill is always the
official amount. Please never post your bill or usage file in issues or discussions.
```

## Rolling back

If a release turns out to be wrong:

1. **Quickest:** Actions → **pages** → **Run workflow**, choose the **previous release's tag** under "Use workflow
   from", and run it. The live app goes back to that version within minutes.
2. **Then fix it properly** on a branch, and release the fix as a new version. Don't delete the broken release;
   mark it in its notes ("Withdrawn: use 2.0.0-beta.3").
