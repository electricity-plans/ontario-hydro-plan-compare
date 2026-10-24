# Saved replies and moderation

Add these under **GitHub → Settings (your account) → Saved replies**. Then, in any comment box, the "↩" (saved
replies) button inserts one. Edit the bracketed parts before sending.

## Saved replies

**Thanks, need the check codes**
> Thanks for reporting this! Could you add the **check codes**? In the app, open "How the estimate works", then
> "Report a problem", then "See exactly what will be sent", and copy the "Check codes" line. It contains no
> personal details. Please don't attach your bill or usage file.

**Thanks, need the file description (utility support)**
> Thanks! This helps the app support more utilities. Could you paste the app's **file description**? Open
> "Technical checks", then "Report a compatibility issue", then "Copy the description". It contains no readings
> and no text from your file. Please don't attach the file itself.

**Removed personal information**
> I've removed [your bill / your file / an account number] from this thread to protect your privacy: GitHub issues
> are public and search engines index them. Copies may already exist (for example, in notification emails), so if
> it included anything sensitive, you may want to keep an eye on that account. Thanks for understanding!

**Can't reproduce**
> Thanks for the report. I tried this with [the sample result / a test file like yours] and couldn't make it happen.
> Could you share the steps again, the app version (bottom of the page) and your browser?

**Fixed in a release**
> Fixed in **v[X.Y.Z]**: [one-line description]. Thanks for reporting it! The live app is already updated; reload
> the page to get the new version.

**Good idea, on the list**
> Thanks, that's a good idea. I've labelled it `idea` so it doesn't get lost. I can't promise when (or whether)
> it'll be built, since this is a hobby project.

**Out of scope**
> Thanks for the suggestion. It's outside what the tool covers for now, which is households buying electricity from
> their local utility on the OEB's price plans, so I'm closing this as out of scope. [Optional: why.] It's not a
> judgement on the idea.

**"Should I switch?"**
> The app gives an estimate from your past usage, not advice, so I can't recommend what you should do. Your result's
> "How sure are we?" section shows what could change the answer, and your utility can confirm when a switch would
> start. Your bill is always the official amount.

**Closing for inactivity**
> I'm closing this for now since there hasn't been a reply in 30 days. Happy to reopen it if you have more details.

**Duplicate**
> Thanks! This is the same as #[number], so I'm closing this one to keep the discussion in one place. Please add
> any extra details there.

## Moderation

- **Personal information posted:** edit the comment ("…" → Edit) to remove it, or delete the comment, then use
  "Removed personal information". Do this before anything else. Don't quote or copy it anywhere, and **never promise
  it's completely gone**: notification emails and anyone who already viewed it may have a copy. If a file was attached, delete the comment, since
  editing doesn't remove the attachment from GitHub's servers; GitHub Support can purge it if needed.
- **Heated thread:** "…" → Lock conversation (with a short reason such as "too heated").
- **Spam or abuse:** hide the comment ("…" → Hide → Spam or Abuse), and block the user from your profile settings
  if it continues.
- **Sudden flood:** Settings → Moderation options → Interaction limits, to limit comments to past contributors for
  24 hours.
- **Code of conduct:** point to `CODE_OF_CONDUCT.md` once, briefly, before taking any of the steps above.

## Weekly triage (about 20 minutes)

1. **New issues and discussions:** label each one, and reply where you can.
2. **`needs-info` older than 30 days:** close with "Closing for inactivity".
3. **Feedback form responses:** read them, and open issues for anything actionable (without personal details).
4. **Anything fixed:** release it, and reply with "Fixed in a release".
