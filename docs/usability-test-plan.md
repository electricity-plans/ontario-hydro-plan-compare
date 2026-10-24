# Usability test plan: v2.0 beta

## Goal

Find out whether Ontario households who have never heard of Green Button can, without help:

1. get their usage file;
2. open it in the tool;
3. understand which plan the tool recommends, how much it saves, and how sure it is;
4. know what to do next.

**Pass criterion for launch:** at least 4 of 5 testers state the recommendation, unaided and in their own words
(task 4). Any task with fewer than 4 of 5 successes gets fixed and retested before the tool goes public.

## Testers (5)

Recruit for a mix. One person can cover several of these:

- At least 2 people who are **not on Alectra** (Hydro One, Toronto Hydro, Hydro Ottawa, Elexicon or another).
  This is how unverified utilities get tested.
- At least 2 who charge an **electric car** at home, and at least 1 who doesn't.
- At least 1 who is **not comfortable** with computers.
- At least 1 who **doesn't know** which plan they're on.
- Nobody who has seen the tool before, and not you.

Each tester uses **their own computer** and **their own utility login**, so the file download is real.
Allow 45 minutes. Do it in person or by screen share.

## Before the session

- Send them nothing about the tool in advance, only: "Please have your utility's website login and, if you
  can, one recent electricity bill nearby."
- Have the tool ready at the published link, or as `dist/index.html` sent to them.
- Prepare the five-second test image: `docs/usability/five-second-test.png`.
- Print or open the record sheet (end of this document).

## Protecting testers

- **Never ask for login details.** Testers sign in to their utility themselves.
- **Don't record sessions** unless the tester agrees beforehand; notes are enough.
- **Ask testers to pause screen sharing while they sign in** or look at account details, and to resume once they're
  on the download page.
- **Screenshots can show file names, dates and usage.** Don't take any without asking, and never publish them.
- **Collect only what improves the app:** the record sheet, with initials only.
- **Say when notes will be deleted** (for example, one month after the fixes are released), and do it.
- **Ask before quoting** anyone's words publicly, even anonymously.
- **Taking part never requires sharing a file.** If a file problem needs looking into, first try to reproduce it
  with a made-up file of the same shape.

## Script

**Introduction (read aloud):**
"Thanks for helping. We're testing a website, not you. There are no wrong answers. Please think out loud: tell me
what you're looking at, what you expect, and anything that confuses you. I won't help unless you're really stuck,
because I want to see where the website needs to be clearer. Your electricity file stays on your computer. I
won't see your usage unless you choose to share your screen."

### Five-second test (do this first, before they see the tool)

Show `five-second-test.png` for exactly **5 seconds**, then hide it. Ask:

1. "Which plan did that page recommend?"
2. "About how much would it save in a year?"
3. "How sure was it?"

**Success:** correct plan (Ultra-Low Overnight, then Time-of-Use, or "switch between them"), saving within $10 of
$82, and that it gave the same answer in two of three charging scenarios (or "fairly sure", "mostly"). **Target:** 4 of 5 get the plan right.

### Tasks

Give one task at a time. Record time, success (yes / with help / no), and what they said.

| # | Task (say this) | Success means | Watch for |
|---|---|---|---|
| 1 | "You want to know which electricity price plan is cheapest for your home. Open this website and start." | Picks the right answer to "Who sends your bill?" and continues | Do they understand "sub-metering" and "retailer"? |
| 2 | "Get the file the website asks for, from your utility's website." | Downloads an XML file of 12 months or more within 10 minutes | **Write down the exact menu names they click** (this fills gaps in our instructions). Do they download CSV by mistake? |
| 3 | "Use the file to get your result." | Reaches the result screen | Do they read the checkbox or just tick it? Do they know their current plan? |
| 4 | "In your own words, what does the website recommend, and why?" | States the plan (or switching schedule) and roughly the saving, **without help** | This is the launch criterion. Note their exact words. |
| 5 | "How sure is the website about that? What could change its answer?" | Paraphrases the confidence and one thing that could change it | Do they notice "How sure are we?" |
| 6 | "If you wanted to switch, what would you do, and when?" | Finds the switching link and the timing | Do they understand "10 business days before your next billing period"? |
| 7 | (If they have a bill) "Check whether the website's numbers match your bill." | Finds "Check a bill", enters the figures, understands "matches" | Which fields confuse them? Is the "from" date clear? |
| 8 | "Is there anything on this website you'd want to know more about?" | (Open question) | Do they find "Your past year", "Data quality" or "How we know"? |

For **unverified utilities** (not Alectra), also note: did they see the yellow notice? Did they understand it? Did
they try "Check it against my bill"? If their bill matches, that utility can be added to the verified list.

### Two extra questions (after task 4)

- "What is this saving being compared with?"
- "What would you do first if you followed this recommendation?"

### Situations to cover across the five sessions

Use each tester's own file where it fits; otherwise use the sample result or a prepared file.

- A small-saving ("These options are close") result.
- An unknown current plan ("I don’t know").
- A file from a utility the tool hasn't verified yet.
- A seasonal schedule that needs a switch straight away.

### After the tasks

1. After each task: "On a scale of 1 (very hard) to 7 (very easy), how easy was that?"
2. "How much do you trust the result? Why?"
3. "What was the most confusing part?"
4. "Would you switch plans based on this? Would you recommend it to a friend?"
5. "Is there anything you expected to see that wasn't there?"

### Optional: donate your file

"Would you be willing to share your electricity file privately, so we can check the tool against another utility?
It's completely optional." If yes:

1. Keep the file in your `private/` folder, which git ignores. **Never commit a real file, even anonymised:** a
   year of readings shows when someone is home.
2. Check it with the app and, if they're willing, one of their bills.
3. For the repository, write a made-up file **of the same shape** (same web address, interval length, units and
   channels, but invented readings), like `synth-alectra-shape.xml` in `tests/synthetic.js`, and add a test for it.
4. Delete the donated file when you're done, and tell the donor you have.

## Analysing the results

For each problem seen:

1. Note how many testers hit it.
2. Rate its severity: **3** stops the task; **2** slows them or causes a mistake; **1** cosmetic.

Fix every severity-3 problem and every problem that 2 or more testers hit, then retest with 1 or 2 new people.

## Record sheet (one per tester)

| | |
|---|---|
| Tester | (initials only) |
| Utility | |
| Electric car charged at home? | yes / no |
| Current plan known? | yes / no; plan: |
| Five-second test | plan ✓/✗; saving ✓/✗; confidence ✓/✗ |

| Task | Time | Success (yes / help / no) | Ease (1–7) | Notes, exact words |
|---|---|---|---|---|
| 1 Start | | | | |
| 2 Get the file | | | | Menu names clicked: |
| 3 Get the result | | | | Read the checkbox? |
| 4 State the recommendation | | | | |
| 5 How sure | | | | |
| 6 How to switch | | | | |
| 7 Check a bill | | | | |
| 8 Open question | | | | |

Trust (1–7): ____ Would switch? ____ Would recommend? ____
Most confusing part:
File donated? yes / no
