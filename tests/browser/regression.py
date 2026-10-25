"""Browser regression tests for the page (Playwright, Chromium).
Each test reproduces a bug found in the Oct 2026 code review and checks it stays fixed.
Run from the repository folder, after `node tools/build.mjs`:
  python3 tests/browser/regression.py [path-to-a-large-export.xml]
The optional large file is only used to test opening a second file while the first is still loading.
Needs: Python 3, `pip install playwright`, `python -m playwright install chromium`."""
import asyncio, json, sys, subprocess, os, datetime
DATA = subprocess.run(['node', 'tests/browser/make-data.mjs'], capture_output=True, text=True, check=True).stdout.strip()
from playwright.async_api import async_playwright
PAGE = 'file://' + __import__('os').path.abspath('dist/index.html')
REAL = sys.argv[1] if len(sys.argv) > 1 else None
results = []
def check(name, cond, detail=''):
    results.append((cond, name, detail)); print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

async def open_file(pg, path, plan='tou', charging='yes', horizon='recent', ack=True):
    await pg.goto(PAGE); await pg.check('input[name=who][value=utility]'); await pg.click('#go-who')
    await pg.set_input_files('#file', path); await pg.wait_for_selector('#qs', timeout=60000)
    await pg.check(f'input[name=plan][value={plan}]')
    if await pg.query_selector('input[name=charging]'): await pg.check(f'input[name=charging][value={charging}]')
    if await pg.query_selector('input[name=horizon]'): await pg.check(f'input[name=horizon][value={horizon}]')
    if ack: await pg.check('input[name=ack]'); await pg.click('#show', force=True); await pg.wait_for_selector('#h-res')

