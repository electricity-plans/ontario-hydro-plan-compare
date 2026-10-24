// Test suite. Run: node tests/run.mjs
// Optional private test against your own (never committed) files:
//   REAL_FILE=private/real.xml REAL_BILL=private/real-bill.json REAL_EXPECTED=private/expected-real.json node tests/run.mjs
import { readFileSync, existsSync } from 'node:fs';
import { analyze, reconcileBill, matchRegisterReads, forecast, fullBill } from '../src/index.js';
import { runSuite } from './suite.js';
import { syntheticFiles } from './synthetic.js';
import { dstMeasurement } from './dst-measurement.mjs';
import { localParts, localMidnight } from '../src/time.js';
import { touPeriod } from '../src/tariff.js';
import { bundleEngine, buildHtml } from '../tools/build.mjs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const results = [];
function test(name, fn) { try { fn(); pass++; results.push(['PASS', name]); } catch (e) { fail++; results.push(['FAIL', name, e.message]); } }
const eq = (a, b, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const near = (a, b, tol, msg = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} expected ${b} ±${tol}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const FILES = syntheticFiles();                       // made-up test files, created in memory (nothing stored)
const fx = name => { if (!(name in FILES)) throw new Error('No such test file: ' + name); return FILES[name]; };
const month = (a, key) => a.history.find(m => m.month === key);

// ---- The shared suite (also runs in the app's Checks tab) ----
for (const r of runSuite()) { if (r.status === 'pass') pass++; else fail++; results.push([r.status === 'pass' ? 'PASS' : 'FAIL', `${r.group}: ${r.name}`, r.message]); }

// ---- Alectra-shaped file (synthetic) vs the independent Python reference ----
test('Alectra-shaped file: verified profile, DST day, register check, and every period total equal to the Python reference', () => {
  const a = analyze(fx('synth-alectra-shape.xml'));
  const ref = JSON.parse(readFileSync(new URL('./expected/synth-alectra-shape.json', import.meta.url), 'utf8'));
  eq(a.support.level, 'verified');
  eq(a.report.coverage.intervals, ref.intervals); near(a.report.consumption.totalKwh, ref.totalKwh, 0.001, 'total (report shows 3 decimals)');
  eq(a.report.dst.find(d => d.date === '2025-11-02').actual, 100);
  ok(a.report.register && Math.abs(a.report.register.diffKwh) < 1e-6, 'register agrees with readings');
  for (const [k, r] of Object.entries(ref.months)) {
    const m = month(a, k);
    for (const p of Object.keys(r.tou)) near(m.tou[p], r.tou[p], 1e-6, `${k} TOU ${p}`);
    for (const p of Object.keys(r.ulo)) near(m.ulo[p], r.ulo[p], 1e-6, `${k} ULO ${p}`);
  }
});

// ---- DST approximation (forecast uses 24-hour days) ----
test('DST: the forecast\'s 24-hour days differ from real clock hours by under 0.1% of energy and under $1 between plans (worst case)', () => {
  const r = dstMeasurement();
  ok(Math.abs(r.kwh.model - r.kwh.actual) / r.kwh.actual < 0.001, `energy ${r.kwh.model} vs ${r.kwh.actual}`);
  ok(Math.abs(r.gap.model - r.gap.actual) < 1, `TOU-ULO gap ${r.gap.model} vs ${r.gap.actual}`);
});

// ---- Build ----
test('built page: bundled engine gives the same results as the source modules, the whole suite passes inside the bundle, the worker and page code are valid JavaScript, and the page loads nothing external', () => {
  const html = buildHtml();
  ok(!/<script[^>]+src=|<link[^>]+href=["']https?:|https?:\/\/[^"'\s]+\.(js|css)\b/i.test(html), 'external resource');
  const ctx = { URL }; vm.createContext(ctx); vm.runInContext(bundleEngine(), ctx);   // browsers and workers have URL
  const xml = fx('synth-15min-dst-fall.xml');
  eq(JSON.parse(JSON.stringify(ctx.Engine.analyze(xml).history)), JSON.parse(JSON.stringify(analyze(xml).history)));
  new vm.Script(readFileSync(new URL('../app/worker.js', import.meta.url), 'utf8'), { filename: 'app/worker.js' });   // throws on a syntax error
  new vm.Script(readFileSync(new URL('../app/ui.js', import.meta.url), 'utf8'), { filename: 'app/ui.js' });           // the page code too
  const inBundle = ctx.Engine.runSuite();
  ok(inBundle.every(r => r.status === 'pass'), 'suite inside the bundle: ' + inBundle.filter(r => r.status !== 'pass').map(r => r.name + ': ' + r.message).join('; '));
});
// ---- Private: your own full export and bill (skipped unless files are provided) ----
// Private tests: your own export, bill and expected figures. All three files live in private/, which git ignores,
// so none of your figures are in the repository. Expected values come from private/private-expected.json.
const RF = process.env.REAL_FILE, RB = process.env.REAL_BILL, RE = process.env.REAL_EXPECTED;
const RX = process.env.REAL_FIGURES || 'private/private-expected.json';
if (RF && existsSync(RF) && existsSync(RX)) {
  const a = analyze(readFileSync(RF, 'utf8'));
  const X = JSON.parse(readFileSync(RX, 'utf8'));
  test('[private] full export: reading count, total, DST days and no gaps as recorded', () => {
    eq(a.report.coverage.intervals, X.intervals); near(a.report.consumption.totalKwh, X.totalKwh, 1e-6);
    eq(a.report.dst.map(d => d.actual), X.dstActual); eq(a.report.gaps.length, 0); eq(a.report.duplicates.length, 0);
  });
  test('[private] interval total agrees with the meter register as recorded', () => near(a.report.register.diffKwh, X.registerDiffKwh, 0.001));
  test('[private] zero mismatches against the TOU codes in the file', () => {
    const code = { 1: 'on', 2: 'mid', 3: 'off' }; let mis = 0;
    for (const x of a.report.intervals) if (code[x.tou] !== touPeriod(localParts(x.start))) mis++;
    eq(mis, 0);
  });
  test('[private] cost field detected with the recorded plan and scale', () => { eq([a.report.costEvidence.plan, a.report.costEvidence.exponent], [X.costFieldPlan, X.costFieldExponent]); });
  test('[private] monthly TOU cost at historical prices within $1 of the file\'s own cost field', () => {
    const byMonth = {};
    for (const x of a.report.intervals) { const k = localParts(x.start).date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + x.cost / 1000; }
    for (const m of a.history) near(m.atThen.tou, byMonth[m.month], 1.0, m.month);
  });
  test('[private] forecast: charging pattern, household change and recommendation as recorded', () => {
    const f = forecast(a.report.intervals, { changeDate: X.forecast.changeDate });
    ok(f.detection.startPattern.time === X.forecast.startTime && f.detection.startPattern.share > 0.9, 'start pattern');
    near(f.charging.warmKwhPerWeek, X.forecast.warmKwhPerWeek, 3, 'kWh per week');
    near(f.householdDelta.perDay, X.forecast.householdPerDay, 0.3, 'household change');
    eq(f.recommendation.kind, 'schedule');
    eq(f.schedule.runs.map(r => r.plan), X.forecast.schedulePlans);
  });
  if (RE && existsSync(RE)) test('[private] every month equals the Python reference', () => {
    const ref = JSON.parse(readFileSync(RE, 'utf8'));
    for (const [k, r] of Object.entries(ref.months)) { const m = month(a, k); for (const p of Object.keys(r.ulo)) near(m.ulo[p], r.ulo[p], 1e-6, `${k} ${p}`); for (const p of Object.keys(r.tou)) near(m.tou[p], r.tou[p], 1e-6, `${k} ${p}`); }
  });
  if (RB && existsSync(RB)) {
    const bill = JSON.parse(readFileSync(RB, 'utf8')), B = X.bill;
    test('[private] bill meter readings match register reads; window is the day after "From" to the day after "To"', () => {
      const r = matchRegisterReads(a.register, bill.prevReading, bill.currReading);
      eq([r.prev.local, r.curr.local], B.registerDates);
    });
    test('[private] whole bill: adjusted kWh, regulatory, subtotal, HST, rebate and amount due match the bill', () => {
      const b = fullBill({ utilityId: 'alectra-powerstream', days: B.days, kwh: bill.totalKwh, electricity: B.electricity, deliveryFromBill: B.delivery, billDate: B.billDate });
      near(b.adjustedKwh, B.adjustedKwh, 0.0005);
      eq([b.lines[2].amount, b.subtotal, b.hst, b.oer, b.total], [B.regulatory, B.subtotal, B.hst, B.oer, B.total]);
    });
    test('[private] bill reconciliation: on/mid/off exact; overnight exact with the remainder rule; dollars to the cent', () => {
      const r = reconcileBill(a.report.intervals, bill, { remainderPeriod: 'overnight' });
      for (const row of r.rows) { near(row.modelKwh, row.billKwh, 0.0005, row.period); eq(row.modelDollars, row.billDollars, row.period + ' $'); }
      for (const row of r.rows.filter(x => x.period !== 'overnight')) near(row.intervalKwh, row.billKwh, 0.0005, row.period + ' raw');
    });
  }
} else results.push(['SKIP', 'private tests (set REAL_FILE, and keep private/private-expected.json, to run them against your own export)']);

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? '\n      ' + r[2] : '');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
