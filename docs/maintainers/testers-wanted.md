# Inviting testers

Three versions of the same invitation: a pinned post on GitHub, a forum or Reddit post, and a short note for local
groups or friends. Replace `[FORM LINK]` with your feedback form's link (see `feedback-form.md`).

Before posting anywhere, **read that community's rules**: many limit self-promotion. A post that asks for feedback on
a free tool usually goes over better than an announcement. Reply to comments for the first day or two; that matters
more than the post itself.

---

## 1. Pinned GitHub discussion (category: Announcements)

**Title:** Looking for testers: does the result make sense for your home?

> Ontario Hydro Plan Compare is a free hobby tool that works out which electricity price plan (Time-of-Use,
> Ultra-Low Overnight or Tiered) is likely cheapest for your home, from your own smart-meter readings. Your file is
> read in your browser and never uploaded.
>
> **What would help most:**
>
> - **Try it with your own Green Button file** and tell us whether the result made sense.
> - **Especially wanted: anyone not on Alectra.** Hydro One, Toronto Hydro, Hydro Ottawa, Elexicon and other utilities
>   haven't been checked yet. If you can, use "Check my bill" with one recent bill and tell us whether it matched.
> - **What confused you?** Any step, word or number.
>
> **How to tell us:**
>
> - No GitHub account? Use this short form: [FORM LINK] (about 3 minutes, no file uploads).
> - With a GitHub account: reply here, or use the **"My utility's file doesn't work"** form under Issues.
>
> **Please never post or attach your bill or usage file**, even with your name removed. The app can make a
> description of your file for reports that contains no readings and no text from the file.
>
> This is a hobby project, so replies and fixes aren't guaranteed, but every report is read. Thank you!

---

## 2. Forum or Reddit post (RedFlagDeals, r/ontario, r/PersonalFinanceCanada, EV groups)

**Title:** I made a free tool that checks TOU vs ULO vs Tiered using your own smart-meter data. Looking for feedback

> With the November 1 price change, I wanted to know whether Ultra-Low Overnight was still worth it for my home, so I
> built a small tool. You download your Green Button file from your utility's website (about 5 minutes), open it in
> the tool, and it estimates the next 12 months on each plan, including whether switching plans with the seasons
> would save money.
>
> - Free, no sign-up, no ads. Your file stays in your browser and is never uploaded.
> - It shows its working: your past year's costs on each plan, how sure the estimate is, and a check against one of
>   your bills.
> - It's a beta. It's been checked against Alectra bills so far, and I'd really like to hear from people on other
>   utilities.
>
> Try it: https://electricity-plans.github.io/ontario-hydro-plan-compare/
> Feedback form (no file uploads): [FORM LINK]
>
> Please don't post your bill or usage file here. It's an estimate, not advice; your utility's bill is always the
> official amount. Happy to answer questions.

**For EV groups, add:** "If you charge at home, it detects your charging sessions and checks how the answer changes
if you charge more or less."

---

## 3. Short note (local Facebook groups, Nextdoor, friends, coworkers)

> I built a free website that works out which hydro price plan (Time-of-Use, Ultra-Low Overnight or Tiered) is
> cheapest for your home, from your own meter readings. Your file never leaves your computer. I'm looking for a few
> people to try it and tell me what's confusing:
> https://electricity-plans.github.io/ontario-hydro-plan-compare/ (feedback form: [FORM LINK])

---

## A 10-minute task for casual volunteers

For people who'd like to help but don't want to download their own file:

1. Open the app and choose **"See a sample result"**.
2. What does it recommend?
3. What is the saving being compared with?
4. Where would you look to see what could change the answer?
5. What's the first thing you'd do if you followed the recommendation?
6. Was anything confusing?

Answers can go in the feedback form or a reply to the pinned discussion.

## Other ways to help

**Browser and accessibility testers:** Firefox and Safari, Windows and Mac, keyboard only, a screen reader, high
zoom, a phone or tablet. Use the **Accessibility problem** form for anything that doesn't work.

**Small tasks for contributors** (label them `good first issue` or `help-wanted`):

- Check one utility's download steps with your own account, and suggest corrected wording (no screenshots of the
  account needed).
- Check one year's prices in `tariffs/rpp.js` against the OEB's historical rates page.
- Transcribe one utility's charges from its OEB rate order into `tariffs/utilities.js`.
- Add a made-up test file for a file format that turned up in a report.
- Improve one hint or message in the app.

## Recruiting the five usability testers

The public posts bring feedback, but the moderated sessions in `docs/usability-test-plan.md` need people you can
watch. Add this line to the short note or the forum post:

> "Would you do a 30-minute screen-share test, using your own utility account? Reply or message me."

Choose testers to match the plan's mix: at least two not on Alectra, at least two with a car charged at home, at
least one who isn't comfortable with computers, and nobody who has seen the tool before.
