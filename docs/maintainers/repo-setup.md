# Repository setup checklist (one-time, after the repository is public)

Settings that GitHub keeps outside the files. Tick them off once.

## Pages: publish the app
- [ ] **Settings → Pages → Build and deployment → Source: GitHub Actions.**
      `.github/workflows/pages.yml` then publishes `dist/` on every push to `main`, after the tests pass.
- [ ] After the first run, open the link it shows (`https://electricity-plans.github.io/ontario-hydro-plan-compare/`)
      and check the app works, including "See a sample result".

## Discussions
- [ ] **Settings → General → Features → Discussions** on.
- [ ] Categories: **Q&A** (question/answer format), **Ideas**, **Show your result**, **Announcements**
      (only maintainers can post). The issue chooser links to Q&A.

## Labels (Issues → Labels)
| Label | Colour | Description |
|---|---|---|
| `bug` | `d73a4a` | Something doesn't work as it should |
| `utility-support` | `0e8a16` | A utility's Green Button file isn't supported or checked yet |
| `idea` | `a2eeef` | A suggested improvement |
| `question` | `d876e3` | Asking how something works |
| `needs-info` | `fbca04` | Waiting for more details from the reporter |
| `out-of-scope` | `cccccc` | Outside what the tool covers |
| `good first issue` | `7057ff` | A small, well-defined change for a new contributor |
| `help-wanted` | `008672` | Help from volunteers is welcome |
| `accessibility` | `5319e7` | Keyboard, screen reader, zoom or other assistive technology |
| `tariff-data` | `c5def5` | Prices, rebates, holidays or utility charges |
| `documentation` | `0075ca` | README, help text or guides |

## Code of conduct
- [ ] **Add file → Create new file**, name it `CODE_OF_CONDUCT.md`, then choose **"Choose a code of conduct template"**
      and pick the **Contributor Covenant**. Enter a contact method you're comfortable with (a GitHub profile link
      works; you don't need to publish an email address).

## Security
- [ ] **Settings → Security → Private vulnerability reporting: Enable.** (`SECURITY.md` points people there.)

## Protect `main`
- [ ] **Settings → Rules → Rulesets → New branch ruleset**, target `main`:
  - Require a pull request before merging (you can approve your own as the only maintainer: set required approvals to 0).
  - Require status checks to pass: **test** (from the "tests" workflow).
  - Block force pushes.

## Notifications (your account settings)
- [ ] **Settings → Notifications:** email only for participating and @mentions; or use the GitHub mobile app's inbox.
- [ ] On the repository: **Watch → Custom → Issues, Pull requests, Discussions, Security alerts.**

## Pages security
- [ ] **Settings → Pages: Enforce HTTPS** ticked (github.io addresses have it on by default; check anyway).

## First release
- [ ] Follow `docs/maintainers/releases.md`: tag `v2.0.0-beta.1`, paste the `CHANGELOG.md` entry, attach `dist/index.html`.