async def fill_bill(pg, plan, frm, to, kwh, usd=None, total=None, remainder=False, rest=None):
    await pg.click('.subnav [data-sub=bill]'); await pg.select_option('#bill select[name=plan]', plan)
    await pg.fill('input[name=from]', frm); await pg.fill('input[name=to]', to)
    if total is not None: await pg.fill('input[name=total]', str(total))
    for k, v in kwh.items(): await pg.fill(f'input[name=kwh_{k}]', str(v))
    for k, v in (usd or {}).items(): await pg.fill(f'input[name=usd_{k}]', str(v))
    if not remainder: await pg.uncheck('#bill input[name=remainder]') if not await pg.is_disabled('#bill input[name=remainder]') else None
    if rest:
        await pg.evaluate("document.querySelector('#bill details').open = true")
        for k, v in rest.items(): await pg.fill(f'input[name=b_{k}]', str(v))
    await pg.click('#bill button[type=submit]'); await pg.wait_for_timeout(150)
    return (await pg.inner_text('[data-out] .banner')) if await pg.query_selector('[data-out] .banner') else await pg.inner_text('[data-err]')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1366, 'height': 900})
        errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        async def safe(name, fn):
            try: await asyncio.wait_for(fn(), 60)
            except Exception as e: check(f'{name} (test could not complete: {type(e).__name__})', False, str(e)[:120])
        unv = json.load(open(os.path.join(DATA, 'unv-bill.json')))

        # CR-05: a new file must not inherit the previous file's assumptions (no page reload in between)
        async def t05():
            await pg.goto(PAGE); await pg.click('#demo'); await pg.wait_for_selector('#qs', timeout=30000)
            await pg.check('input[name=plan][value=tou]')
            if await pg.query_selector('input[name=charging]'): await pg.check('input[name=charging][value=yes]')
            await pg.check('input[name=ack]'); await pg.click('#show', force=True); await pg.wait_for_selector('#h-res')
            await pg.click('.subnav [data-sub=sure]'); await pg.fill('#adj input[name=change]', '2026-03-01'); await pg.press('#adj input[name=change]', 'Tab'); await pg.wait_for_timeout(300)
            await pg.click('.subnav [data-sub=sure]'); before = await pg.inner_text('#panel')
            await pg.click('.banner a[data-nav=file]'); await pg.wait_for_selector('#file', state='attached')
            await pg.set_input_files('#file', os.path.join(DATA, 'few-sessions.xml')); await pg.wait_for_selector('#qs', timeout=30000)
            await pg.check('input[name=plan][value=tou]')
            if await pg.query_selector('input[name=horizon]'): await pg.check('input[name=horizon][value=all]')
            await pg.check('input[name=ack]'); await pg.click('#show', force=True); await pg.wait_for_selector('#h-res')
            await pg.click('.subnav [data-sub=sure]'); after = await pg.inner_text('#panel')
            check('CR-05 second file does not inherit the first file\'s change date', 'March 1, 2026' in before and 'March 1, 2026' not in after)
        await safe('CR-05', t05)

        # CR-07: unticking "treat as car charging" works even when the question wasn't asked (<30 sessions)
        async def t07():
          await pg.uncheck('#adj input[name=charging]'); await pg.wait_for_timeout(300)
          await pg.click('.subnav [data-sub=sure]'); txt = await pg.inner_text('#panel')
          check('CR-07 unticking charging takes effect with fewer than 30 sessions', 'treated as ordinary household use' in txt, txt[:200])
        await safe('CR-07', t07)

        # CR-06: opening a second file while the first is still loading shows only the second
        async def t06():
          if REAL:
            await pg.goto(PAGE); await pg.check('input[name=who][value=utility]'); await pg.click('#go-who')
            await pg.set_input_files('#file', REAL); await pg.wait_for_timeout(100)
            await pg.set_input_files('#file', os.path.join(DATA, 'few-sessions.xml')); await pg.wait_for_selector('#qs', timeout=60000); await pg.wait_for_timeout(3000)
            q = await pg.inner_text('#h-q'); car = bool(await pg.query_selector('input[name=charging]'))
            check('CR-06 the newer file wins when two are opened quickly (no car question, which only the first file has)', not car, q)
            await pg.goto(PAGE); await pg.check('input[name=who][value=utility]'); await pg.click('#go-who')
            await pg.set_input_files('#file', REAL); await pg.wait_for_timeout(100)
            await pg.click('header [data-nav=home]'); await pg.wait_for_timeout(3500)
            check('CR-06 leaving the file screen while a file loads stops it', await pg.query_selector('#h-start') is not None and await pg.query_selector('#qs') is None)
        await safe('CR-06', t06)

        async def trest():
          # CR-04: bill check statuses
          await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
          msg = await fill_bill(pg, 'tou', '2026-04-10', '2026-05-12', unv['kwh'])
          check('CR-04 a matching bill on an unverified file says what was checked', 'matches your file' in msg and '3 lines matched' in msg, msg)
          banner = await pg.inner_text('#support-banner')
          check('CR-04 ...and marks the file as matching that bill only', 'Your bill matches your file' in banner and 'doesn’t check the estimate' in banner, banner)
          msg = await fill_bill(pg, 'tou', '2026-04-10', '2026-05-12', {**unv['kwh'], 'on': float(unv['kwh']['on']) + 5})
          banner = await pg.inner_text('#support-banner')
          check('CR-04 a later failed check removes the "matches" notice', 'Some lines don’t match' in msg and 'first time we’ve seen' in banner, banner[:120])
          msg = await fill_bill(pg, 'tou', '2026-04-10', '2026-05-12', unv['kwh'], total=float(unv['total']) + 25)
          check('CR-04 total usage is compared on its own', 'Some lines don’t match' in msg, msg)
          msg = await fill_bill(pg, 'tou', '2026-09-15', '2026-10-20', unv['kwh'])
          check('CR-04 a bill the file only partly covers cannot "match"', 'can’t be checked' in msg, msg)
          msg = await fill_bill(pg, 'tiered', '2026-04-10', '2026-05-12', {'total': unv['total']}, rest={'delivery': 50, 'regulatory': 6, 'hst': 20, 'oer': 30, 'total': 150})
          whole = await pg.inner_text('[data-out]')
          check('CR-04 Tiered: whole-bill figures are not checked, and the file is not marked as matching', 'isn’t available for Tiered bills' in whole and 'Your bill matches' not in await pg.inner_text('#support-banner'), whole[-200:])
          msg = await fill_bill(pg, 'tou', '2026-04-10', '2026-05-12', {**unv['kwh'], 'on': 'abc'})
          check('CR-04 a non-number is rejected with a clear message', 'isn’t a number' in msg, msg)

          # CR-16: changing the cross-check month keeps the bill figures
          await pg.fill('input[name=kwh_on]', '118.049'); await pg.fill('input[name=from]', '2026-04-10')
          opts = await pg.eval_on_selector('select[name=xmonth]', 'e => [...e.options].map(o => o.value)')
          await pg.select_option('select[name=xmonth]', opts[0]); await pg.wait_for_timeout(100)
          kept = [await pg.input_value('input[name=kwh_on]'), await pg.input_value('input[name=from]')]
          check('CR-16 changing the cross-check month keeps entered bill figures', kept == ['118.049', '2026-04-10'], str(kept))
          check('CR-16 ...and focus stays on the month list', await pg.evaluate("document.activeElement.name") == 'xmonth')

          # CR-16: focus stays on an assumption after editing it
          await pg.click('.subnav [data-sub=sure]'); await pg.fill('#adj input[name=perweek]', '40'); await pg.press('#adj input[name=perweek]', 'Tab'); await pg.wait_for_timeout(300)
          await pg.focus('#adj input[name=perweek]'); await pg.fill('#adj input[name=perweek]', '45'); await pg.dispatch_event('#adj input[name=perweek]', 'change'); await pg.wait_for_timeout(300)
          check('CR-16 focus returns to the assumption you were editing', await pg.evaluate("document.activeElement.name") == 'perweek')

          # CR-01..03: rejected files show a plain reason in the page
          for f, words in [('val-conflicting-duplicate.xml', 'same time twice'), ('val-generation.xml', 'net metering'), ('val-two-meters.xml', 'more than one meter'), ('val-bad-value.xml', 'missing or unusable')]:
              await pg.goto(PAGE); await pg.check('input[name=who][value=utility]'); await pg.click('#go-who')
              await pg.set_input_files('#file', os.path.join(DATA, f)); await pg.wait_for_selector('#file-error .banner', timeout=30000)
              t = await pg.inner_text('#file-error')
              check(f'CR-01..03 {f}: plain reason shown, no result', words in t and 'NaN' not in t, t[:140])

        await safe('CR-04/16/01', trest)
        # Milestone 2
        async def tm2():
            await open_file(pg, os.path.join(DATA, 'old-file.xml'))
            old = await pg.inner_text('#main')
            check('CR-12 an old file is flagged, and the estimate starts from now, not 2024', 'Your file ends on September 30, 2024' in old and '2024' not in (await pg.inner_text('#h-res')), (await pg.inner_text('#h-res')))
            await pg.click('.subnav [data-sub=bill]')
            check('CR-13 no rate zone is chosen for you', await pg.input_value('#bill select[name=utility]') == '')
            await pg.click('footer [data-nav=how]'); await pg.wait_for_selector('#h-how2')
            pre = (await pg.text_content('details pre')) if await pg.query_selector('details pre') else ''
            check('CR-15 the public report preview has no text copied from the file', pre and 'Energy' not in pre and 'Usage point' not in pre and 'Issue codes' in pre, pre[:200])
            await open_file(pg, os.path.join(DATA, 'old-file.xml'))
            sure = await pg.inner_text('.sure')
            check('CR-09 no car charging: confidence says it was not tested', 'Not tested against changes in your usage' in sure and 'No car charging is included' in sure, sure)
            await pg.click('.subnav [data-sub=past]'); rows = await pg.eval_on_selector_all('#panel table:first-of-type tbody tr', 'rs => rs.map(r => [r.className, r.innerText.split("\t")[0]])')
            check('CR-08 months are marked partial only when the file doesn’t cover all their time', all(c == '' for c, t in rows if t) and len([t for _, t in rows if t]) == 12, str(rows[:3]))
        await safe('Milestone 2', tm2)

        # Gemini review: bill form kept across tabs; no jump while editing assumptions
        async def tg():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            await pg.click('.subnav [data-sub=bill]')
            await pg.fill('input[name=from]', '2026-04-10'); await pg.fill('input[name=kwh_on]', '118.049')
            await pg.evaluate("document.querySelector('#bill details').open = true"); await pg.select_option('#bill select[name=utility]', 'alectra-powerstream'); await pg.fill('input[name=b_delivery]', '50.00')
            await pg.click('.subnav [data-sub=past]'); await pg.click('.subnav [data-sub=bill]')
            kept = [await pg.input_value('input[name=from]'), await pg.input_value('input[name=kwh_on]'), await pg.input_value('#bill select[name=utility]'), await pg.input_value('input[name=b_delivery]')]
            check('Bill figures are kept when switching between the "See why" tabs', kept == ['2026-04-10', '118.049', 'alectra-powerstream', '50.00'], str(kept))
            await pg.click('.subnav [data-sub=sure]')
            await pg.locator('#adj input[name=perweek]').scroll_into_view_if_needed(); await pg.evaluate('window.scrollBy(0, 120)')
            y0 = await pg.evaluate('window.scrollY')
            await pg.fill('#adj input[name=perweek]', '50'); await pg.dispatch_event('#adj input[name=perweek]', 'change'); await pg.wait_for_timeout(300)
            y1 = await pg.evaluate('window.scrollY')
            check('Editing an assumption doesn’t move the page', abs(y1 - y0) < 5 and await pg.evaluate('document.activeElement.name') == 'perweek', f'scroll {y0} -> {y1}')
        await safe('Gemini review', tg)
        async def tw():
            await pg.goto(PAGE); await pg.check('input[name=who][value=utility]'); await pg.click('#go-who')
            await pg.set_input_files('#file', os.path.join(DATA, 'few-sessions.xml')); await pg.wait_for_selector('#qs', timeout=30000)
            how = await pg.evaluate('document.documentElement.dataset.reader')
            check('The file is read by the background thread, not the fallback', how == 'worker', str(how))
        await safe('Worker', tw)
        # Code review, Milestone 3 (each block independent, so every test reports even on older versions)
        async def m3_edit():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            await fill_bill(pg, 'tou', '2026-04-10', '2026-05-12', unv['kwh'])
            ok1 = 'matches your file' in (await pg.inner_text('#support-banner'))
            await pg.fill('input[name=kwh_on]', '100'); await pg.wait_for_timeout(150)
            check('M3 editing a figure after a match clears the "matches" notice at once', ok1 and 'matches your file' not in (await pg.inner_text('#support-banner')) and 'changed the figures' in (await pg.inner_text('[data-out]')))
        async def m3_error():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            await fill_bill(pg, 'tou', '2026-04-10', '2026-05-12', unv['kwh'])
            await pg.fill('input[name=kwh_on]', 'abc'); await pg.click('#bill button[type=submit]'); await pg.wait_for_timeout(150)
            check('M3 a check that stops on an error leaves no "matches" notice', 'matches your file' not in (await pg.inner_text('#support-banner')) and 'isn’t a number' in (await pg.inner_text('[data-err]')))
            check('M3 the invalid bill field is marked and linked to its message', await pg.get_attribute('input[name=kwh_on]', 'aria-invalid') == 'true' and await pg.get_attribute('input[name=kwh_on]', 'aria-describedby') == 'bill-err')
        async def m3_cards():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            cards = await pg.inner_text('.plans')
            check('M3 plan cards show the cost after tax and rebate, and the electricity charges', 'after tax and rebate' in cards and 'Electricity charges' in cards)
        async def m3_perweek():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            await pg.click('.subnav [data-sub=sure]')
            await pg.fill('#adj input[name=perweek]', '-5'); await pg.dispatch_event('#adj input[name=perweek]', 'change'); await pg.wait_for_timeout(300)
            kept = await pg.input_value('#adj input[name=perweek]') if await pg.query_selector('#adj input[name=perweek]') else None
            err = await pg.inner_text('#perweek-err') if await pg.query_selector('#perweek-err') else ''
            check('M3 a negative charging value gets a field error and is kept, without recalculating', kept == '-5' and '0 to 2,000' in err, f'kept {kept!r}, message {err!r}')
        async def m3_partial():
            if not REAL: return
            await open_file(pg, REAL, plan='ulo')
            await pg.click('.subnav [data-sub=past]')
            marker = await pg.evaluate("(() => { const r = document.querySelector('#panel tr.partial th[scope=row]'); return r ? getComputedStyle(r, '::after').content : null; })()")
            check('M3 partial months show the "(partial)" marker on their row heading', bool(marker) and 'partial' in marker, str(marker))
        async def m3_report():
            await pg.goto(PAGE); await pg.click('footer [data-nav=about]'); await pg.wait_for_selector('#h-report')
            pre = await pg.text_content('section[aria-labelledby=h-report] details pre') if await pg.query_selector('section[aria-labelledby=h-report] details pre') else ''
            check('M3 the general problem report has a preview with check codes only', 'Check codes' in pre)
        async def m3_zero():
            await open_file(pg, os.path.join(DATA, 'early-2023-zero.xml'))
            svg = await pg.inner_html('#panel figure') if await pg.query_selector('#panel figure') else ''
            check('M3 a file with no usage still draws its chart (no NaN)', bool(svg) and 'NaN' not in svg)
        async def m3_preulo():
            await open_file(pg, os.path.join(DATA, 'early-2023-zero.xml'))
            msg = await fill_bill(pg, 'ulo', '2023-02-01', '2023-03-01', {'on': 0, 'mid': 0, 'off': 0, 'overnight': 0})
            check('M3 a ULO bill from before May 2023 gets a plain message, not a crash', 'wasn’t available' in msg, msg)
        async def a11y_pass2():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            await pg.focus('.subnav [aria-selected=true]'); await pg.keyboard.press('Tab')
            check('A11y: Tab from the selected tab moves into its panel', await pg.evaluate('document.activeElement.id') == 'panel')
            await pg.click('.subnav [data-sub=past]')
            check('A11y: the heatmap numbers are also available as a table', await pg.query_selector('#panel details table caption') is not None)
            await pg.click('.subnav [data-sub=bill]'); await pg.click('#bill button[type=submit]'); await pg.wait_for_timeout(100)
            check('A11y: a missing bill date is marked on the field and linked to its message', await pg.get_attribute('input[name=from]', 'aria-invalid') == 'true' and await pg.get_attribute('input[name=from]', 'aria-describedby') == 'bill-err')
        await safe('Accessibility pass 2', a11y_pass2)

        # UI/UX batch (GPT-6 review)
        async def ux_nav():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'))
            check('UX the step indicator marks "Compare plans" as the current step', 'Compare plans' in (await pg.inner_text('.stepnav [aria-current=step]')))
            await pg.click('header [data-nav=home]'); await pg.wait_for_selector('#h-start')
            kept = 'You have a file open' in (await pg.inner_text('#main'))
            await pg.click('#main .banner a[data-nav=result]'); await pg.wait_for_selector('#h-res')
            check('UX the logo goes to the start screen without clearing your file, and you can continue', kept)
            await pg.go_back(); await pg.wait_for_selector('#h-start'); await pg.go_back(); await pg.wait_for_selector('#h-res')
            await pg.go_back(); await pg.wait_for_selector('#h-q')
            check('UX browser Back steps back through the screens (result to questions)', True)
            await pg.go_forward(); await pg.wait_for_selector('#h-res')
            pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.click('#main a[data-nav=clear]'); await pg.wait_for_selector('#h-start')
            check('UX "Clear my data and start over" clears the file', 'You have a file open' not in (await pg.inner_text('#main')))
        async def ux_answers():
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'), plan='unsure', charging='unsure')
            t = await pg.inner_text('#main')
            check('UX "I’m not sure" about car charging shows the other answer too', 'You weren’t sure' in t and 'aren’t car charging' in t, t[:200])
            check('UX the saving says what it is compared with (no current plan given)', 'compared with the next-cheapest option' in (await pg.inner_text('.saving')).lower())
            check('UX "Why?" explains the recommendation with the household’s own figures', '%' in (await pg.inner_text('.why')))
            await open_file(pg, os.path.join(DATA, 'unverified-year.xml'), plan='tou')
            check('UX with a current plan, the saving is compared with staying on it', 'compared with staying on time-of-use' in (await pg.inner_text('.saving')).lower())
        async def ux_close():
            await open_file(pg, os.path.join(DATA, 'close-plans.xml'), plan='unsure')
            t = await pg.inner_text('.saving')
            check('UX a small difference is called "close", not a confident saving', 'These options are close' in t and 'Convenience may matter more' in t, t)
        async def ux_file():
            await pg.goto(PAGE); await pg.check('input[name=who][value=utility]'); await pg.click('#go-who')
            async with pg.expect_file_chooser() as fc: await pg.click('#choose')
            await (await fc.value).set_files(os.path.join(DATA, 'large-file.xml'))   # large enough to still be loading
            await pg.wait_for_selector('#cancel-load', state='visible', timeout=5000)
            await pg.click('#cancel-load', timeout=5000); await pg.wait_for_timeout(2500)
            check('UX "Choose XML file" opens the file chooser, and Cancel stops the loading', await pg.query_selector('#qs') is None and 'Stopped' in (await pg.inner_text('#file-error')))
        async def ux_narrow():
            worst = []
            for w in (390, 768, 320):
                await pg.set_viewport_size({'width': w, 'height': 800})
                await pg.goto(PAGE)
                for step in ('start', 'file', 'questions', 'result'):
                    if step == 'file': await pg.check('input[name=who][value=utility]'); await pg.click('#go-who'); await pg.wait_for_selector('#h-file')
                    if step == 'questions': await pg.set_input_files('#file', os.path.join(DATA, 'unverified-year.xml')); await pg.wait_for_selector('#qs', timeout=30000)
                    if step == 'result':
                        await pg.check('input[name=plan][value=tou]'); await pg.check('input[name=charging][value=yes]'); await pg.check('input[name=ack]'); await pg.click('#show', force=True); await pg.wait_for_selector('#h-res')
                    over = await pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
                    if over > 1: worst.append(f'{w}px {step}: {over}px too wide')
            await pg.set_viewport_size({'width': 1366, 'height': 900})
            check('UX no sideways scrolling at phone (390 px), tablet (768 px) or 400% zoom (320 px) widths', not worst, '; '.join(worst))
        async def stale_prices():
            ctx = await b.new_context(viewport={'width': 1366, 'height': 900}); p2 = await ctx.new_page()
            await p2.clock.install(time=datetime.datetime(2027, 11, 20, 12, 0))   # a year after the latest prices, update missed
            await p2.goto(PAGE); await p2.click('#demo'); await p2.wait_for_selector('#qs', timeout=30000)
            await p2.check('input[name=plan][value=tou]')
            if await p2.query_selector('input[name=charging]'): await p2.check('input[name=charging][value=yes]')
            await p2.check('input[name=ack]'); await p2.click('#show', force=True); await p2.wait_for_selector('#h-res')
            late = 'prices may be out of date' in (await p2.inner_text('#main'))
            await ctx.close()
            now = await pg.goto(PAGE) or True; await pg.click('#demo'); await pg.wait_for_selector('#qs', timeout=30000)
            await pg.check('input[name=plan][value=tou]')
            if await pg.query_selector('input[name=charging]'): await pg.check('input[name=charging][value=yes]')
            await pg.check('input[name=ack]'); await pg.click('#show', force=True); await pg.wait_for_selector('#h-res')
            fresh = 'prices may be out of date' not in (await pg.inner_text('#main'))
            check('Prices: a visible notice appears when a November update was missed, and not before', late and fresh, f'late {late}, fresh {fresh}')
        await safe('Price freshness', stale_prices)
        async def privacy():
            await pg.goto(PAGE)
            blocked = await pg.evaluate('''() => new Promise(resolve => {
              document.addEventListener('securitypolicyviolation', e => resolve(e.effectiveDirective), { once: true });
              fetch('https://example.com/upload', { method: 'POST', body: 'test' }).catch(() => {});
              setTimeout(() => resolve('not blocked'), 3000);
            })''')
            check('Privacy: the browser blocks the page from sending data (connect-src)', blocked == 'connect-src', blocked)
            link = await pg.evaluate("(() => { const a = [...document.querySelectorAll('footer a')].find(x => x.textContent.includes('Open source')); return a && [a.getAttribute('href'), a.target, a.rel]; })()")
            check('Privacy: the GitHub link opens in a new tab and carries nothing extra', link == ['https://github.com/electricity-plans/ontario-hydro-plan-compare', '_blank', 'noopener noreferrer'], str(link))
            await pg.click('header a.lock'); await pg.wait_for_selector('#h-privacy')
            offline = await pg.evaluate("(() => [...document.querySelectorAll('#main a')].filter(a => /github\\.com\\/electricity-plans\\/ontario-hydro-plan-compare(\\/releases\\/latest)?$/.test(a.href)).map(a => [a.textContent.trim(), a.target, a.rel]))()")
            check('Privacy: the privacy section links to the code and to the offline download, in new tabs', any(t == 'GitHub' for t, _, _ in offline) and any(t.startswith('Download') for t, _, _ in offline) and all(tg == '_blank' and r == 'noopener noreferrer' for _, tg, r in offline), str(offline))
            check('Privacy: "Your file stays on this computer – How?" opens the privacy explanation', await pg.evaluate("document.activeElement.id") == 'h-privacy' and 'connect-src' in (await pg.inner_text('#main')))
        await safe('Privacy', privacy)
        for name, fn in [('UX navigation', ux_nav), ('UX answers', ux_answers), ('UX close result', ux_close), ('UX file screen', ux_file), ('UX narrow screens', ux_narrow)]:
            await safe(name, fn)
        for name, fn in [('M3 edit', m3_edit), ('M3 error', m3_error), ('M3 cards', m3_cards), ('M3 charging value', m3_perweek), ('M3 partial', m3_partial), ('M3 report', m3_report), ('M3 zero usage', m3_zero), ('M3 pre-ULO', m3_preulo)]:
            await safe(name, fn)
        check('No page errors during the run', not errors, '; '.join(errors))
        await b.close()
    failed = [r for r in results if not r[0]]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed'); sys.exit(1 if failed else 0)
asyncio.run(main())
