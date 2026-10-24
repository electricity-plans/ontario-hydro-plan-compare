# Feedback form (for people without a GitHub account)

Most households don't have a GitHub account, so a short form gets far more feedback. Build it in **Microsoft Forms**
or **Google Forms** from a **personal** account (not a work one).

## Settings

- **Don't collect email addresses or names.** Turn off "Record name" (Microsoft) or "Collect email addresses"
  (Google). Responses are anonymous unless someone chooses to leave contact details in the last question.
- **No file uploads.** Don't add a file-upload question, ever.
- Allow one response per person if the tool offers it without requiring sign-in; otherwise leave it open.
- Confirmation message: "Thank you! Every response is read. This is a hobby project, so I can't reply to each one."

## Description at the top of the form

> Thanks for trying Ontario Hydro Plan Compare. This takes about 3 minutes. Please **don't include** your bill,
> account number, address or meter number. Answers are anonymous unless you choose to add contact details at the end.

## Questions

| # | Question | Type | Choices / notes |
|---|---|---|---|
| 1 | Who is your electricity utility? | Choice | Alectra, Hydro One, Toronto Hydro, Hydro Ottawa, Elexicon, Other (with text), I don't know |
| 2 | Did you try it with your own file, or the sample? | Choice | My own file; The sample result; I couldn't get my file |
| 3 | How easy was it to download your usage file from your utility? | Rating 1 to 5 | Only if 2 = own file. 1 = very hard, 5 = very easy |
| 4 | If it was hard, what was the hardest part? | Text | Optional. "The menu names you clicked help most." |
| 5 | Did the app read your file? | Choice | Yes; Yes, but it said my utility hasn't been checked yet; No, it showed an error |
| 6 | Which plan did the app recommend for you? | Choice | Time-of-Use; Ultra-Low Overnight; Tiered; Switching with the seasons; "No change needed"; I'm not sure |
| 7 | Did the result make sense for your home? | Rating 1 to 5 | 1 = not at all, 5 = completely |
| 8 | Did you try "Check my bill"? | Choice | Yes, it matched; Yes, some lines didn't match; No |
| 9 | How much do you trust the result? | Rating 1 to 5 | 1 = not at all, 5 = completely |
| 10 | What was confusing, or what would you change? | Text | Optional |
| 11 | Anything else? | Text | Optional |
| 12 | May I contact you about your answers? | Text | Optional. "Only if you'd like a reply: an email address or a GitHub username." |

Questions 6, 7 and 9 tell you whether the result is understood and trusted. Questions 1, 5 and 8 tell you which
utilities work.

## After you've made it

- Put the link in the README's "Help wanted" line, the pinned GitHub discussion, and the posts in `testers-wanted.md`.
- The app's "Report a problem" section can link to it too (an easy change once the link exists).
- Read responses during the weekly triage. If a response reports a utility problem, open a `utility-support` issue
  yourself, with only what's needed and nothing personal.
