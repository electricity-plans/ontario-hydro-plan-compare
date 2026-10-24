// Page logic. Plain JavaScript, no framework. All calculation is done by the engine (window.Engine);
// this file only decides what to show, where, and in what words.
(function () {
  'use strict';
  const E = window.Engine;
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kwh = (x, d = 1) => (x === null || x === undefined || isNaN(x) ? '–' : x.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const money = x => (x === null || x === undefined || isNaN(x) ? '–' : x.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' }));
  const money0 = x => (x === null || x === undefined || isNaN(x) ? '–' : Math.round(x).toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }));
  const num = v => { const s = String(v || '').replace(/[,$\s]/g, ''); return s === '' ? undefined : Number(s); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = k => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
  const mLong = k => MONTHS_LONG[+k.slice(5, 7) - 1];
  const longDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const plainDates = t => t.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, d) => longDate(d));
  const clock = (h, m) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  const PLAN_NAMES = { tou: 'Time-of-Use', ulo: 'Ultra-Low Overnight', tiered: 'Tiered' };
  const PLAN_DESC = {
    tou: 'Price depends on the time of day. Cheapest evenings, nights and weekends.',
    ulo: 'Very cheap 11 p.m. to 7 a.m., very expensive weekdays 4 to 9 p.m.',
    tiered: 'One price for your first block of electricity each month, a higher price after that.',
  };
  const PLAN_CUE = { tou: 'Three prices: off-, mid- and on-peak', ulo: 'A very low price from 11 p.m. to 7 a.m.', tiered: 'Two prices, based on how much you use', unsure: 'You can still compare plans' };
  const PERIOD_NAMES = { on: 'On-peak', mid: 'Mid-peak', off: 'Off-peak', overnight: 'Overnight', total: 'Total' };
  const PERIOD_VAR = { on: '--p-on', mid: '--p-mid', off: '--p-off', overnight: '--p-overnight' };
  const PLANS = ['tou', 'ulo', 'tiered'];
  const REPO = 'https://github.com/electricity-plans/ontario-hydro-plan-compare';
  const OEB_CHOICE = 'https://www.oeb.ca/consumer-information-and-protection/electricity-rates/choosing-your-electricity-price-plan';

  // Where each utility keeps its Green Button download. Sources: each utility's Green Button page (linked).
  const GUIDES = [
    { id: 'alectra', name: 'Alectra Utilities', steps: ['Log in to My Alectra.', 'Open the Usage Data section.', 'Click “Green Button Download My Data”.', 'Choose the longest date range (12 months or more) and the XML format, then download.'], note: 'Guelph area customers: use MyEnergy View instead, or its guest access.', page: 'https://alectrautilities.com/green-button', switchUrl: 'https://alectrautilities.com/CustomerChoice', hosts: ['alectradc.savagedata.com'] },
    { id: 'hydroone', name: 'Hydro One', steps: ['Log in to myAccount at HydroOne.com/myAccount.', 'Click the Green Button icon under “Account Strength”.', 'Choose the longest date range (up to 24 months) and download the XML file.'], page: 'https://www.hydroone.com/saving-money-and-energy/green-button', switchUrl: 'https://www.hydroone.com/RateRelief', hosts: [] },
    { id: 'torontohydro', name: 'Toronto Hydro', steps: ['Log in to your Toronto Hydro online account (self-serve portal).', 'Find Green Button or “Download My Data”.', 'Choose the longest date range (12 months or more) and the XML format, then download.'], note: 'Toronto Hydro doesn’t publish the exact menu names, so look for the Green Button logo.', page: 'https://www.torontohydro.com/for-home/green-button', switchUrl: 'https://www.torontohydro.com/for-home/customer-choice', hosts: [] },
    { id: 'hydroottawa', name: 'Hydro Ottawa', steps: ['Open Hydro Ottawa’s Green Button portal (or log in to MyAccount).', 'Sign in with MyAccount, or enter the details from your latest bill. No online account needed.', 'Choose the longest date range (up to 24 months) and download the XML file.'], page: 'https://hydroottawa.com/en/accounts-services/services/green-button', switchUrl: OEB_CHOICE, hosts: [] },
    { id: 'elexicon', name: 'Elexicon Energy', steps: ['Log in to my.elexicon.', 'Open Green Button and select the “Download My Data” tab.', 'Choose your data and date range (12 months or more), then click Download.'], page: 'https://elexiconenergy.com/?p=5952', switchUrl: OEB_CHOICE, hosts: [] },
    { id: 'other', name: 'Another utility', steps: ['Log in to your utility’s online account.', 'Look for the Green Button logo, or “Download My Data”. Every Ontario utility has to offer it.', 'Choose the longest date range (12 months or more) and the XML format, then download.'], note: 'Can’t find it? Call your utility and ask for your “Green Button” usage file.', page: null, switchUrl: OEB_CHOICE, hosts: [] },
  ];
  const guide = () => GUIDES.find(g => g.id === state.utility) || null;
  const guideOrOther = () => guide() || GUIDES[GUIDES.length - 1];

  // Everything that depends on the current file. Replaced together whenever a new file starts loading.
  const fileState = () => ({ result: null, det: null, sug: null, f: null, plan: undefined, charging: undefined, horizon: undefined, ack: false, custom: undefined, changeOverride: undefined, verifiedByBill: false, xmonth: null, sub: 'past', basis: 'now', billDraft: null });
  const fresh = () => ({ view: 'start', back: null, who: undefined, utility: null, demo: false, fileName: '', error: null, ...fileState() });
  let state = fresh();

  // ---------- Navigation ----------
  function go(view, extra = {}, fromHistory = false) {
    Object.assign(state, extra, { view });
    if (!fromHistory) try { history.pushState({ view }, ''); } catch { /* history not available (e.g. some embedded viewers) */ }
    render();
    window.scrollTo(0, 0);
    const h = app.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  document.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]');
    if (!n) return;
    e.preventDefault();
    const v = n.dataset.nav;
    if (job.worker || job.busy) { if (v !== 'file') { cancelJob(); } }   // leaving the file screen while a file loads stops the loading
    if (v === 'clear') { if (!state.result || confirm('Clear your file and answers from this page and start over?')) { cancelJob(); state = fresh(); go('start'); } return; }
    go(v === 'home' ? 'start' : v, { back: isAside(state.view) ? state.back : state.view });
  });
  // Browser Back and Forward move between the app's screens. Only the screen name is stored, never your data.
  const needsFile = v => v === 'questions' || v === 'result';
  window.addEventListener('popstate', e => {
    let v = e.state?.view || 'start';
    if (needsFile(v) && !state.result) v = state.result ? v : (state.view === 'file' ? 'file' : 'start');
    go(v, {}, true);
  });
  try { history.replaceState({ view: 'start' }, ''); } catch { /* ignore */ }
  function render() {
    const v = state.view;
    document.body.dataset.view = v;
    document.title = { start: 'Which hydro plan is cheapest for my home?', notfor: 'This tool can’t help with your bill', file: 'Get your usage file', questions: 'A few quick questions', result: 'Your estimated best plan', how: 'Technical checks', about: 'How the estimate works', disclaimer: 'Disclaimer' }[v] + ' – Ontario Hydro Plan Compare';
    app.innerHTML = ({ start: viewStart, notfor: viewNotFor, file: viewFile, questions: viewQuestions, result: viewResult, how: viewHow, about: () => viewHow('about'), disclaimer: viewDisclaimer }[v] || viewStart)();
    ({ start: wireStart, notfor: () => {}, file: wireFile, questions: wireQuestions, result: wireResult, how: wireHow, about: wireHow, disclaimer: () => {} }[v] || (() => {}))();
  }
  const isAside = v => v === 'how' || v === 'about' || v === 'disclaimer';
  const backButton = () => `<button type="button" class="btn secondary" data-nav="${esc(state.back || (state.result ? 'result' : 'start'))}">Back</button>`;

  // Progress through the three working steps. Completed steps can be revisited without losing anything.
  function stepsNav(current) {
    const steps = [['file', 'Get your file'], ['questions', 'Answer questions'], ['result', 'Compare plans']];
    const at = steps.findIndex(([k]) => k === current);
    return `<nav aria-label="Progress" class="stepnav"><ol>${steps.map(([k, label], i) => {
      const reachable = i < at || (k !== 'file' && state.result && (k === 'questions' || state.ack));
      const inner = `<span class="stepnum">${i + 1}</span>${label}`;
      return `<li class="${i === at ? 'now' : i < at ? 'done' : ''}"${i === at ? ' aria-current="step"' : ''}>${i !== at && reachable ? `<a href="#${k}" data-nav="${k}">${inner}</a>` : inner}</li>`; }).join('')}</ol></nav>`;
  }

  // ---------- 1. Start ----------
  function viewStart() {
    return `<div class="grid-2">
      <section class="hero" aria-labelledby="h-start">
        <h1 id="h-start">Find the electricity plan that fits your home</h1>
        <p class="lead">Compare Time-of-Use, Ultra-Low Overnight and Tiered using your own meter readings. Your file stays on this computer.</p>
        ${state.result ? `<div class="banner info"><p><b>You have a file open.</b> <a href="#result" data-nav="${state.ack ? 'result' : 'questions'}">Continue where you left off</a>, or <a href="#clear" data-nav="clear">clear my data and start over</a>.</p></div>` : ''}
        <form id="who" class="card">
          <fieldset><legend>Who sends your electricity bill?</legend>
            <div class="choices">
              <label class="choice"><input type="radio" name="who" value="utility" ${state.who === 'utility' ? 'checked' : ''}><div><b>My local utility</b><span>For example Hydro One, Toronto Hydro, Alectra, Hydro Ottawa or Elexicon</span></div></label>
              <label class="choice"><input type="radio" name="who" value="submeter" ${state.who === 'submeter' ? 'checked' : ''}><div><b>My condo or building’s meter company</b><span>A sub-metering company, not a utility</span></div></label>
              <label class="choice"><input type="radio" name="who" value="retailer" ${state.who === 'retailer' ? 'checked' : ''}><div><b>An energy retailer, under a contract</b><span>You signed a contract for your electricity price</span></div></label>
              <label class="choice"><input type="radio" name="who" value="solar" ${state.who === 'solar' ? 'checked' : ''}><div><b>My utility, but I have solar panels that send power back</b><span>Net metering</span></div></label>
            </div>
          </fieldset>
          <div class="actions" style="margin-top:0"><button class="btn primary" type="submit" id="go-who" disabled>Continue</button>
            <button class="btn secondary" type="button" id="demo">See a sample result</button><span class="small muted">No file needed.</span></div>
        </form>
        <p class="disclaim-line">Estimates only, based on your past usage and the Ontario Energy Board’s latest prices. Not affiliated with the OEB or any utility. Check with your utility before switching. <a class="linkbtn" href="#disclaimer" data-nav="disclaimer">Read the full disclaimer</a></p>
      </section>
      <section aria-labelledby="h-how" class="card flat">
        <h2 id="h-how" style="font-size:var(--t-xl);margin-bottom:var(--s-5)">How it works</h2>
        <ol class="how">
          <li><h3>Download your usage file</h3><p class="muted">Your utility keeps a record of your smart-meter readings. You can download it as a “Green Button” file. We show you where.</p></li>
          <li><h3>Open it here</h3><p class="muted">The file is read on this computer. It is never uploaded or sent anywhere.</p></li>
          <li><h3>See your best plan</h3><p class="muted">We price every hour of your past year under each plan, then estimate the next 12 months at today’s prices.</p></li>
        </ol>
      </section>
    </div>`;
  }
  function wireStart() {
    const f = $('#who'), btn = $('#go-who');
    f.addEventListener('change', () => { state.who = f.who.value; btn.disabled = !f.who.value; });
    btn.disabled = !f.who.value;
    f.addEventListener('submit', e => { e.preventDefault(); if (f.who.value === 'utility') go('file'); else go('notfor'); });
    $('#demo').addEventListener('click', () => { state.utility = 'other'; loadDemo(); });
  }
  function viewNotFor() {
    const why = {
      submeter: 'If a sub-metering company runs your meter, you can’t switch price plans. Your price is set by your agreement with that company.',
      retailer: 'If you buy electricity from a retailer under a contract, you pay the price in your contract, not one of the Ontario Energy Board’s price plans.',
      solar: 'With solar panels that send power back to the grid (net metering), your bill works differently, and this tool can’t estimate it correctly yet.',
    }[state.who] || '';
    return `<section class="card" aria-labelledby="h-not" style="max-width:760px"><h1 id="h-not" style="font-size:var(--t-2xl);margin-bottom:var(--s-4)">This tool can’t help with your bill</h1>
      <p>${esc(why)}</p><p>The Ontario Energy Board explains your options on its <a href="${OEB_CHOICE}" target="_blank" rel="noopener">choosing your electricity price plan</a> page.</p>
      <div class="actions"><button class="btn secondary" type="button" data-nav="start">Back</button><button class="btn secondary" type="button" id="demo2">See a sample result instead</button></div></section>`;
  }
  document.addEventListener('click', e => { if (e.target.id === 'demo2') { state.utility = 'other'; loadDemo(); } });

  // ---------- 2. Get your file, and open it ----------
  function viewFile() {
    const g = guide();
    const stepsBlock = g ? `<h2 style="font-size:var(--t-xl);margin-bottom:var(--s-2)">Where to find it at ${esc(g.id === 'other' ? 'your utility' : g.name)}</h2>
        <ol class="steps-list">${g.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        ${g.note ? `<p class="small muted">${esc(g.note)}</p>` : ''}
        ${g.page ? `<p class="small"><a href="${g.page}" target="_blank" rel="noopener">${esc(g.name)}’s Green Button page</a> (opens in a new tab). Download the file there, then come back to this tab and choose it below.</p>` : '<p class="small muted">Download the file in another tab, then come back here and choose it below.</p>'}`
      : `<h2 style="font-size:var(--t-xl);margin-bottom:var(--s-2)">Where to find it</h2>
        <p class="muted">Choose your utility on the left to see where to find the file. If you already have it, open it below.</p>`;
    return `${stepsNav('file')}<h1 id="h-file" style="font-size:var(--t-2xl);margin-bottom:var(--s-2)">Get your usage file</h1>
      <p class="muted" style="margin-bottom:var(--s-5)">It takes about 5 minutes. Your utility calls it a “Green Button” file, and its name ends in .xml.</p>
      <div class="grid-side">
      <form class="card" aria-label="Your utility"><fieldset style="margin:0"><legend>Your utility</legend>
        <div class="choices utility-list">${GUIDES.map(u => `<label class="choice"><input type="radio" name="utility" value="${u.id}" ${u.id === state.utility ? 'checked' : ''}><div><b>${esc(u.name)}</b></div></label>`).join('')}</div>
      </fieldset></form>
      <section class="card" aria-labelledby="h-file">
        ${stepsBlock}
        <details class="filecheck"><summary>What file do I need?</summary><ul class="checklist">
          <li class="pass">A Green Button <b>XML</b> file, not a CSV file or a PDF bill.</li>
          <li class="pass"><b>12 months or more</b> is best. A shorter file works, but the estimate is less reliable.</li>
          <li class="pass"><b>One meter</b> (one address) at a time.</li></ul></details>
        <div id="drop" class="drop" style="margin-top:var(--s-4)">
          <h2 style="font-size:var(--t-xl);margin-bottom:var(--s-3)">Open your file here</h2>
          <input id="file" class="file-input" type="file" accept=".xml,application/xml,text/xml" aria-describedby="drop-help">
          <label for="file" id="choose" class="btn primary">Choose XML file</label>
          <p id="drop-help" class="small muted" style="margin-top:var(--s-3)">Or drag your file onto this box. Nothing is uploaded.</p>
        </div>
        <div id="progress" class="progress" hidden><div class="bar"><div id="fill"></div></div><div class="actions" style="margin-top:var(--s-2)"><p id="ptext" class="small muted" style="margin:0" aria-live="polite">Reading your file…</p><button type="button" class="btn secondary" id="cancel-load">Cancel</button></div></div>
        <div id="file-error" aria-live="assertive">${state.error ? errorBlock(state.error) : ''}</div>
        <div class="actions"><button class="btn secondary" type="button" data-nav="start">Back</button><span class="muted">or</span><button class="btn secondary" type="button" id="demo3">See a sample result</button></div>
      </section></div>`;
  }
  function errorBlock(err) {
    const csv = /\.csv$/i.test(state.fileName);
    const r0 = err.reasons[0] || '';
    const plain = /ServiceCategory/.test(r0) ? 'This file is for natural gas or another service, not electricity. Download the electricity usage file instead.'
      : /Atom feed|could not be read|Mismatched|Unclosed/.test(r0) ? 'This isn’t a Green Button usage file, or it’s damaged. Download the XML file from your utility’s Green Button page and try again.'
      : /No interval energy channel|no readings/i.test(r0) ? 'This file has no hourly or 15-minute readings in it. Download your usage data (not only your bills).' : r0;
    return `<div class="banner bad" style="margin-top:var(--s-4)"><div><p><b>This file can’t be used.</b> ${csv ? 'It looks like a CSV file. Go back to your utility’s Green Button page and download the XML version instead.' : esc(plain)}</p>
      <p class="small" style="margin-top:var(--s-2)">You can also <a class="linkbtn" href="#how" data-nav="how">report a compatibility issue</a>. Never include your bill or usage file.</p></div></div>`;
  }
  function wireFile() {
    document.querySelectorAll('input[name=utility]').forEach(r => r.addEventListener('change', () => { state.utility = r.value; render(); $('input[name=utility]:checked').focus(); }));
    const drop = $('#drop'), input = $('#file');
    // The visible button is the file field's own label, so the browser opens the chooser itself (mouse, Enter or Space).
    $('#cancel-load').addEventListener('click', () => { cancelJob(); $('#progress').hidden = true; $('#file-error').innerHTML = '<p class="small muted">Stopped. You can choose a file again.</p>'; });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => input.files[0] && load(input.files[0]));
    $('#demo3').addEventListener('click', loadDemo);
  }
  function setProgress(f, text) {
    const p = $('#progress'); if (!p) return; p.hidden = false; $('#fill').style.width = Math.round(f * 100) + '%';
    const t = $('#ptext'), words = text || (f < 0.97 ? 'Reading your file…' : 'Checking the readings…');
    if (t.textContent !== words) t.textContent = words;   // announce stage changes only, not every percent
  }

  // Only the most recent file being read may change the page. Older jobs are stopped and their results ignored.
  let job = { id: 0, worker: null, url: null };
  function cancelJob() {
    if (job.worker) job.worker.terminate();
    if (job.url) URL.revokeObjectURL(job.url);
    job = { id: job.id + 1, worker: null, url: null, busy: false };
  }
  function load(file, demo = false) {
    cancelJob();
    job.busy = true;
    const id = job.id, live = () => id === job.id;
    Object.assign(state, fileState(), { error: null, fileName: file.name, demo });
    if ($('#file-error')) $('#file-error').innerHTML = '';
    setProgress(0, demo ? 'Making the sample household…' : `Reading ${file.name}…`);
    if (file.size > 300 * 1024 * 1024) return fail('This file is larger than 300 MB. Download a shorter date range: 2 years is plenty.', live);
    const done = (result, how) => { if (!live()) return; finishJob(); document.documentElement.dataset.reader = how; onLoaded(result); };
    try { job.url = URL.createObjectURL(new Blob([$('#engine-src').textContent + '\n' + $('#worker-src').textContent], { type: 'text/javascript' })); job.worker = new Worker(job.url); } catch (e) { job.worker = null; }
    if (!job.worker) return mainThread(file, done, live);
    const w = job.worker;
    w.onmessage = ev => { if (!live()) return; const m = ev.data; if (m.type === 'progress') setProgress(m.value); else if (m.type === 'done') done(m.result, 'worker'); else if (m.type === 'error') { finishJob(); fail(m.message, live); } };
    w.onerror = ev => { ev.preventDefault(); if (!live()) return; finishJob(); mainThread(file, done, live); };
    w.postMessage({ file });
  }
  function finishJob() { if (job.worker) job.worker.terminate(); if (job.url) URL.revokeObjectURL(job.url); job.worker = null; job.url = null; job.busy = false; }
  async function mainThread(file, done, live) {
    setProgress(0.05, 'Reading your file. This page may pause for a few seconds…');
    await new Promise(r => setTimeout(r, 30));
    if (!live()) return;
    try { const text = await file.text(); if (!live()) return; const a = E.analyze(text); done({ report: a.report, support: a.support, history: a.history, register: a.register && { scale: a.register.scale, readings: a.register.readings }, profile: a.report.intervals ? E.hourlyProfile(a.report.intervals) : [] }, 'page'); }
    catch (e) { if (live()) fail(e.message, live); }
  }
  function fail(msg, live = () => true) { if (!live()) return; showError({ reasons: [msg] }); }
  function showError(err) {
    state.error = err; state.result = null;
    if (state.view !== 'file') { go('file'); return; }
    const p = $('#progress'); if (p) p.hidden = true;
    const box = $('#file-error'); if (box) box.innerHTML = errorBlock(err);
  }
  function loadDemo() {
    const xml = E.demoHouseholdFile();
    if (state.view !== 'file') go('file');
    load(new File([xml], 'Sample household.xml', { type: 'application/xml' }), true);
  }
  function onLoaded(result) {
    if (result.support.level === 'unsupported' || !result.report.intervals) { showError(result.support); return; }
    state.result = result;
    const iv = result.report.intervals;
    state.det = E.detectSessions(iv);
    state.sug = E.suggestChangeDate(iv);
    const g = GUIDES.find(u => u.hosts.includes(result.support.profile?.host || ''));
    if (g && !state.demo) state.utility = g.id;
    go('questions');
  }

  // ---------- 3. Questions the data can't answer ----------
  const showCharging = () => state.det && state.det.sessions.length >= 30;
  function viewQuestions() {
    const det = state.det, sug = state.sug;
    const sp = det && det.sessions.length ? (() => { const c = new Map(); for (const s of det.sessions) { const k = s.hour * 60 + s.minute; c.set(k, (c.get(k) || 0) + 1); } const [k] = [...c.entries()].sort((a, b) => b[1] - a[1])[0]; return clock(Math.floor(k / 60), k % 60); })() : '';
    const n = [true, showCharging(), !!sug].filter(Boolean).length;
    const cov = state.result.report.coverage, cons = state.result.report.consumption;
    const ready = `<div class="banner ok"><p><b>Your file is ready.</b> ${kwh(cov.months, 1)} months of readings every ${cons.intervalSeconds / 60} minutes, ${longDate(cov.firstLocal.slice(0, 10))} to ${longDate(lastCoveredDay())}.</p></div>`;
    return `${stepsNav('questions')}${state.demo ? '' : ready}<section class="card" aria-labelledby="h-q" style="max-width:860px">
      <h1 id="h-q" style="font-size:var(--t-2xl);margin-bottom:var(--s-2)">${n === 1 ? 'One quick question' : n === 2 ? 'Two quick questions' : 'Three quick questions'}</h1>
      <p class="muted" style="margin-bottom:var(--s-6)">Your file shows how much electricity you used and when. It can’t tell us these.</p>
      <form id="qs">
        <fieldset><legend>Which price plan are you on now?</legend><p class="hint">It’s on your bill, in the “Your Electricity Charges” section.</p>
          <div class="choices row">${[...PLANS, 'unsure'].map(p => `<label class="choice"><input type="radio" name="plan" value="${p}" ${state.plan === p ? 'checked' : ''}><div><b>${p === 'unsure' ? 'I don’t know' : PLAN_NAMES[p]}</b><span>${PLAN_CUE[p]}</span></div></label>`).join('')}</div></fieldset>
        ${showCharging() ? `<fieldset><legend>Are these high-power periods car charging?</legend><p class="hint">We found ${det.sessions.length} periods of sustained high electricity use, often starting around ${sp}. They could be car charging, or another large appliance.</p>
          <div class="choices row"><label class="choice"><input type="radio" name="charging" value="yes" ${state.charging === true ? 'checked' : ''}><div><b>Yes, car charging</b></div></label>
          <label class="choice"><input type="radio" name="charging" value="no" ${state.charging === false ? 'checked' : ''}><div><b>No, another use</b><span>Treat it like the rest of my use</span></div></label>
          <label class="choice"><input type="radio" name="charging" value="unsure" ${state.charging === 'unsure' ? 'checked' : ''}><div><b>I’m not sure</b><span>We’ll show both answers</span></div></label></div></fieldset>` : ''}
        ${sug ? `<fieldset><legend>Does this change reflect your usual routine now?</legend><p class="hint">Your ${state.charging === true ? 'car charging' : 'high-power use'} changed a lot around ${longDate(sug.date)}: from about ${Math.round(sug.before)} to ${Math.round(sug.after)} kWh a week. For example, a change in commute, a new car, or working from home.</p>
          <div class="choices row"><label class="choice"><input type="radio" name="horizon" value="recent" ${state.horizon === 'recent' ? 'checked' : ''}><div><b>Yes, use my recent routine</b><span>Plan for life since ${longDate(sug.date)}</span></div></label>
          <label class="choice"><input type="radio" name="horizon" value="all" ${state.horizon === 'all' ? 'checked' : ''}><div><b>No, it was temporary</b><span>Plan for my whole year</span></div></label>
          <label class="choice"><input type="radio" name="horizon" value="unsure" ${state.horizon === 'unsure' ? 'checked' : ''}><div><b>I’m not sure</b><span>We’ll show both answers</span></div></label></div></fieldset>` : ''}
        <label class="ack"><input type="checkbox" name="ack" ${state.ack ? 'checked' : ''}><span>I understand this is an estimate based on my past usage and the latest prices, not a promise or advice. My utility’s bill is the official amount. <a class="linkbtn" href="#disclaimer" data-nav="disclaimer">Read the full disclaimer</a></span></label>
        <div class="actions"><button class="btn primary" type="submit" id="show" aria-describedby="show-help">Show my result</button><button class="btn secondary" type="button" data-nav="file">Back</button></div>
        <p id="show-help" class="small muted" aria-live="polite" style="margin-top:var(--s-2)"></p>
      </form></section>`;
  }
  function wireQuestions() {
    const f = $('#qs'), btn = $('#show'), help = $('#show-help');
    // What is still missing, in the order it appears on the page.
    const missing = () => {
      const m = [];
      if (!f.plan.value) m.push({ el: f.querySelector('input[name=plan]'), text: 'choose your current plan' });
      if (showCharging() && !f.charging.value) m.push({ el: f.querySelector('input[name=charging]'), text: 'answer the car question' });
      if (state.sug && !f.horizon.value) m.push({ el: f.querySelector('input[name=horizon]'), text: 'choose which months to plan for' });
      if (!f.ack.checked) m.push({ el: f.ack, text: 'tick the box above' });
      return m;
    };
    const list = items => items.map(i => i.text).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' and ' : ', ') + x, '');
    const update = () => {
      const m = missing(), ready = !m.length;
      btn.setAttribute('aria-disabled', String(!ready));
      btn.classList.toggle('is-disabled', !ready);
      const msg = ready ? '' : `To see your result, ${list(m)}.`;
      help.textContent = msg; btn.title = msg;
      f.querySelectorAll('.needs').forEach(x => { if (!m.some(i => i.el.closest('fieldset, .ack') === x)) x.classList.remove('needs'); });
    };
    f.addEventListener('change', () => {
      state.plan = f.plan.value || undefined;
      if (showCharging()) state.charging = f.charging.value === 'yes' ? true : f.charging.value === 'no' ? false : f.charging.value === 'unsure' ? 'unsure' : undefined;
      if (state.sug) state.horizon = f.horizon.value || undefined;
      state.ack = f.ack.checked; update();
    });
    update();
    f.addEventListener('submit', e => {
      e.preventDefault();
      const m = missing();
      if (!m.length) { state.ack = true; go('result', { sub: 'past' }); return; }
      m.forEach(i => i.el.closest('fieldset, .ack').classList.add('needs'));
      help.textContent = ''; requestAnimationFrame(() => { help.textContent = `To see your result, ${list(m)}.`; });
      m[0].el.focus();
    });
  }

  // ---------- 4. Result ----------
  const addMonth = (mk, k) => { const [y, m] = mk.split('-').map(Number); const t = y * 12 + m - 1 + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
  const todayMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }).slice(0, 7);
  // The estimate starts the month after the file ends, or this month if the file is older than that.
  // The last day the file actually covers (a file ending at midnight on the 1st covers up to the day before).
  const lastCoveredDay = () => new Date((state.result.report.coverage.lastEnd - 1) * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const planStart = () => { const next = addMonth(lastCoveredDay().slice(0, 7), 1), now = todayMonth(); return next > now ? next : now; };
  const fileIsOld = () => addMonth(lastCoveredDay().slice(0, 7), 2) < todayMonth();
  // "I'm not sure" answers: the main result uses the more likely reading (car charging; the change lasts) and an
  // alternative is worked out with the other reading, so both answers can be shown.
  function runForecast(ov = {}) {
    const iv = state.result.report.intervals;
    const charging = 'charging' in ov ? ov.charging : state.charging, horizon = ov.horizon || state.horizon;
    const recent = horizon === 'recent' || horizon === 'unsure';
    return E.forecast(iv, { startMonth: planStart(), changeDate: state.sug && recent ? (state.changeOverride ?? state.sug.date) : (state.changeOverride || undefined), treatAsCharging: charging !== false, customKwhPerWeek: state.custom });
  }
  const currentPlan = () => (PLANS.includes(state.plan) ? state.plan : null);
  function summary(f) {
    const mid = f.strategies.mid, rec = f.recommendation;
    const bestSingle = PLANS.reduce((a, b) => (mid.single[b] < mid.single[a] ? b : a));
    const recCost = rec.cost.mid;
    const nextBest = rec.kind === 'schedule' ? mid.single[bestSingle] : Math.min(...PLANS.filter(p => p !== rec.plan).map(p => mid.single[p]));
    const vsNext = nextBest - recCost;           // strategies are already after tax and rebate, month by month
    const cur = currentPlan();
    const vsCurrent = cur ? mid.single[cur] - recCost : null;
    const onBest = rec.kind === 'single' && cur === rec.plan;
    return { mid, rec, bestSingle, recCost, vsNext, vsCurrent, cur, onBest, nextName: rec.kind === 'schedule' ? `${PLAN_NAMES[bestSingle]} all year` : PLAN_NAMES[PLANS.filter(p => p !== rec.plan).reduce((a, b) => (mid.single[b] < mid.single[a] ? b : a))] };
  }
  // How the forecast's prices are described, from what the engine actually used.
  function priceWords(f) {
    const p = f.pricing, starts = p.effectives.map(longDate);
    const base = p.effectives.length === 1 ? `at the prices the Ontario Energy Board set for ${starts[0]}` : `at the Ontario Energy Board prices in effect each month (the prices starting ${starts.join(' and ')})`;
    return p.assumedMonths.length ? `${base}. Prices after ${longDate(p.lastKnownDay)} aren’t known yet, so the estimate assumes they stay the same` : base;
  }
  // A visible notice when the app's prices are probably out of date (a November 1 update was missed).
  function staleNotice() {
    const p = E.pricesFreshness(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }));
    return p.stale ? `<div class="banner warn" role="status"><p><b>This app’s prices may be out of date.</b> Its latest prices are the ones that started on ${longDate(p.latest)}. New Ontario Energy Board prices normally start every November 1, and this app hasn’t been updated with them yet, so the estimate may be off. Your utility’s bill always shows the current prices.</p></div>` : '';
  }
  function whyText(f, rec) {
    const rows = f.scenarios.mid, pct = (a, b) => Math.round(100 * a / Math.max(b, 1e-9));
    const share = rs => { const k = rs.reduce((t, r) => t + r.kwh, 0); return { night: pct(rs.reduce((t, r) => t + r.ulo.overnight, 0), k), peak: pct(rs.reduce((t, r) => t + r.ulo.on, 0), k) }; };
    const span = rs => `${MONTHS[+rs[0].month.slice(5, 7) - 1]} to ${MONTHS[+rs[rs.length - 1].month.slice(5, 7) - 1]}`;
    if (rec.kind === 'single') {
      const sh = share(rows);
      if (rec.plan === 'ulo') return `About ${sh.night}% of your electricity use is between 11 p.m. and 7 a.m., when Ultra-Low Overnight is cheapest. Its weekday 4 to 9 p.m. price is much higher, but only ${sh.peak}% of your use falls then.`;
      if (rec.plan === 'tou') return `Only ${sh.night}% of your use is overnight, so Ultra-Low Overnight’s very low overnight price doesn’t make up for its high weekday 4 to 9 p.m. price, when ${sh.peak}% of your use falls.`;
      return 'Tiered charges the same price at any time of day, and that works out cheapest for how your use is spread through the day.';
    }
    const parts = [...new Set(rec.schedule.plan)].map(p => { const rs = rows.filter((r, i) => rec.schedule.plan[i] === p); const sh = share(rs);
      return p === 'ulo' ? `In the months on Ultra-Low Overnight, ${sh.night}% of your use is overnight, when it’s cheapest.` : `In the months on ${PLAN_NAMES[p]}, more of your use falls on weekday afternoons and evenings (${sh.peak}% between 4 and 9 p.m.), when ${PLAN_NAMES[p]} is cheaper.`; });
    return parts.join(' ');
  }
  function supportBanner() {
    const s = state.result.support;
    if (state.demo) return `<div class="banner info"><p><b>This is a made-up sample household</b>, with a car charged most nights. To see your own result, <a class="linkbtn" href="#file" data-nav="file">open your own file</a>.</p></div>`;
    if (s.level === 'verified') return '';
    const who = GUIDES.find(u => u.hosts.includes(s.profile?.host || ''))?.name || (guide() && guide().id !== 'other' ? guide().name : 'your utility');
    if (state.verifiedByBill) return `<div class="banner ok"><p><b>Your bill matches your file ✓</b> That confirms we read your file correctly for that billing period. It doesn’t check the estimate for the next 12 months.</p></div>`;
    const named = who !== 'your utility';
    return `<div class="banner warn"><div><p><b>${named ? `This is the first time we’ve seen a file from ${esc(who)}.` : 'This is the first time we’ve seen a file like this one.'}</b> The result below is our best reading of it, but we haven’t yet checked it against a real bill ${named ? `from ${esc(who)}` : 'from your utility'}.</p></div>
      <button class="btn secondary" type="button" id="verify-now" style="flex:none">Check it against my bill (2 minutes)</button></div>`;
  }
  function viewResult() {
    let f;
    try { f = runForecast(); } catch (e) {
      const cov = state.result.report.coverage;
      return `<section class="card" aria-labelledby="h-res" style="max-width:860px"><h1 id="h-res" style="font-size:var(--t-2xl);margin-bottom:var(--s-4)">We need a longer file</h1>
        <p>Your file has ${kwh(cov.days, 1)} days of readings. To estimate the next 12 months we need at least a week of readings, and a full year gives the best answer.</p>
        <p>Go back to your utility’s Green Button page and download the longest date range it offers (often 24 months), then open the new file here.</p>
        <div class="actions"><button class="btn primary" type="button" data-nav="file">Open a longer file</button><button class="btn secondary" type="button" data-nav="how">See the file details</button></div>
        <p class="small muted" style="margin-top:var(--s-4)">${esc(e.message)}</p></section>`;
    }
    state.f = f;
    const S = summary(f), rec = S.rec, mid = S.mid;
    const verdict = rec.kind === 'single' ? `<span class="pl-${rec.plan}">${PLAN_NAMES[rec.plan]}</span> all year` :
      rec.schedule.runs.map((r, i) => `${i ? 'then ' : ''}<span class="pl-${r.plan}">${PLAN_NAMES[r.plan]}</span> <span style="white-space:nowrap">${MONTHS[+r.from.slice(5, 7) - 1]}–${MONTHS[+r.to.slice(5, 7) - 1]}</span>`).join(',<br>');
    const charged = !!(f.charging && f.detection.treated);
    const confWords = !charged ? 'Not tested against changes in your usage.' : { high: 'Same answer in all three charging scenarios.', medium: 'Same answer in two of three charging scenarios.', low: 'The answer depends on how much you charge.' }[rec.confidence];
    const dots = !charged ? 0 : { high: 3, medium: 2, low: 1 }[rec.confidence];
    const bestIn = sc => { const s = f.strategies[sc]; return [...PLANS.map(p => [PLAN_NAMES[p] + ' all year', s.single[p]]), ['seasonal switching', s.schedule]].reduce((a, b) => (b[1] < a[1] ? b : a))[0]; };
    const confText = !charged ? 'No car charging is included in this estimate, so we couldn’t test how the answer changes if you use more or less electricity. The estimate assumes your next year will look like your past year.'
      : { high: 'We tried half as much car charging and 30% more. It stayed the cheapest of the options we compared.',
        medium: rec.holdsIn.includes('high') ? `This holds if you charge about as much as recently, or more. If you charged about half as much, ${bestIn('low')} would be cheaper.` : `This holds if you charge about as much as recently, or less. With 30% more charging, ${bestIn('high')} would be cheaper.`,
        low: `With less charging, ${bestIn('low')} is cheapest. With more, ${bestIn('high')}.` }[rec.confidence];
    const elec = mid.electricity;
    const cards = [...PLANS.map(p => ({ key: p, name: PLAN_NAMES[p], desc: PLAN_DESC[p], cost: mid.single[p], elec: elec.single[p], best: rec.kind === 'single' && rec.plan === p, mine: S.cur === p }))];
    if (rec.kind === 'schedule') cards.push({ key: 'schedule', name: 'Seasonal switching', desc: rec.schedule.runs.map(r => `${PLAN_NAMES[r.plan]} ${MONTHS[+r.from.slice(5, 7) - 1]}–${MONTHS[+r.to.slice(5, 7) - 1]}`).join(', '), cost: mid.schedule, elec: elec.schedule, best: true });
    const g = guideOrOther(), latest = E.latestPrices();
    const planSeq = f.months.map((m, i) => (rec.kind === 'single' ? rec.plan : rec.schedule.plan[i]));
    const steps = E.switchSteps(f.months, planSeq, S.cur, todayMonth());
    const switches = steps.map((st, i) => { const m = +st.from.slice(5, 7), prev = MONTHS_LONG[(m + 10) % 12], lead = i === 0 ? 'First' : 'Then';
      const what = st.ifNotAlready ? `if you’re not already on <b>${PLAN_NAMES[st.plan]}</b>, ` : '';
      return st.due ? `<li>${lead}, ${what}to be on <b>${PLAN_NAMES[st.plan]}</b> now, send the form as soon as you can. It starts with your next billing period.</li>`
        : `<li>${lead}, ${what}to be on <b>${PLAN_NAMES[st.plan]}</b> from ${MONTHS_LONG[m - 1]}, send the form by about mid-${prev}.</li>`; }).join('');
    const useCurrent = S.cur && S.vsCurrent > 0, amount = useCurrent ? S.vsCurrent : S.vsNext;
    const reference = useCurrent ? `compared with staying on ${PLAN_NAMES[S.cur]} all year` : `compared with the next-cheapest option, ${esc(S.nextName)}`;
    const close = !S.onBest && amount < E.SWITCH_WORTH;   // presentation rule: under $20 a year counts as "close" (the same $20 used for recommending a switch)
    const headline = S.onBest ? `<div class="saving"><div class="big">No change needed</div><p>Your current plan is already the cheapest. It costs about ${money0(S.vsNext)} a year less than ${esc(S.nextName)}, after tax and rebate.</p></div>`
      : close ? `<div class="saving"><p class="small" style="margin:0 0 var(--s-1);color:var(--ink-2)">These options are close</p><div class="big">About ${money0(amount)} <small>a year</small></div><p>Estimated difference on your whole bill, ${reference}. Convenience may matter more than the saving.</p></div>`
      : `<div class="saving"><p class="small" style="margin:0 0 var(--s-1);color:var(--ink-2)">Estimated savings on your whole bill, not guaranteed</p><div class="big">${money0(amount)} <small>a year</small></div>
        <p><b>${reference[0].toUpperCase() + reference.slice(1)}.</b>${useCurrent ? ` That’s ${money0(S.vsNext)} less than the next-cheapest option, ${esc(S.nextName)}.` : ''}</p></div>`;
    // Why this plan? From the household's own figures in the forecast.
    const why = whyText(f, rec);
    // The other answer, when the person wasn't sure
    let alt = '';
    const altOf = (label, ov) => { try { const g2 = runForecast(ov), r2 = g2.recommendation; const name = r2.kind === 'single' ? `${PLAN_NAMES[r2.plan]} all year` : `seasonal switching (${r2.schedule.runs.map(r => `${PLAN_NAMES[r.plan]} ${MONTHS[+r.from.slice(5, 7) - 1]}–${MONTHS[+r.to.slice(5, 7) - 1]}`).join(', ')})`;
      const same = r2.kind === rec.kind && (r2.kind === 'single' ? r2.plan === rec.plan : r2.schedule.plan.join() === rec.schedule.plan.join());
      return `<li>${label} ${same ? 'the answer is the same.' : `the best option would be <b>${esc(name)}</b> instead.`}</li>`; } catch { return ''; } };
    if (state.charging === 'unsure') alt += altOf('If those high-power periods aren’t car charging,', { charging: false });
    if (state.horizon === 'unsure') alt += altOf('If the change was only temporary,', { horizon: 'all' });
    if (alt) alt = `<div class="banner info" style="margin-top:var(--s-4)"><div><p style="margin:0"><b>You weren’t sure about some answers.</b> This result assumes the more likely case. The other way:</p><ul style="margin:var(--s-2) 0 0">${alt}</ul></div></div>`;
    // One main next step
    const unverified = state.result.support.level === 'unverified' && !state.verifiedByBill && !state.demo;
    const primary = unverified ? `<a class="btn primary" href="#h-why" data-sub="bill">Check a bill before deciding</a>`
      : close ? `<a class="btn primary" href="#plans" data-scroll="plans">Compare the plans</a>`
      : steps.length ? `<a class="btn primary" href="#switch" data-scroll="switch">See switching steps</a>` : '';
    const actions = `<div class="actions result-actions">${primary}<a class="btn secondary" href="#questions" data-nav="questions">Edit my answers</a><a class="btn secondary" href="#file" data-nav="file">Open a different file</a><a class="linkbtn" href="#clear" data-nav="clear">Clear my data and start over</a></div>`;
    const lastDay = lastCoveredDay();
    const stale = staleNotice();
    const old = fileIsOld() ? `<div class="banner warn"><p><b>Your file ends on ${longDate(lastDay)}.</b> The estimate below covers the next 12 months from now, based on how you used electricity up to then. For the best result, download a file that runs up to this month.</p></div>` : '';
    return `${stale}${old}<div id="support-banner">${supportBanner()}</div>
      ${stepsNav('result')}
      <section class="card" aria-labelledby="h-res">
        <div class="result-top">
          <div class="eyebrowless"><h1 id="h-res" style="font-size:var(--t-lg);color:var(--ink-2);font-weight:500;margin-bottom:var(--s-2)">${rec.kind === 'schedule' ? 'A seasonal switch may save the most' : close ? 'Your lowest estimated-cost option, by a small margin' : 'Your lowest estimated-cost option'}, ${mLong(f.months[0])} ${f.months[0].slice(0, 4)} to ${mLong(f.months[11])} ${f.months[11].slice(0, 4)}</h1>
            <p class="verdict">${verdict}</p>
            ${why ? `<p class="why"><b>Why?</b> ${why}</p>` : ''}</div>
          ${headline}
        </div>
        ${actions}${alt}
        <h2 class="cal-title">Recommended plan by month</h2>
        <div class="calendar" role="img" aria-label="Recommended plan by month: ${f.months.map((m, i) => `${mLong(m)} ${PLAN_NAMES[rec.kind === 'single' ? rec.plan : rec.schedule.plan[i]]}`).join(', ')}">
          ${f.months.map((m, i) => { const p = rec.kind === 'single' ? rec.plan : rec.schedule.plan[i]; return `<div class="${p}"><b>${MONTHS[+m.slice(5, 7) - 1]}</b>${p === 'tiered' ? 'Tiered' : p.toUpperCase()}</div>`; }).join('')}
        </div>
        <div class="legend" aria-hidden="true">${[...new Set(rec.kind === 'single' ? [rec.plan] : rec.schedule.plan)].map(p => `<span><span class="sw" style="background:var(--plan-${p})"></span>${PLAN_NAMES[p]}</span>`).join('')}</div>
        <div class="sure"><div class="dots" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= dots ? 'on' : ''}"></i>`).join('')}</div>
          <div><p style="margin:0"><b>How sure are we? ${confWords}</b> ${esc(confText)} <a class="linkbtn" href="#h-why" data-sub="sure">See how we worked this out</a></p></div></div>
        <h2 class="sr-only">Each plan for the next 12 months</h2>
        <div class="plans" id="plans" style="--n:${cards.length}">${cards.map(c => `<div class="plan ${c.best ? 'best' : ''} ${c.mine ? 'mine' : ''}">${c.best ? '<span class="tag">Lowest cost</span>' : ''}
          <h3><span class="sw" style="background:var(--plan-${c.key === 'schedule' ? rec.schedule.runs[0].plan : c.key})"></span>${esc(c.name)}</h3><p class="desc">${esc(c.desc)}</p>
          <div class="cost">${money0(c.cost)}</div><div class="per">for 12 months, after tax and rebate</div><div class="per">Electricity charges ${money0(c.elec)}</div>${c.mine ? '<span class="mine-tag">Your plan now</span>' : ''}</div>`).join('')}</div>
        <p class="small muted" style="margin-top:var(--s-3)">Totals include HST and the Ontario Electricity Rebate on the electricity charges, using each month’s rebate rate. Delivery and regulatory charges are left out because they’re the same on every plan.</p>
        <div class="switch-how" style="margin-top:var(--s-6)">
          <div><h2 id="switch" tabindex="-1" style="font-size:var(--t-lg);margin-bottom:var(--s-2)">How to switch</h2><p class="small muted" style="margin:0 0 var(--s-2)">Changes start with a billing period, so the months below are approximate.</p><ul>
            ${!steps.length ? '<li>Nothing to do. Stay on your current plan.</li>' : `<li>Fill in your utility’s price plan form: <a href="${g.switchUrl}" target="_blank" rel="noopener">${g.id === 'other' ? 'how to switch (Ontario Energy Board)' : `switch plans with ${esc(g.name)}`}</a>.</li>
            <li>If your utility gets the form at least 10 business days before your next billing period, your new plan starts with that period.</li>${switches}`}
            <li>You can switch back at any time.</li></ul></div>
          <div><h2 style="font-size:var(--t-lg);margin-bottom:var(--s-2)">What could change this</h2><ul>
            <li>Using more or less electricity at night, for example charging a car more or less often.</li><li>A new car, a heat pump, or a much hotter summer.</li><li>New prices, which normally start every November 1.</li></ul></div>
        </div>
        <p class="note">This is an estimate, not a promise. It assumes your next year will look like your past year, ${priceWords(f)}. Delivery and regulatory charges are the same on every plan, so the savings shown include only the difference on the electricity line, plus HST and the Ontario Electricity Rebate on that difference. If your usage changes (a new car, a heat pump, a hotter summer) or prices change, the best plan may change too. The OEB itself says there is no guarantee you’ll save money by switching. <a class="linkbtn" href="#disclaimer" data-nav="disclaimer">Read the full disclaimer</a></p>
      </section>
      <section class="card" aria-labelledby="h-why" style="margin-top:var(--s-5)">
        <h2 id="h-why" style="font-size:var(--t-xl);margin-bottom:var(--s-3)">See why</h2>
        <div class="subnav" role="tablist" aria-label="Details">${[['past', 'Your past year'], ['bill', 'Check my bill'], ['quality', 'File checks'], ['sure', 'How sure are we?']].map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel" aria-selected="${state.sub === k}" tabindex="${state.sub === k ? 0 : -1}" data-sub="${k}">${l}</button>`).join('')}</div>
        <div id="panel" role="tabpanel" tabindex="0" aria-labelledby="tab-${state.sub}"></div>
      </section>`;
  }
  function wireResult() {
    const panel = $('#panel');
    if (!panel) return;
    const draw = () => { ({ past: renderPast, bill: renderBill, quality: renderQualityPlain, sure: renderSure }[state.sub])(panel); };
    draw();
    app.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); state.sub = b.dataset.sub; app.querySelectorAll('.subnav [data-sub]').forEach(t => { t.setAttribute('aria-selected', t.dataset.sub === state.sub); t.tabIndex = t.dataset.sub === state.sub ? 0 : -1; }); panel.setAttribute('aria-labelledby', 'tab-' + state.sub); draw(); if (!b.closest('.subnav')) $('#h-why').scrollIntoView(); }));
    const tabs = [...app.querySelectorAll('.subnav [role=tab]')];
    tabs.forEach((t, i) => t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); n.click(); }));
    wireSupportBanner();
    app.querySelectorAll('[data-scroll]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = document.getElementById(a.dataset.scroll); if (t) { t.scrollIntoView(); const h = t.matches('h2') ? t : t.querySelector('h2, h3'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } } }));
  }

  function wireSupportBanner() { const v = $('#verify-now'); if (v) v.addEventListener('click', () => { state.sub = 'bill'; render(); $('#h-why').scrollIntoView(); }); }
  function refreshSupportBanner() { const b = $('#support-banner'); if (b) { b.innerHTML = supportBanner(); wireSupportBanner(); } }

  // ---------- Evidence: your past year ----------
  function renderPast(panel) {
    const { history, profile } = state.result;
    const latest = E.latestPrices(), basis = state.basis;
    const costOf = m => (basis === 'now' ? m.atCurrent : m.atThen || { tou: null, ulo: null, tiered: null });
    const rows = history.map(m => ({ m, c: costOf(m), partial: !m.complete }));
    const totals = Object.fromEntries(PLANS.map(p => [p, rows.filter(r => !r.partial).reduce((s, r) => (r.c[p] === null || s === null ? null : s + r.c[p]), 0)]));
    const best = c => { const v = PLANS.filter(p => c[p] !== null && c[p] !== undefined); return v.length ? v.reduce((a, b) => (c[b] < c[a] ? b : a)) : null; };
    const cur = currentPlan();
    panel.innerHTML = `<h3 class="sec">What your past year would have cost on each plan</h3>
      <p class="muted">Electricity charges only. Delivery and regulatory charges are the same on every plan.</p>
      <div class="toggle" role="group" aria-label="Which prices to use"><button type="button" data-basis="now" aria-pressed="${basis === 'now'}">Prices from ${longDate(latest.effective)}</button><button type="button" data-basis="then" aria-pressed="${basis === 'then'}">Prices at the time</button></div>
      ${costChart(rows)}
      <div class="scroll"><table><caption class="sr-only">Monthly electricity charges under each plan</caption><thead><tr><th scope="col">Month</th><th scope="col" class="n">kWh</th>${PLANS.map(p => `<th scope="col" class="n">${PLAN_NAMES[p]}${cur === p ? ' (your plan)' : ''}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(({ m, c, partial }) => { const b = partial ? null : best(c); return `<tr class="${partial ? 'partial' : ''}"><th scope="row" style="font-weight:400">${monthName(m.month)}</th><td class="n">${kwh(m.kwh)}</td>${PLANS.map(p => `<td class="n${b === p ? ' best' : ''}">${money(c[p])}</td>`).join('')}</tr>`; }).join('')}
      </tbody><tfoot><tr><td>${rows.filter(r => !r.partial).length} full months</td><td class="n">${kwh(rows.filter(r => !r.partial).reduce((s, r) => s + r.m.kwh, 0))}</td>${(() => { const b = best(totals); return PLANS.map(p => `<td class="n${b === p ? ' best' : ''}">${money(totals[p])}</td>`).join(''); })()}</tr></tfoot></table></div>
      <p class="small muted">✓ marks the cheapest plan each full month. Months your file doesn’t fully cover (usually the first and last) are marked partial and left out of the totals.</p>
      <h3 class="sec">When you use electricity</h3>${heatmap(profile)}
      <details><summary>Show these numbers as a table</summary><div class="scroll"><table><caption class="sr-only">Average kWh in each hour of the day, by month</caption><thead><tr><th scope="col">Month</th>${[...Array(24).keys()].map(h => `<th scope="col" class="n">${h}:00</th>`).join('')}</tr></thead><tbody>
        ${profile.map(p => `<tr><th scope="row" style="font-weight:400">${monthName(p.month)}${p.days < 7 ? ' (partial)' : ''}</th>${p.hours.map(v => `<td class="n">${v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
      <details><summary>Your kWh in each price period, by month</summary>
      <div class="scroll"><table><thead><tr><th scope="col" rowspan="2">Month</th><th scope="colgroup" colspan="3">Time-of-Use</th><th scope="colgroup" colspan="4">Ultra-Low Overnight</th></tr>
      <tr>${['on', 'mid', 'off'].map(p => `<th scope="col" class="n"><span class="sw" style="background:var(${PERIOD_VAR[p]})"></span>${PERIOD_NAMES[p]}</th>`).join('')}${['on', 'mid', 'off', 'overnight'].map(p => `<th scope="col" class="n"><span class="sw" style="background:var(${PERIOD_VAR[p]})"></span>${p === 'off' ? 'Weekend off-peak' : PERIOD_NAMES[p]}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(({ m, partial }) => `<tr class="${partial ? 'partial' : ''}"><th scope="row" style="font-weight:400">${monthName(m.month)}</th>${['on', 'mid', 'off'].map(p => `<td class="n">${kwh(m.tou[p])}</td>`).join('')}${['on', 'mid', 'off', 'overnight'].map(p => `<td class="n">${kwh(m.ulo[p])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></details>`;
    panel.querySelectorAll('[data-basis]').forEach(b => b.addEventListener('click', () => { state.basis = b.dataset.basis; renderPast(panel); panel.querySelector(`[data-basis=${state.basis}]`).focus(); }));
  }
  function costChart(rows) {
    const vals = rows.flatMap(r => PLANS.map(p => r.c[p])).filter(v => v !== null && v !== undefined);
    if (!vals.length) return '';
    const max = Math.max(50, Math.ceil(Math.max(...vals) / 50) * 50);   // never zero, so a file with no usage still draws
    const gw = 70, bw = 18, left = 52, top = 10, h = 220, W = left + rows.length * gw + 10, H = top + h + 28;
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Bar chart of monthly electricity charges under each plan. The same numbers are in the table below.">`;
    for (let v = 0; v <= max; v += 50) { const y = top + h - h * v / max; svg += `<line class="axis" x1="${left}" x2="${W - 6}" y1="${y}" y2="${y}"/><text x="${left - 8}" y="${y + 4}" text-anchor="end">$${v}</text>`; }
    rows.forEach((r, i) => {
      const x0 = left + i * gw + (gw - 3 * bw) / 2;
      PLANS.forEach((p, j) => { const v = r.c[p]; if (v === null || v === undefined) return; const bh = h * v / max; svg += `<rect x="${x0 + j * bw}" y="${top + h - bh}" width="${bw - 3}" height="${bh}" rx="2" style="fill:var(--plan-${p})${r.partial ? ';opacity:.35' : ''}"><title>${monthName(r.m.month)}, ${PLAN_NAMES[p]}: ${money(v)}</title></rect>`; });
      svg += `<text x="${left + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${MONTHS[+r.m.month.slice(5, 7) - 1]}</text>`;
    });
    return `<div class="legend" style="margin-bottom:var(--s-2)">${PLANS.map(p => `<span><span class="sw" style="background:var(--plan-${p})"></span>${PLAN_NAMES[p]}</span>`).join('')}</div><figure style="margin:0 0 var(--s-4)"><div class="scroll">${svg + '</svg>'}</div></figure>`;
  }
  function heatmap(profile) {
    if (!profile || !profile.length) return '';
    const cw = 34, ch = 22, lw = 150, band = 14, top = 3 * (band + 4) + 10, bottom = 24, right = 16;
    const W = lw + 24 * cw + right, H = top + profile.length * ch + bottom;
    const max = Math.max(...profile.flatMap(p => p.hours));
    const uloP = h => (h >= 23 || h < 7 ? 'overnight' : h >= 16 && h < 21 ? 'on' : 'mid');
    const touW = h => (h < 7 || h >= 19 ? 'off' : h >= 11 && h < 17 ? 'mid' : 'on');
    const touS = h => (h < 7 || h >= 19 ? 'off' : h >= 11 && h < 17 ? 'on' : 'mid');
    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Average electricity use by hour of day for each month, with the price periods for each plan shown above">`;
    [['ULO, weekdays', uloP], ['TOU, winter weekdays', touW], ['TOU, summer weekdays', touS]].forEach(([label, fn], i) => {
      const y = i * (band + 4);
      svg += `<text x="${lw - 8}" y="${y + band - 2}" text-anchor="end" style="font-size:11px">${label}</text>`;
      for (let h = 0; h < 24; h++) svg += `<rect x="${lw + h * cw}" y="${y}" width="${cw - 1}" height="${band}" style="fill:var(${PERIOD_VAR[fn(h)]})"><title>${label}, ${h}:00 to ${h + 1}:00: ${PERIOD_NAMES[fn(h)]}</title></rect>`;
    });
    profile.forEach((p, r) => {
      const y = top + r * ch;
      svg += `<text x="${lw - 8}" y="${y + ch - 7}" text-anchor="end">${monthName(p.month)}${p.days < 7 ? ' (partial)' : ''}</text>`;
      p.hours.forEach((v, h) => { const pct = max ? Math.round(100 * v / max) : 0; svg += `<rect x="${lw + h * cw}" y="${y}" width="${cw - 1}" height="${ch - 1}" style="fill:color-mix(in srgb, var(--ink) ${pct}%, var(--heat-0))"><title>${monthName(p.month)}, ${h}:00 to ${h + 1}:00: ${v.toFixed(2)} kWh on average</title></rect>`; });
    });
    for (let h = 0; h <= 24; h += 3) svg += `<text x="${lw + h * cw}" y="${H - 6}" text-anchor="middle">${h === 0 ? 'midnight' : h === 12 ? 'noon' : h === 24 ? '' : h < 12 ? h + ' a.m.' : (h - 12) + ' p.m.'}</text>`;
    return `<figure style="margin:0"><div class="scroll">${svg}</svg></div><figcaption class="small muted" style="margin-top:var(--s-2)">Each square is your average use in that hour of the day: darker means more. The coloured bands show which price applies on weekdays. On weekends and holidays, Time-of-Use is off-peak all day, and Ultra-Low Overnight is weekend off-peak from 7 a.m. to 11 p.m.</figcaption></figure>
      <div class="legend" style="margin-top:var(--s-3)">${['overnight', 'off', 'mid', 'on'].map(p => `<span><span class="sw" style="background:var(${PERIOD_VAR[p]})"></span>${PERIOD_NAMES[p]}</span>`).join('')}</div>`;
  }

  // ---------- Evidence: check a bill ----------
  function renderBill(panel) {
    const isAlectra = /alectra/i.test(state.result.support.profile?.host || '') || state.utility === 'alectra';
    const plan = currentPlan() || 'ulo';
    panel.innerHTML = `<h3 class="sec">Check one bill against your file</h3>
      <p class="muted">Enter the figures from one of your bills. We work out the same billing period from your file and compare, line by line. Use a bill whose dates are inside your file.</p>
      <form class="form-grid" novalidate id="bill">
        <label>Price plan on this bill<select name="plan">${PLANS.map(p => `<option value="${p}"${p === plan ? ' selected' : ''}>${PLAN_NAMES[p]}</option>`).join('')}</select></label>
        <label>Billing period from (as printed)<input type="date" name="from" required></label>
        <label>Billing period to (as printed)<input type="date" name="to" required></label>
        <label>Usage on the bill, kWh<input name="total" inputmode="decimal" placeholder="optional"></label>
        <label>Previous meter reading<input name="prev" inputmode="decimal" placeholder="optional"></label>
        <label>Current meter reading<input name="curr" inputmode="decimal" placeholder="optional"></label>
        <div class="full" data-periods></div>
        <details class="full"><summary>The rest of the bill (optional)</summary>
          <div class="form-grid">
            <label>Your utility and rate zone<select name="utility"><option value="" selected>Another utility, or I’m not sure</option>${E.UTILITIES.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select><span class="small muted">Only Alectra’s PowerStream rate zone is in the tool so far. Elsewhere, Delivery and Regulatory are taken from your bill.</span></label>
            <label>Bill date (statement date)<input type="date" name="b_date"><span class="small muted">Optional. Used to pick the rebate rate.</span></label>
            <label>Delivery, $<input name="b_delivery" inputmode="decimal"></label><label>Regulatory, $<input name="b_regulatory" inputmode="decimal"></label>
            <label>HST, $<input name="b_hst" inputmode="decimal"></label><label>Ontario Electricity Rebate, $<input name="b_oer" inputmode="decimal" placeholder="as a positive number"></label><label>Amount due, $<input name="b_total" inputmode="decimal"></label>
          </div></details>
        <label class="full" style="display:flex;gap:8px;align-items:flex-start;color:var(--ink)"><input type="checkbox" name="remainder"${isAlectra ? ' checked' : ''} style="width:auto;margin-top:4px"> <span>The bill’s total comes from the meter, and the utility puts whatever is left over into one period. (Alectra does this, with the leftover going into <span data-remname>Overnight</span>.)</span></label>
        <div class="full actions" style="margin-top:0"><button class="btn primary" type="submit">Check this bill</button></div>
        <p class="full err" data-err id="bill-err" aria-live="polite"></p>
      </form><div data-out aria-live="polite"></div>
      <div id="xcheck">${crossCheck()}</div>`;
    const form = panel.querySelector('#bill');
    const drawPeriods = () => {
      const p = form.plan.value;
      form.querySelector('[data-periods]').innerHTML = `<div class="scroll"><table><thead><tr><th scope="col">Line on the bill</th><th scope="col">kWh</th><th scope="col">Amount, $ (optional)</th></tr></thead><tbody>
        ${E.BILL_PERIODS[p].map(k => `<tr><th scope="row" style="font-weight:400">${k === 'total' ? 'Electricity (all usage)' : `<span class="sw" style="background:var(${PERIOD_VAR[k]})"></span>${p === 'ulo' && k === 'off' ? 'Weekend off-peak' : PERIOD_NAMES[k]}`}</th><td><input name="kwh_${k}" inputmode="decimal" aria-label="${PERIOD_NAMES[k]} kWh"></td><td><input name="usd_${k}" inputmode="decimal" aria-label="${PERIOD_NAMES[k]} amount in dollars"></td></tr>`).join('')}
        </tbody></table></div>`;
      form.querySelector('[data-remname]').textContent = p === 'ulo' ? 'Overnight' : p === 'tou' ? 'Off-peak' : 'the total';
      form.remainder.disabled = p === 'tiered';
    };
    // Keep what was typed for the rest of this visit, including when switching between the "See why" tabs.
    const saveDraft = () => { if (state.verifiedByBill || panel.querySelector('[data-out] .banner.ok')) staleCheck(panel); const d = {}; for (const el of form.elements) if (el.name) d[el.name] = el.type === 'checkbox' ? el.checked : el.value; d.__rest = form.querySelector('details').open; state.billDraft = d; };
    const applyDraft = () => { const d = state.billDraft; if (!d) return; for (const el of form.elements) if (el.name && el.name in d) { if (el.type === 'checkbox') el.checked = d[el.name]; else el.value = d[el.name]; } };
    const redraw = () => { drawPeriods(); applyDraft(); };
    form.plan.addEventListener('change', () => { saveDraft(); redraw(); });
    if (state.billDraft?.plan) form.plan.value = state.billDraft.plan;
    redraw();
    if (state.billDraft?.__rest) form.querySelector('details').open = true;
    form.addEventListener('input', saveDraft); form.addEventListener('change', saveDraft); form.querySelector('details').addEventListener('toggle', saveDraft);
    form.addEventListener('submit', e => { e.preventDefault(); checkBill(form, panel); });
    const wireX = () => { const sel = panel.querySelector('select[name=xmonth]'); if (sel) sel.addEventListener('change', () => { state.xmonth = sel.value; panel.querySelector('#xcheck').innerHTML = crossCheck(); wireX(); panel.querySelector('select[name=xmonth]').focus(); }); };
    wireX();
  }
  // Each comparison gets one status: ok (matches), diff (doesn't match), input (used to work something out),
  // bill (taken from the bill, so not checked), none (left blank or can't be worked out).
  const STATUS_TEXT = { ok: '<span class="ok">matches</span>', input: '<span class="muted">used as an input</span>', bill: '<span class="muted">from your bill</span>', none: '<span class="muted">not checked</span>' };
  const statusCell = (st, d, digits) => (st === 'diff' ? `<span class="warn">${d > 0 ? '+' : ''}${d.toFixed(digits)}</span>` : STATUS_TEXT[st]);
  // A "matches" result belongs to the figures that were checked. Any edit makes it stale.
  function staleCheck(panel) {
    if (state.verifiedByBill) { state.verifiedByBill = false; refreshSupportBanner(); }
    const b = panel.querySelector('[data-out] .banner.ok');
    if (b) { b.className = 'banner info'; b.style.marginTop = 'var(--s-4)'; b.innerHTML = '<p><b>You’ve changed the figures since the last check.</b> Check the bill again to compare them.</p>'; }
  }
  function checkBill(form, panel) {
    staleCheck(panel);
    try { checkBillInner(form, panel); }
    catch (e) {
      const known = ['INVALID_INPUT', 'NO_PRICES', 'PLAN_NOT_AVAILABLE', 'UNSUPPORTED_DATE'];
      panel.querySelector('[data-out]').innerHTML = '';
      form.querySelector('[data-err]').textContent = known.includes(e.code) ? e.message : 'This bill couldn’t be checked. Please check the figures and try again.';
      if (!known.includes(e.code)) console.error(e);
    }
  }
  function checkBillInner(form, panel) {
    const err = form.querySelector('[data-err]'), out = panel.querySelector('[data-out]');
    err.textContent = ''; out.innerHTML = '';
    for (const el of form.querySelectorAll('[aria-invalid]')) { el.removeAttribute('aria-invalid'); if (el.getAttribute('aria-describedby') === 'bill-err') el.removeAttribute('aria-describedby'); }
    // Show a message and point the field at it, so screen readers announce the message with the field.
    const fieldError = (el, msg) => { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'bill-err'); el.focus(); err.textContent = msg; };
    const plan = form.plan.value, from = form.from.value, to = form.to.value;
    if (!from || !to) return void fieldError(!from ? form.from : form.to, 'Enter both billing dates.');
    if (from >= to) return void fieldError(form.to, 'The “to” date must be after the “from” date.');
    // Every filled-in number must be a number.
    for (const el of form.querySelectorAll('input[inputmode=decimal]')) {
      const v = num(el.value);
      if (v !== undefined && !Number.isFinite(v)) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'bill-err'); el.focus(); return void (err.textContent = `“${el.value}” isn’t a number. Check the ${el.getAttribute('aria-label') || el.closest('label')?.firstChild?.textContent?.trim() || 'highlighted'} field.`); }
    }
    const kwhIn = {}, usd = {};
    for (const k of E.BILL_PERIODS[plan]) {
      const v = num(form['kwh_' + k].value); if (v === undefined) return void fieldError(form['kwh_' + k], `Enter the kWh for ${PERIOD_NAMES[k]}.`);
      kwhIn[k] = v; const d = num(form['usd_' + k].value); if (d !== undefined) usd[k] = d;
    }
    const bill = { plan, from, to, kwh: kwhIn, dollars: usd };
    const total = num(form.total.value); if (total !== undefined) bill.totalKwh = total;
    const remainderPeriod = form.remainder.checked && plan !== 'tiered' ? (plan === 'ulo' ? 'overnight' : 'off') : undefined;
    if (remainderPeriod && bill.totalKwh === undefined) return void fieldError(form.total, 'To use the meter total, enter “Usage on the bill”.');
    const r = E.reconcileBill(state.result.report.intervals, bill, { remainderPeriod });
    const reg = E.matchRegisterReads(state.result.register, num(form.prev.value), num(form.curr.value));
    const fmtT = t => new Date(t * 1000).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' });
    const complete = r.coverage >= 0.999;
    const notes = [`We counted your use from ${fmtT(r.window.start)} to ${fmtT(r.window.end)} (${r.window.days} days). ${GUIDES.find(u => u.id === 'alectra').hosts.includes(state.result.support.profile?.host || '') ? 'Alectra bills show the day of the previous meter reading as “from”, so usage starts the next midnight.' : 'We assume your bill shows the day of the previous meter reading as “from”, as Alectra’s bills do, so usage starts the next midnight. This hasn’t been checked for your utility.'}`];
    if (!complete) notes.push(`<span class="warn">Your file covers only ${(r.coverage * 100).toFixed(1)}% of this billing period, so this bill can’t be checked against it.</span>`);
    if (reg && (reg.prev || reg.curr)) notes.push(`Meter readings found in your file: ${reg.prev ? `previous at ${longDate(reg.prev.local)} 00:00` : 'previous not found'}, ${reg.curr ? `current at ${longDate(reg.curr.local)} 00:00` : 'current not found'}.`);
    if (r.crossesPriceChange) notes.push('<span class="warn">This billing period includes a price change (November 1), so amounts are worked out reading by reading.</span>');
    if (r.remainderPeriod) notes.push(`${PERIOD_NAMES[r.remainderPeriod]} is the bill’s total (${kwh(bill.totalKwh, 3)} kWh) minus the other periods, the way the utility works it out. Without that, it would be ${kwh(r.rows.find(x => x.period === r.remainderPeriod).intervalKwh, 3)} kWh. So ${PERIOD_NAMES[r.remainderPeriod]} and the total aren’t independent checks.`);
    const tally = { ok: 0, diff: 0, unchecked: 0, kwhChecked: 0 };
    const count = st => { if (st === 'ok') tally.ok++; else if (st === 'diff') tally.diff++; else tally.unchecked++; return st; };
    const rows = r.rows.map(x => {
      const isRem = x.period === r.remainderPeriod;
      const kst = count(isRem ? 'input' : Math.abs(x.modelDiffKwh) <= 0.0005 ? 'ok' : 'diff');
      if (kst === 'ok' && plan !== 'tiered') tally.kwhChecked++;
      const dd = x.billDollars !== undefined && x.modelDollars !== undefined ? x.modelDollars - x.billDollars : null;
      const dst = count(x.billDollars === undefined || x.modelDollars === undefined ? 'none' : Math.abs(dd) <= 0.005 ? 'ok' : 'diff');
      return `<tr><th scope="row" style="font-weight:400">${PERIOD_NAMES[x.period]}</th><td class="n">${kwh(x.billKwh, 3)}</td><td class="n">${kwh(x.modelKwh, 3)}</td><td class="n">${statusCell(kst, x.modelDiffKwh, 3)}</td><td class="n">${x.billDollars !== undefined ? money(x.billDollars) : '–'}</td><td class="n">${money(x.modelDollars)}</td><td class="n">${statusCell(dst, dd, 2)}</td></tr>`;
    }).join('');
    // Total usage, checked on its own unless it was used to work out a period.
    let totalRow = '';
    if (bill.totalKwh !== undefined && plan !== 'tiered') {
      const tol = Math.max(0.5, bill.totalKwh * 0.001), d = r.intervalTotalKwh - bill.totalKwh;
      const st = count(r.remainderPeriod ? 'input' : Math.abs(d) <= tol ? 'ok' : 'diff');
      totalRow = `<tr><th scope="row" style="font-weight:400">Total usage${st === 'ok' ? `<br><span class="small muted">within ${kwh(tol, 1)} kWh, because meter readings aren’t taken exactly at midnight</span>` : ''}</th><td class="n">${kwh(bill.totalKwh, 3)}</td><td class="n">${kwh(r.intervalTotalKwh, 3)}</td><td class="n">${statusCell(st, d, 3)}</td><td colspan="3"></td></tr>`;
    }
    const whole = fullBillSection(form, bill, r, count);
    const success = complete && tally.diff === 0 && tally.ok > 0 && (plan === 'tiered' || tally.kwhChecked > 0);
    const banner = !complete ? '<div class="banner warn" style="margin-top:var(--s-4)"><p><b>This bill can’t be checked.</b> Your file doesn’t cover the whole billing period.</p></div>'
      : tally.diff ? '<div class="banner warn" style="margin-top:var(--s-4)"><p><b>Some lines don’t match.</b> See the differences below. Small differences can come from rounding, or from how your utility splits the billing period.</p></div>'
      : !tally.ok ? '<div class="banner info" style="margin-top:var(--s-4)"><p><b>Nothing could be checked.</b> Enter at least the kWh for each period.</p></div>'
      : `<div class="banner ok" style="margin-top:var(--s-4)"><p><b>The bill for ${longDate(form.from.value)} to ${longDate(form.to.value)} matches your file.</b> ${tally.ok} ${tally.ok === 1 ? 'line' : 'lines'} matched, each within the tolerance shown in its column.${tally.unchecked ? ` ${tally.unchecked} ${tally.unchecked === 1 ? 'line wasn’t' : 'lines weren’t'} checked (left blank, used as an input or taken from your bill).` : ''} ${plan === 'tiered' ? 'For Tiered bills, only the total usage is compared for now.' : 'That confirms we read your file correctly for this billing period. It doesn’t check the estimate for the next 12 months.'}</p></div>`;
    out.innerHTML = `${banner}<ul class="issues">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
      <div class="scroll"><table><caption class="sr-only">Bill compared with your file</caption><thead><tr><th scope="col">Line</th><th scope="col" class="n">Bill kWh</th><th scope="col" class="n">From your file</th><th scope="col" class="n">kWh check (±0.001 kWh)</th><th scope="col" class="n">Bill $</th><th scope="col" class="n">Recomputed $</th><th scope="col" class="n">$ check (±1¢)</th></tr></thead><tbody>${rows}${totalRow}</tbody></table></div>
      ${whole.html}`;
    // The "checked against your bill" notice belongs to this check only: a later failed check removes it.
    const was = state.verifiedByBill;
    state.verifiedByBill = success && plan !== 'tiered' && state.result.support.level === 'unverified' && !state.demo;
    if (was !== state.verifiedByBill) refreshSupportBanner();
  }
  function fullBillSection(form, bill, r, count) {
    const got = k => num(form['b_' + k].value);
    if (!['delivery', 'regulatory', 'hst', 'oer', 'total'].some(k => got(k) !== undefined)) return { html: '' };
    if (bill.plan === 'tiered') return { html: '<h3 class="sec">Whole bill</h3><p class="muted">Checking the whole bill isn’t available for Tiered bills yet, so the figures you entered for the rest of the bill weren’t checked.</p>' };
    if (r.rows.some(x => x.modelDollars === undefined)) return { html: '<h3 class="sec">Whole bill</h3><p class="muted">The electricity charge for this period couldn’t be worked out, so the whole bill wasn’t checked.</p>' };
    const elec = r.rows.reduce((t, x) => t + x.modelDollars, 0);
    const kwhTotal = bill.totalKwh ?? r.rows.reduce((t, x) => t + x.modelKwh, 0);
    const uid = form.utility.value;
    let fb, note = '', fromBill = new Set();
    const billDate = form.b_date.value || form.to.value;
    const util = uid ? E.UTILITIES.find(u => u.id === uid) : null;
    let dateNote = form.b_date.value ? '' : ' The rebate rate is taken from the billing period’s end date; enter the bill date if it was printed after November 1.';
    if (util && billDate < util.effective) dateNote += ` This tool has ${util.name.split(',')[0]} rates from ${longDate(util.effective)} only, so the tool’s regulatory rates may not apply to this bill.`;
    if (uid) { fb = E.fullBill({ utilityId: uid, days: r.window.days, kwh: kwhTotal, electricity: elec, deliveryFromBill: got('delivery'), billDate }); if (fb.deliverySource !== 'tariff') fromBill.add('delivery'); note = fb.deliverySource === 'bill' ? 'Delivery is taken from your bill, because this utility’s delivery rates aren’t in the tool yet. The other lines are worked out by the tool.' : ''; }
    else {
      const deliv = got('delivery'), reg = got('regulatory');
      if (deliv === undefined || reg === undefined) return { html: '<h3 class="sec">Whole bill</h3><p class="muted">For another utility, enter Delivery and Regulatory from your bill to check the HST, rebate and amount due.</p>' };
      const subtotal = Math.round((elec + deliv + reg) * 100) / 100, pe = E.PRICES.filter(p => p.effective <= billDate).pop();
      fb = { lines: [{ key: 'electricity', label: 'Electricity', amount: Math.round(elec * 100) / 100 }, { key: 'delivery', label: 'Delivery', amount: deliv }, { key: 'regulatory', label: 'Regulatory', amount: reg }], subtotal, hst: Math.floor(subtotal * 13 + 1e-6) / 100, oerPercent: pe?.oer, oer: pe ? Math.floor(subtotal * pe.oer + 1e-6) / 100 : null };
      fb.total = fb.oer === null ? null : Math.round((subtotal + fb.hst - fb.oer) * 100) / 100;
      fromBill = new Set(['delivery', 'regulatory']);
      note = 'Delivery and Regulatory are taken from your bill. HST, the rebate and the amount due are worked out by the tool. The rounding follows Alectra’s bills and hasn’t been checked for other utilities.';
    }
    const billVal = { electricity: Object.keys(bill.kwh).every(k => bill.dollars[k] !== undefined) ? r.rows.reduce((t, x) => t + x.billDollars, 0) : undefined, delivery: got('delivery'), regulatory: got('regulatory') };
    const row = (label, mine, theirs, detail, key) => {
      const st = count(fromBill.has(key) ? 'bill' : theirs === undefined || mine === null ? 'none' : Math.abs(mine - theirs) < 0.005 ? 'ok' : 'diff');
      return `<tr><th scope="row" style="font-weight:400">${label}${detail ? `<br><span class="small muted">${esc(detail)}</span>` : ''}</th><td class="n">${theirs === undefined ? '–' : money(theirs)}</td><td class="n">${money(mine)}</td><td class="n">${statusCell(st, theirs === undefined || mine === null ? 0 : mine - theirs, 2)}</td></tr>`;
    };
    const allIn = ['electricity', 'delivery', 'regulatory'].every(k => billVal[k] !== undefined);
    note = (util ? `Rate zone used: ${util.name}. ` : 'No rate zone chosen, so Delivery and Regulatory are taken from your bill. ') + note + dateNote;
    const html = `<h3 class="sec">Whole bill</h3>${note ? `<p class="small muted">${note}</p>` : ''}<div class="scroll"><table><thead><tr><th scope="col">Line</th><th scope="col" class="n">Bill</th><th scope="col" class="n">Worked out</th><th scope="col" class="n">Check (±1¢)</th></tr></thead><tbody>
      ${fb.lines.map(l => row(l.label, l.amount, billVal[l.key], l.key === 'regulatory' ? l.detail : '', l.key)).join('')}
      ${row('Subtotal', fb.subtotal, allIn ? Math.round((billVal.electricity + billVal.delivery + billVal.regulatory) * 100) / 100 : undefined, '', 'subtotal')}
      ${row('HST (13%)', fb.hst, got('hst'), '', 'hst')}${row(`Ontario Electricity Rebate (${fb.oerPercent}%)`, fb.oer === null ? null : -fb.oer, got('oer') === undefined ? undefined : -Math.abs(got('oer')), '', 'oer')}${row('<b>Amount due</b>', fb.total, got('total'), '', 'total')}
      </tbody></table></div>`;
    return { html };
  }
  function crossCheck() {
    const months = state.result.history.filter(m => m.complete);
    if (!months.length) return '';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    const pe = E.PRICES.filter(p => p.effective <= today).pop() || E.PRICES[0];
    const key = months.some(m => m.month === state.xmonth) ? state.xmonth : months[months.length - 1].month;
    const m = months.find(x => x.month === key), mm = +key.slice(5, 7), th = (mm >= 5 && mm <= 10) ? 600 : 1000;
    const tou = (m.tou.on * pe.tou.on + m.tou.mid * pe.tou.mid + m.tou.off * pe.tou.off) / 100;
    const ulo = (m.ulo.on * pe.ulo.on + m.ulo.mid * pe.ulo.mid + m.ulo.off * pe.ulo.off + m.ulo.overnight * pe.ulo.overnight) / 100;
    const tiered = (Math.min(m.kwh, th) * pe.tiered.t1 + Math.max(0, m.kwh - th) * pe.tiered.t2) / 100;
    const k = x => kwh(x, 0);
    return `<h3 class="sec">Or check a month with the Ontario Energy Board’s calculator</h3>
      <p class="muted">The <a href="https://oeb.ca/consumer-information-and-protection/bill-calculator" target="_blank" rel="noopener">OEB bill calculator</a> is separate from this tool. Give it the same amounts and it should show the same electricity charges.</p>
      <label class="field" style="max-width:260px">Month to check<select name="xmonth">${months.map(x => `<option value="${x.month}"${x.month === key ? ' selected' : ''}>${monthName(x.month)}</option>`).join('')}</select></label>
      <ol class="steps-list"><li>Open the OEB bill calculator and choose the residential electricity calculator.</li><li>Pick your utility.</li>
        <li>Choose to enter your usage by time period, and enter these amounts for ${monthName(key)}:
        <div class="scroll"><table><thead><tr><th scope="col">Plan</th><th scope="col" class="n">On-peak</th><th scope="col" class="n">Mid-peak</th><th scope="col" class="n">Off-peak</th><th scope="col" class="n">Overnight</th><th scope="col" class="n">Total</th></tr></thead><tbody>
        <tr><th scope="row" style="font-weight:400">Time-of-Use</th><td class="n">${k(m.tou.on)}</td><td class="n">${k(m.tou.mid)}</td><td class="n">${k(m.tou.off)}</td><td class="n">–</td><td class="n">${k(m.kwh)}</td></tr>
        <tr><th scope="row" style="font-weight:400">Ultra-Low Overnight</th><td class="n">${k(m.ulo.on)}</td><td class="n">${k(m.ulo.mid)}</td><td class="n">${k(m.ulo.off)} (weekend)</td><td class="n">${k(m.ulo.overnight)}</td><td class="n">${k(m.kwh)}</td></tr>
        <tr><th scope="row" style="font-weight:400">Tiered</th><td colspan="4" class="muted">Only the total is used</td><td class="n">${k(m.kwh)}</td></tr></tbody></table></div></li>
        <li>Its electricity charges should be close to these, at today’s prices (from ${longDate(pe.effective)}): Time-of-Use <b>${money(tou)}</b>, Ultra-Low Overnight <b>${money(ulo)}</b>, Tiered <b>${money(tiered)}</b>.</li></ol>
      <p class="small muted">Small differences come from rounding the kWh. For Tiered, the calculator may use today’s season (${th === 1000 ? 'winter, first 1,000 kWh' : 'summer, first 600 kWh'} is used here for ${MONTHS[mm - 1]}).</p>`;
  }

  // ---------- Evidence: data quality (plain) ----------
  function fileChecks() {
    const rp = state.result.report, items = [];
    items.push([rp.coverage.days >= 365, `${kwh(rp.coverage.months, 1)} months of readings, every ${rp.consumption.intervalSeconds / 60} minutes${rp.coverage.days >= 365 ? '' : '. A full year gives a better answer'}`]);
    items.push([rp.gaps.length === 0 && rp.duplicates.length === 0, rp.gaps.length || rp.duplicates.length ? `Some readings are missing or repeated (${rp.gaps.length} gaps, ${rp.duplicates.length} repeats)` : 'No missing or repeated readings']);
    if (rp.dst.length) items.push([rp.dst.every(d => d.ok), rp.dst.every(d => d.ok) ? 'The daylight-saving days are complete' : 'A daylight-saving day has the wrong number of readings']);
    if (rp.register) items.push([Math.abs(rp.register.diffKwh) / Math.max(1, rp.register.registerKwh) < 0.001, `Your readings add up to your meter’s total, within ${kwh(Math.abs(rp.register.diffKwh), 2)} kWh`]);
    items.push([!rp.consumption.estimated, rp.consumption.estimated ? `${rp.consumption.estimated} readings were estimated by the utility` : 'No readings marked as estimated']);
    if (rp.costEvidence?.matches) items.push([true, 'Your utility’s own cost figures in the file agree with how we sort your readings into price periods']);
    return items;
  }
  function renderQualityPlain(panel) {
    const items = fileChecks(), rp = state.result.report;
    panel.innerHTML = `<h3 class="sec">Can we trust your file?</h3>
      <ul class="checklist">${items.map(([ok, t]) => `<li class="${ok ? 'pass' : 'fail'}">${esc(t)}</li>`).join('')}</ul>
      <p class="muted" style="margin-top:var(--s-4)">Your file covers ${esc(rp.coverage.firstLocal.slice(0, 10))} to ${esc(rp.coverage.lastEndLocal.slice(0, 10))}, with ${kwh(rp.consumption.totalKwh, 0)} kWh in total.</p>
      <p class="small"><a class="linkbtn" href="#how" data-nav="how">See the full technical details in Technical checks</a></p>`;
  }

  // ---------- Evidence: how sure are we? ----------
  function renderSure(panel) {
    const f = state.f, rec = f.recommendation, ch = f.charging;
    const scen = { low: 'Half as much night-time charging', mid: 'Like recent months', high: '30% more charging' };
    const rows = [...PLANS.map(p => [`${PLAN_NAMES[p]} all year${currentPlan() === p ? ' (your plan)' : ''}`, sc => f.strategies[sc].single[p]]), [`Seasonal switching (${f.schedule.runs.map(r => `${PLAN_NAMES[r.plan]} ${MONTHS[+r.from.slice(5, 7) - 1]}–${MONTHS[+r.to.slice(5, 7) - 1]}`).join(', ')})`, sc => f.strategies[sc].schedule]];
    const best = sc => Math.min(...rows.map(r => r[1](sc)));
    const changeVal = state.changeOverride !== undefined ? (state.changeOverride || '') : (state.sug && (state.horizon === 'recent' || state.horizon === 'unsure') ? state.sug.date : '');
    panel.innerHTML = `<h3 class="sec">The same year, three ways</h3>
      ${f.charging && f.detection.treated ? '<p class="muted">The biggest unknown is how much you’ll use at night, mostly for charging a car. So we work out every plan three ways: half as much charging, the same as recently, and 30% more. If the best choice is the same in all three, the answer doesn’t depend on how much you charge.</p>'
        : '<p class="muted">The three ways below only change car charging. No car charging is included in this estimate, so all three give the same totals. They don’t test other changes, such as a hotter summer or using more electricity in general.</p>'}
      <p class="small muted">We compare each plan all year, and the switching schedule worked out for “like recent months”, which is used unchanged in the other two columns. ✓ marks the cheapest in each column. Switching assumes each plan starts at the start of a calendar month; real switches start with a billing period.</p>
      <div class="scroll"><table><thead><tr><th scope="col">Cost after tax and rebate, next 12 months</th>${['low', 'mid', 'high'].map(sc => `<th scope="col" class="n">${scen[sc]}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(([label, v]) => `<tr><th scope="row" style="font-weight:400">${esc(label)}</th>${['low', 'mid', 'high'].map(sc => `<td class="n${Math.abs(v(sc) - best(sc)) < 0.005 ? ' best' : ''}">${money(v(sc))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <h3 class="sec">Try different assumptions</h3>
      <form class="form-grid" id="adj" novalidate>
        <label>My usage changed on<input type="date" name="change" value="${esc(changeVal)}"><span class="small muted">Leave empty to use your whole year equally.</span></label>
        ${f.detection.sessions ? `<label style="display:flex;gap:8px;align-items:flex-start;color:var(--ink);align-self:center"><input type="checkbox" name="charging"${f.detection.treated ? ' checked' : ''} style="width:auto;margin-top:4px"><span>Treat the ${f.detection.sessions} high-power sessions as car charging</span></label>` : '<span></span>'}
        ${ch ? `<label>Car charging, kWh a week in mild weather<input inputmode="decimal" name="perweek" aria-describedby="perweek-err" placeholder="${Math.round(ch.warmKwhPerWeek)} from your file" value="${state.custom ?? ''}"><span class="small muted">Colder months add more automatically.</span><span class="small bad" id="perweek-err" aria-live="polite"></span></label>` : '<span></span>'}
      </form>
      <h3 class="sec">What the estimate is based on</h3>
      <ul class="issues">${f.assumptions.map(a => `<li>${esc(plainDates(a))}</li>`).join('')}${f.notes.map(a => `<li class="warning">${esc(plainDates(a))}</li>`).join('')}</ul>
      <details><summary>Month by month, like recent months</summary><div class="scroll"><table><thead><tr><th scope="col">Month</th><th scope="col" class="n">kWh</th><th scope="col" class="n">Car charging kWh</th>${PLANS.map(p => `<th scope="col" class="n">${PLAN_NAMES[p]}</th>`).join('')}</tr></thead><tbody>
        ${f.scenarios.mid.map(r => { const b = PLANS.reduce((a, c) => (r.billCost[c] < r.billCost[a] ? c : a)); return `<tr><th scope="row" style="font-weight:400">${mLong(r.month)} ${r.month.slice(0, 4)}</th><td class="n">${kwh(r.kwh, 0)}</td><td class="n">${kwh(r.chargingKwh, 0)}</td>${PLANS.map(p => `<td class="n${p === b ? ' best' : ''}">${money(r.cost[p])}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></details>
      ${f.breakEven ? `<details><summary>How much charging makes Ultra-Low Overnight worth it</summary><p class="small muted">Ultra-Low Overnight is cheaper than the other plan in a month when you charge more than the amount shown.</p><div class="scroll"><table><thead><tr><th scope="col">Month</th><th scope="col" class="n">Your expected charging</th><th scope="col" class="n">Beats Time-of-Use above</th><th scope="col" class="n">Beats Tiered above</th></tr></thead><tbody>
        ${f.breakEven.map(b => { const cell = x => (x === null ? 'never' : x === 0 ? 'always' : `${kwh(x, 0)} kWh a week`); return `<tr><th scope="row" style="font-weight:400">${mLong(b.month)}</th><td class="n">${kwh(b.expectedKwhPerWeek, 0)} kWh a week</td><td class="n">${cell(b.uloVsTouKwhPerWeek)}</td><td class="n">${cell(b.uloVsTieredKwhPerWeek)}</td></tr>`; }).join('')}</tbody></table></div></details>` : ''}`;
    const form = panel.querySelector('#adj');
    // Keep the page where it is and focus on the field being edited; only scroll if that field is gone.
    const rerender = () => { const name = document.activeElement?.name, y = window.scrollY; render(); const el = name && document.querySelector(`#adj [name="${name}"]`); if (el) { window.scrollTo(0, y); el.focus({ preventScroll: true }); } else $('#h-why').scrollIntoView(); };
    form.change.addEventListener('change', () => { state.changeOverride = form.change.value || null; if (!form.change.value) state.horizon = 'all'; else if (state.sug) state.horizon = 'recent'; rerender(); });
    form.charging?.addEventListener('change', () => { state.charging = form.charging.checked; rerender(); });
    form.perweek?.addEventListener('change', () => {
      const raw = form.perweek.value, v = num(raw), err = panel.querySelector('#perweek-err');
      if (v === undefined) { state.custom = undefined; rerender(); return; }
      try { E.forecast(state.result.report.intervals, { customKwhPerWeek: v, startMonth: planStart() }); }
      catch (e) { if (e.code !== 'INVALID_INPUT') throw e; form.perweek.setAttribute('aria-invalid', 'true'); err.textContent = Number.isFinite(v) ? e.message : `“${raw}” isn’t a number of kWh.`; return; }
      state.custom = v; rerender();
    });
  }

  // ---------- How we know ----------
  function viewHow(mode = 'how') {
    // The app's own tests run only on the Technical checks screen.
    let results = [], ms = 0;
    if (mode === 'how') { const t0 = performance.now(); try { results = E.runSuite(); } catch (e) { results = [{ status: 'fail', group: 'Suite', name: 'The test suite could not run', message: e.message }]; } ms = performance.now() - t0; }
    const passed = results.filter(r => r.status === 'pass').length, groups = [...new Set(results.map(r => r.group))];
    const src = (id, S) => { const x = S[id]; return x ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>` : esc(id); };
    const c = v => v.toFixed(1);
    const publicWarning = `<div class="banner warn"><p><b>GitHub issues are public.</b> Check the description before you send it, and remove anything that could identify you. Never attach your bill or your usage file, even with your name removed. Never post account numbers, addresses or meter numbers.</p></div>`;
    const codes = state.error?.codes?.length ? state.error.codes : state.result?.support?.codes || [];
    const bugBody = ['### What happened', '', '(Describe what you saw, and what you expected.)', '', '### Steps', '', '1. ', '', '### Details', '', `- App version: ${document.querySelector('.site-foot nav span')?.textContent || ''}`, `- Browser: ${navigator.userAgent.slice(0, 200)}`, `- Check codes: ${codes.join(', ') || 'none'}`, '', '(Please do not attach bills or usage files.)'].join('\n').slice(0, 2000);
    const reportSection = `<section class="card" aria-labelledby="h-report"><h2 id="h-report" style="font-size:var(--t-xl);margin-bottom:var(--s-3)">Report a problem</h2>
      <p>Found a mistake, or a file that won’t open? You can report it on GitHub. This is a hobby project, so we can’t promise a reply or a fix.</p>
      ${publicWarning}
      <details><summary>See exactly what will be sent</summary><pre style="white-space:pre-wrap;font-size:var(--t-sm)">${esc(bugBody)}</pre></details>
      <div class="actions"><a class="btn secondary" target="_blank" rel="noopener" href="${REPO}/issues/new?title=${encodeURIComponent('Problem report')}&body=${encodeURIComponent(bugBody)}">Report a problem on GitHub</a></div></section>`;
    let fileSection = '';
    if (state.result) {
      const { report, support } = state.result, cons = report.consumption, cov = report.coverage;
      const text = E.featureRequestText(support, report);
      fileSection = `<section class="card" aria-labelledby="h-file-tech"><h2 id="h-file-tech" style="font-size:var(--t-xl);margin-bottom:var(--s-4)">Your file, in detail</h2>
        <p>Support level: <b>${state.demo ? 'sample household' : support.level}</b>${support.reasons.length ? ` (${support.reasons.map(esc).join(' ')})` : ''}</p>
        <dl class="facts"><dt>Data from</dt><dd>${esc(support.profile?.host || 'unknown')}</dd><dt>Readings</dt><dd>${cons.intervalSeconds / 60}-minute intervals, watt-hours × 10<sup>${cons.multiplier}</sup></dd>
          <dt>Period</dt><dd>${esc(cov.firstLocal)} to ${esc(cov.lastEndLocal)}, ${kwh(cov.days, 1)} days, ${cov.intervals.toLocaleString('en-CA')} readings, ${kwh(cons.totalKwh, 1)} kWh</dd>
          <dt>Daylight saving</dt><dd>${report.dst.map(d => `${longDate(d.date)}: ${d.actual} of ${d.expected}`).join('; ') || 'none in this period'}</dd>
          <dt>Meter register</dt><dd>${report.register ? `${kwh(report.register.intervalKwh, 3)} kWh from readings vs ${kwh(report.register.registerKwh, 3)} kWh on the register` : 'no register reads'}</dd></dl>
        <h3 class="sec">Checks on the file</h3><ul class="issues">${report.issues.map(i => `<li class="${i.level}">${esc(i.message)}</li>`).join('')}</ul>
        <h3 class="sec">Channels in the file</h3><div class="scroll"><table><thead><tr><th scope="col">Channel</th><th scope="col" class="n">Unit code</th><th scope="col" class="n">Multiplier</th><th scope="col">Direction</th><th scope="col" class="n">Interval</th><th scope="col" class="n">Readings</th><th scope="col" class="n">Non-zero</th></tr></thead><tbody>
        ${report.channels.map(ch => `<tr><th scope="row" style="font-weight:400">${esc(ch.title)}</th><td class="n">${ch.uom}</td><td class="n">10<sup>${ch.multiplier}</sup></td><td>${({ 1: 'Delivered', 4: 'Net', 19: 'Received' })[ch.flow] || ch.flow}</td><td class="n">${ch.intervalLength >= 3600 ? ch.intervalLength / 3600 + ' h' : ch.intervalLength / 60 + ' min'}</td><td class="n">${ch.readings.toLocaleString('en-CA')}</td><td class="n">${ch.nonZero.toLocaleString('en-CA')}</td></tr>`).join('')}</tbody></table></div>
        ${support.level !== 'verified' && !state.demo ? `<h3 class="sec">Report a compatibility issue</h3>
          <p>This copies a short description of your file: the utility’s web address, the reading interval, the units and a list of the checks that failed. It never includes your readings or any text from the file.</p>
          ${publicWarning}
          <details><summary>See exactly what will be sent</summary><pre style="white-space:pre-wrap;font-size:var(--t-sm)">${esc(text)}</pre></details>
          <div class="actions"><button class="btn secondary" type="button" id="fr-copy">Copy the description</button><a class="btn secondary" target="_blank" rel="noopener" href="${REPO}/issues/new?title=${encodeURIComponent('Compatibility issue: Green Button file from ' + (support.profile?.host || 'another utility'))}&body=${encodeURIComponent(text)}">Open a report on GitHub</a></div><p class="small muted" id="fr-msg" aria-live="polite"></p>` : ''}
        </section>`;
    }
    if (mode === 'about') return `<div class="stack">
      <div class="actions" style="margin-top:0">${backButton()}</div>
      ${staleNotice()}
      <section class="card" aria-labelledby="h-about"><h1 id="h-about" style="font-size:var(--t-2xl);margin-bottom:var(--s-3)">How the estimate works</h1>
        <p>Your file is read in this browser tab and never uploaded. Each reading is put in its price period using Ontario time (including daylight saving) and the OEB’s holiday rule, then priced at the OEB’s prices for that period. The 12-month estimate separates car charging from the rest of your use, measures both from your own file, and compares the plans three ways. The utility’s own cost and time-of-use labels in the file are never used for pricing, only as a cross-check.</p>
        <h2 class="sec" style="font-size:var(--t-lg);margin:var(--s-5) 0 var(--s-2)">Known limits</h2>
        <ul><li>The 12-month estimate treats every day as 24 hours, so the two daylight-saving days are approximate. Measured in a worst case (a car charging across the changed hour every night), this moves the yearly gap between plans by about 16 cents.</li>
          <li>The page is designed for computers. On phones and tablets, and at high browser zoom, it rearranges into one column; downloading the usage file is still easiest on a computer.</li></ul>
        <p class="small"><a href="#how" data-nav="how" class="linkbtn">See the technical checks</a> (the app’s own tests and the details of your file).</p></section>
      <section class="card" aria-labelledby="h-src"><h2 id="h-src" style="font-size:var(--t-xl);margin-bottom:var(--s-4)">Prices and sources</h2>
        <div class="scroll"><table class="prices"><thead><tr><th scope="col">From</th><th scope="col" class="n">Time-of-Use off / mid / on</th><th scope="col" class="n">Ultra-Low Overnight overnight / weekend / mid / on</th><th scope="col" class="n">Tiered first block / after</th><th scope="col" class="n">Rebate</th><th scope="col" class="src-col">Source</th></tr></thead><tbody>
        ${[...E.PRICES].reverse().map(p => `<tr><th scope="row" style="font-weight:400">${longDate(p.effective)}</th><td class="n">${c(p.tou.off)} / ${c(p.tou.mid)} / ${c(p.tou.on)}¢</td><td class="n">${p.ulo ? `${c(p.ulo.overnight)} / ${c(p.ulo.off)} / ${c(p.ulo.mid)} / ${c(p.ulo.on)}¢` : '–'}</td><td class="n">${c(p.tiered.t1)} / ${c(p.tiered.t2)}¢</td><td class="n">${p.oer}%</td><td class="src-col">${src(p.source, E.SOURCES)}${p.oerSource !== p.source ? `; rebate: ${src(p.oerSource, E.SOURCES)}` : ''}</td></tr>`).join('')}</tbody></table></div>
        <ul style="margin-top:var(--s-4)"><li>Price periods and holidays: ${src('oeb2026', E.SOURCES)}; ${src('oebHolidays', E.SOURCES)}</li>
          ${E.UTILITIES.map(u => `<li>${esc(u.name)}: loss factor ${u.lossFactor}, regulatory charges from ${src(u.regulatory.source, E.UTILITY_SOURCES)}${u.delivery ? '' : '. Delivery rates aren’t in the tool yet; when you check a bill, they come from the bill.'} Monthly charges are prorated by billing days ÷ (365 ÷ 12), which matched a 2026 bill; leap years aren’t confirmed yet.</li>`).join('')}
          <li>File format: NAESB REQ.21 Energy Services Provider Interface (Green Button) schema, version 4.0 (December 13, 2023).</li></ul>
        <p class="small muted">Open source: <a href="${REPO}" target="_blank" rel="noopener">${REPO.replace('https://', '')}</a></p></section>
      ${reportSection}</div>`;

    return `<div class="stack">
      <div class="actions" style="margin-top:0">${backButton()}</div>
      <section class="card" aria-labelledby="h-how2"><h1 id="h-how2" style="font-size:var(--t-2xl);margin-bottom:var(--s-3)">Technical checks</h1>
        <p>This tool checks itself every time you open this page. These tests have answers worked out by hand: made-up meter files across both daylight-saving changes, a full year with nightly car charging, and the Ontario Energy Board’s published holiday schedule.</p>
        <p class="${passed === results.length ? 'ok' : 'bad'}" style="font:600 var(--t-xl) var(--display)">${passed} of ${results.length} checks passed <span class="small muted" style="font-family:var(--body);font-weight:400">(run on this computer in ${ms.toFixed(0)} ms)</span></p>
        ${groups.map(g => `<h2 class="sec" style="font-size:var(--t-lg);margin:var(--s-6) 0 var(--s-3)">${esc(g)}</h2><ul class="checklist">${results.filter(r => r.group === g).map(r => `<li class="${r.status}">${esc(r.name)}${r.message ? `<span class="why">${esc(r.message)}</span>` : ''}</li>`).join('')}</ul>`).join('')}
      </section>
      ${fileSection}</div>`;
  }
  function wireHow() {
    const b = $('#fr-copy'); if (!b) return;
    const text = E.featureRequestText(state.result.support, state.result.report);
    b.addEventListener('click', async () => { const m = $('#fr-msg'); try { await navigator.clipboard.writeText(text); m.textContent = 'Copied.'; } catch { m.textContent = 'Your browser blocked copying. Here is the text:'; m.insertAdjacentHTML('afterend', `<pre>${esc(text)}</pre>`); } });
  }

  // ---------- Disclaimer ----------
  function viewDisclaimer() {
    const d = longDate(E.latestPrices().effective);
    return `<div class="stack"><div class="actions" style="margin-top:0">${backButton()}</div><article class="card prose" aria-labelledby="h-disc" style="max-width:860px">
      <h1 id="h-disc" style="font-size:var(--t-2xl);margin-bottom:var(--s-4)">Disclaimer</h1>
      <h2>What this tool is</h2><p>A free, independent hobby project, made out of curiosity and for learning. It estimates what you would pay for electricity under each Ontario price plan (Time-of-Use, Ultra-Low Overnight and Tiered), using the usage file from your utility. It is not made by, endorsed by or connected to the Ontario Energy Board, the Government of Ontario, or any electricity utility.</p>
      <h2>Estimates, not advice</h2><p>All results are estimates, not financial, legal or professional advice. We don’t promise they’re accurate, complete or up to date, or that you’ll save money. They assume your next year will be like your past year, at the OEB’s prices for each month. For months whose prices haven’t been announced yet, they assume prices stay the same as the latest ones (from ${d}). Prices normally change every November 1.</p>
      <p>The plan comparisons cover the electricity part of your bill. The savings shown also add HST and take off the Ontario Electricity Rebate on the difference between plans. Delivery and regulatory charges are the same on every plan, so they’re left out, except when you check a bill. Your bill from your utility is always the official amount. Before you switch plans, ask your utility whether you can, and when the switch would start.</p>
      <h2>What can make results wrong</h2><p>Mistakes in the tool, missing or estimated readings in your file, a mistaken guess about car charging, billing periods that don’t line up with calendar months, rules specific to your utility, and changes in your usage or in prices.</p>
      <h2>Who it’s for</h2><p>Homes that buy electricity directly from their local utility on one of the OEB’s price plans. It doesn’t work for:</p>
      <ul><li>homes on a contract with an energy retailer</li><li>condos or buildings where a sub-metering company runs the meter</li><li>homes with solar panels or other equipment that sends power back to the grid</li><li>businesses, which have different Tiered limits</li></ul>
      <h2>Your data</h2><p>Your file is read on your own computer, in this browser tab. The tool doesn’t upload it or save it. Your readings stay in the page’s memory while you use it, and are cleared when you close or reload the page. Your original file stays wherever you saved it. The website host may keep standard visit logs, as any website does. Links to utility, OEB and GitHub pages open those websites, which have their own privacy rules.</p>
      <h2>Support and updates</h2><p>This is a hobby project run by volunteers. We don’t promise support, replies to reports, bug fixes, price updates, or that the tool will stay available. We may change or stop it at any time.</p>
      <h2>No warranty</h2><p>This tool is provided “as is”, without warranty of any kind, to the extent the law allows. To the extent the law allows, the authors are not responsible for decisions you make or costs you incur based on its results. The source code is open under the MIT License.</p>
    </article></div>`;
  }

  render();
})();
