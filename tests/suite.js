// The self-contained test suite: no files, no network. Runs in Node (tests/run.mjs) and in the
// browser (the app's Checks tab), so anyone can see the engine pass its hand-derived tests.
import { analyze } from '../src/analyze.js';
import { featureRequestText } from '../src/support.js';
import { forecast, detectSessions, switchSteps } from '../src/forecast.js';
import { fullBill, billFactor } from '../src/bill.js';
import { reconcileBill } from '../src/reconcile.js';
import { pricesFreshness } from '../src/tariff.js';
import { costAt } from '../src/pricing.js';
import { holidayPricingDays } from '../src/holidays.js';
import { localParts, localMidnight } from '../src/time.js';
import { PRICES, SOURCES, PUBLISHED_HOLIDAYS } from '../tariffs/rpp.js';
import { syntheticFiles, syntheticYear, demoHouseholdFile, feed, constant, xmlVariants, alectraShapeFile } from './synthetic.js';

export function runSuite() {
  const results = [];
  const test = (group, name, fn) => { try { fn(); results.push({ status: 'pass', group, name }); } catch (e) { results.push({ status: 'fail', group, name, message: e.message }); } };
  const eq = (a, b, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  const near = (a, b, tol, msg = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} expected ${b} ±${tol}, got ${a}`); };
  const ok = (c, msg) => { if (!c) throw new Error(msg); };
  const files = syntheticFiles();
  const cache = {};
  const A = name => (cache[name] ||= analyze(files[name]));
  const month = (a, key) => a.history.find(m => m.month === key);

  // ---- Prices and holidays ----
  test('Prices and holidays', 'Price entries are in date order and every entry cites a source', () => {
    for (let i = 1; i < PRICES.length; i++) ok(PRICES[i].effective > PRICES[i - 1].effective, 'order');
    for (const p of PRICES) { ok(SOURCES[p.source], 'price source ' + p.effective); ok(SOURCES[p.oerSource], 'rebate source ' + p.effective); }
  });
  test('Prices and holidays', 'Nov 1 2025 ULO prices equal those printed on a reconciled Alectra bill (3.9 / 9.8 / 15.7 / 39.1¢)', () => {
    eq(PRICES.find(p => p.effective === '2025-11-01').ulo, { overnight: 3.9, off: 9.8, mid: 15.7, on: 39.1 });
  });
  test('Prices and holidays', 'Holiday rule reproduces the OEB’s published 2026 schedule, including Boxing Day moved to Mon Dec 28', () => {
    eq([...holidayPricingDays(2026).keys()].sort(), PUBLISHED_HOLIDAYS[2026]);
  });
  test('Prices and holidays', '2025 holidays match the days a utility coded as off-peak', () => {
    eq([...holidayPricingDays(2025).keys()].sort(), ['2025-01-01', '2025-02-17', '2025-04-18', '2025-05-19', '2025-07-01', '2025-08-04', '2025-09-01', '2025-10-13', '2025-12-25', '2025-12-26']);
  });
  test('Prices and holidays', 'Weekend holidays move to the next free weekday (2027 Christmas → Mon 27, Boxing Day → Tue 28; Canada Day 2023 → Mon Jul 3)', () => {
    const d27 = holidayPricingDays(2027); ok(d27.get('2027-12-27') === 'Christmas Day' && d27.get('2027-12-28') === 'Boxing Day', '2027');
    ok(holidayPricingDays(2023).get('2023-07-03') === 'Canada Day', '2023');
  });

  // ---- Time ----
  test('Ontario time', 'Daylight-saving days have 25 and 23 hours', () => {
    eq((localMidnight('2025-11-03') - localMidnight('2025-11-02')) / 3600, 25);
    eq((localMidnight('2026-03-09') - localMidnight('2026-03-08')) / 3600, 23);
  });
  test('Ontario time', 'The repeated 1 a.m. hour on Nov 2 2025 is hour 1 twice', () => {
    const t = localMidnight('2025-11-02'); eq([1, 2, 3].map(h => localParts(t + h * 3600).hour), [1, 1, 2]);
  });

  // ---- Reading files ----
  test('Reading files', '15-minute file across the fall DST change: 145 kWh, 100 readings on Nov 2, every period total exact', () => {
    const a = A('synth-15min-dst-fall.xml');
    eq(a.report.coverage.intervals, 6 * 96 + 4); near(a.report.consumption.totalKwh, 145, 1e-9, 'total');
    eq(a.report.dst.find(d => d.date === '2025-11-02'), { date: '2025-11-02', hours: 25, expected: 100, actual: 100, ok: true });
    const sum = k => ['on', 'mid', 'off', 'overnight'].reduce((o, p) => ({ ...o, [p]: (month(a, '2025-10')?.[k]?.[p] || 0) + (month(a, '2025-11')?.[k]?.[p] || 0) }), {});
    const t = sum('tou'), u = sum('ulo');
    near(t.on, 24, 1e-9, 'TOU on'); near(t.mid, 24, 1e-9, 'TOU mid'); near(t.off, 97, 1e-9, 'TOU off');
    near(u.overnight, 49, 1e-9, 'ULO overnight'); near(u.off, 32, 1e-9, 'ULO weekend off'); near(u.on, 20, 1e-9, 'ULO on'); near(u.mid, 44, 1e-9, 'ULO mid');
  });
  test('Reading files', 'Hourly file in Wh×10⁰ across the spring DST change: 95 kWh, every period total exact', () => {
    const a = A('synth-hourly-dst-spring.xml'); near(a.report.consumption.totalKwh, 95, 1e-9);
    const m = month(a, '2026-03');
    near(m.tou.on, 12, 1e-9); near(m.tou.mid, 12, 1e-9); near(m.tou.off, 71, 1e-9);
    near(m.ulo.overnight, 31, 1e-9); near(m.ulo.off, 32, 1e-9); near(m.ulo.on, 10, 1e-9); near(m.ulo.mid, 22, 1e-9);
    eq(a.report.dst[0], { date: '2026-03-08', hours: 23, expected: 23, actual: 23, ok: true });
  });
  test('Reading files', 'A file from a utility not yet checked against a bill is marked Unverified, with the reason', () => {
    const a = A('synth-hourly-dst-spring.xml'); eq(a.support.level, 'unverified'); ok(a.support.reasons[0].includes('example-utility.test'), a.support.reasons[0]);
  });
  test('Reading files', 'A missing hour and a duplicated hour are both detected', () => {
    const a = A('synth-hourly-gap-dup.xml'); eq(a.report.gaps.length, 1); eq(a.report.duplicates.length, 1); eq(a.support.level, 'unverified');
  });
  test('Reading files', 'A natural-gas file is Not supported', () => eq(A('synth-gas.xml').support.level, 'unsupported'));
  test('Reading files', 'A file that isn’t Green Button is Not supported, with a readable reason', () => {
    const a = A('synth-not-espi.xml'); eq(a.support.level, 'unsupported'); ok(/Atom feed/.test(a.support.reasons[0]), a.support.reasons[0]);
  });
  test('Reading files', 'The feature-request text describes the file but contains no usage values', () => {
    const a = A('synth-hourly-gap-dup.xml'); const t = featureRequestText(a.support, a.report);
    ok(t.includes('example-utility.test') && t.includes('60 min'), 'profile'); ok(!t.includes(String(a.report.consumption.totalKwh)), 'leaked total');
    ok(!/Energy|Meter reading|Usage point/.test(t), 'text copied from the file (channel or entry titles)');
  });

  // ---- Validation before calculating ----
  const code = name => (A(name).report.issues.find(i => i.level === 'error') || {}).code;
  test('Validation', 'An identical repeated reading is counted once (95 kWh, not 96)', () => {
    const a = A('val-identical-duplicate.xml'); near(a.report.consumption.totalKwh, 95, 1e-9); eq(a.report.duplicates.length, 1); eq(a.support.level, 'unverified');
  });
  for (const [file, c, what] of [
    ['val-conflicting-duplicate.xml', 'conflicting-duplicates', 'The same time listed twice with different readings'],
    ['val-overlap.xml', 'overlaps', 'Overlapping readings'],
    ['val-bad-value.xml', 'invalid-readings', 'A reading that isn’t a number'],
    ['val-zero-duration.xml', 'invalid-readings', 'A reading with zero length'],
    ['val-daily-in-hourly.xml', 'invalid-readings', 'Daily readings in a file that says it has 15-minute readings'],
    ['val-generation.xml', 'generation', 'Power sent back to the grid (net metering)'],
    ['val-two-meters.xml', 'multiple-meters', 'Readings from two meters'],
    ['val-two-channels.xml', 'ambiguous-channels', 'Two possible sets of usage readings for one meter'],
    ['val-unaligned.xml', 'unaligned', 'Readings that don’t start on the clock (6:30 to 7:30)'],
    ['val-odd-length.xml', 'unsupported-length', '20-minute readings'],
  ]) test('Validation', `${what}: the file is not used, with a plain reason`, () => {
    const a = A(file); eq(code(file), c); eq(a.support.level, 'unsupported'); eq(a.history.length, 0); ok(!/NaN/.test(a.support.reasons[0]), 'NaN in message');
  });

  // ---- XML reader ----
  const XV = xmlVariants(), baseTotal = A('synth-hourly-dst-spring.xml').report.consumption.totalKwh;
  for (const [what, xml] of Object.entries(XV.same)) test('XML reader', `${what}: read exactly like the plain file`, () => {
    const a = analyze(xml); eq(a.support.level === 'unsupported', false, 'support'); near(a.report.consumption.totalKwh, baseTotal, 1e-9, 'total');
  });
  for (const [what, xml] of Object.entries(XV.refuse)) test('XML reader', `${what}: refused with a reason`, () => {
    const a = analyze(xml); eq(a.support.level, 'unsupported'); ok(a.support.reasons[0] && !/undefined|NaN/.test(a.support.reasons[0]), a.support.reasons[0]);
  });

  // ---- Forecast ----
  const year = syntheticYear();
  test('Forecast', 'Charging detection finds one 10 kWh session per night, all starting at 23:00, and marks sessions cut off by the file’s edges', () => {
    const d = detectSessions(year), whole = d.sessions.filter(s => !s.clipped);
    eq([whole.length, d.sessions.length], [365, 366]);   // 365 whole sessions, plus one cut off by the start of the file
    ok(d.sessions[0].clipped && d.sessions[0].hour === 0, 'the session the file starts in is marked clipped');
    ok(whole.every(s => s.hour === 23 && s.minute === 0), 'start time'); ok(whole.every(s => Math.abs(s.kwh - 10) < 1e-9), 'energy');
  });
  const NOV2026 = PRICES.find(p => p.effective === '2026-11-01');
  test('Forecast', 'Hourly data: the charging baseline looks back 2 hours, not 8 readings (which would reach the dinner-time peak)', () => {
    // Household 0.5 kW, dinner-time peak 3 kW from 4 to 9 p.m.; the car adds exactly 7 kW from 11 p.m. to 2 a.m. = 21 kWh.
    const iv = [];
    for (let t = localMidnight('2026-03-02'), end = localMidnight('2026-03-30'); t < end; t += 3600) {
      const h = localParts(t).hour; let kw = h >= 16 && h < 21 ? 3 : 0.5;
      if (h === 23 || h < 2) kw += 7;
      iv.push({ start: t, dur: 3600, kwh: kw, quality: [] });
    }
    const d = detectSessions(iv);
    ok(d.sessions.length >= 27, 'sessions found: ' + d.sessions.length);
    for (const s of d.sessions.filter(x => !x.clipped)) near(s.kwh, 21, 1e-9, 'session energy');
    ok(d.sessions[0].clipped && d.sessions[d.sessions.length - 1].clipped, 'sessions cut off by the start and end of the file are marked clipped');
  });
  const f = forecast(year, { startMonth: '2026-01', prices: NOV2026 });   // hand calculation below uses the Nov 2026 prices
  test('Forecast', 'January 2026: kWh by period, cost difference and ULO break-even all match hand calculation', () => {
    const jan = f.scenarios.mid[0];
    near(jan.kwh, 31 * 34, 1e-6, 'total'); near(jan.chargingKwh, 310, 1e-6, 'charging');
    near(jan.ulo.overnight, 31 * 8 + 310, 1e-6, 'ULO overnight'); near(jan.tou.on, 21 * 6, 1e-6, 'TOU on'); near(jan.ulo.off, 10 * 16, 1e-6, 'ULO weekend off');
    near(f.breakEven[0].uloVsTouKwhPerWeek, (97.047 - 86.982) / 0.054 / 31 * 7, 1e-3, 'break-even');
    near(jan.cost.ulo - jan.cost.tou, 97.047 - 86.982 - 310 * 0.054, 1e-6, 'ULO − TOU');
  });
  test('Forecast', 'A file too short to estimate from gives a clear message instead of failing', () => {
    let err = null; try { forecast(A('synth-15min-dst-fall.xml').report.intervals, {}); } catch (e) { err = e; }
    ok(err && err.code === 'NOT_ENOUGH_DATA' && /at least 7 full days/.test(err.message), err ? err.message : 'no error');
  });
  test('Forecast', 'Each month is priced at the prices in effect that month (October 2026 uses the November 2025 prices)', () => {
    const ff = forecast(year, { startMonth: '2026-10' }), oct = ff.scenarios.mid[0], nov = ff.scenarios.mid[1];
    eq([oct.month, oct.priceEffective, nov.priceEffective], ['2026-10', '2025-11-01', '2026-11-01']);
    const expect = costAt(oct, PRICES.find(p => p.effective === '2025-11-01'));
    for (const k of ['tou', 'ulo', 'tiered']) near(oct.cost[k], expect[k], 1e-9, k);
  });
  test('Forecast', 'Months after the next expected price change use the latest prices and are marked as assumed', () => {
    const ff = forecast(year, { startMonth: '2026-12' }), last = ff.scenarios.mid[11];
    eq([last.month, last.priceEffective, last.priceAssumed], ['2027-11', '2026-11-01', true]);
    ok(ff.assumptions.some(a => /aren’t known yet/.test(a)), 'disclosed');
  });
  test('Forecast', 'Scenarios: less charging halves it (no winter increase), more charging adds 30%', () => { near(f.scenarios.low[0].chargingKwh, 155, 1e-6); near(f.scenarios.high[0].chargingKwh, 403, 1e-6); });
  test('Forecast', 'A switching schedule is recommended only if it saves at least $20 a year', () => {
    const s = f.strategies.mid, best = Math.min(...Object.values(s.single));
    ok(f.recommendation.kind === 'single' ? best - s.schedule < 20 : best - s.schedule >= 20, 'threshold');
  });

  test('Forecast', 'Confidence counts a scenario only if the recommendation is still strictly the cheapest option there', () => {
    for (const ff of [f, forecast(analyze(demoHouseholdFile()).report.intervals, {})]) {
      const r = ff.recommendation, cost = sc => (r.kind === 'single' ? ff.strategies[sc].single[r.plan] : ff.strategies[sc].schedule);
      const best = sc => Math.min(...Object.values(ff.strategies[sc].single), ff.strategies[sc].schedule);
      for (const sc of ['low', 'high']) ok(r.holdsIn.includes(sc) === (cost(sc) <= best(sc) + 0.005), sc);
    }
  });
  test('Forecast', 'Only complete days are used: a day missing one reading is left out', () => {
    const iv = syntheticYear().filter(x => localParts(x.start).date !== '2025-06-10' || localParts(x.start).hour !== 12);
    const ff = forecast(iv, { startMonth: '2026-06' });
    near(ff.scenarios.mid[0].kwh, forecast(syntheticYear(), { startMonth: '2026-06' }).scenarios.mid[0].kwh, 1e-6, 'same June estimate');
  });
  test('Reading files', 'A month is complete only if readings cover all of its time, not just every date', () => {
    const r = constant('2026-03-01', '2026-04-01', 3600, 1000).filter(([t]) => localParts(t).hour === 12);   // one reading a day
    const a = analyze(feed({ channels: [{ step: 3600, mult: 0, readings: r }] }));
    const m = a.history.find(h => h.month === '2026-03');
    ok(m && m.days === 31 && !m.complete, `days ${m && m.days}, complete ${m && m.complete}`);
  });

  // ---- Milestone 3 (code review, October 2026) ----
  test('Milestone 3', 'Each forecast month carries its own tax-and-rebate factor, and decisions use the cost after tax and rebate', () => {
    const ff = forecast(year, { startMonth: '2026-10' }), oct = ff.scenarios.mid[0], nov = ff.scenarios.mid[1];
    near(oct.factor, 1.13 - 0.235, 1e-12, 'October uses the Nov 2025 rebate'); near(nov.factor, 1.13 - 0.157, 1e-12, 'November uses the Nov 2026 rebate');
    for (const p of ['tou', 'ulo', 'tiered']) near(ff.strategies.mid.single[p], ff.scenarios.mid.reduce((s, r) => s + r.cost[p] * r.factor, 0), 1e-6, p);
    near(ff.strategies.mid.schedule, ff.scenarios.mid.reduce((s, r, i) => s + r.billCost[ff.schedule.plan[i]], 0), 1e-6, 'schedule');
  });
  test('Milestone 3', 'Switching steps come from the month-by-month plan, including the first switch when the current plan differs', () => {
    const months = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10'];
    const plans = ['tou', 'tou', 'ulo', 'ulo', 'ulo', 'ulo', 'tou', 'tou', 'tou', 'tou', 'tou', 'tou'];
    eq(switchSteps(months, plans, 'ulo', '2026-10').map(s => [s.plan, s.from, s.first]), [['tou', '2026-11', true], ['ulo', '2027-01', false], ['tou', '2027-05', false]]);
    eq(switchSteps(months, plans, 'tou', '2026-10').map(s => s.from), ['2027-01', '2027-05']);
    ok(switchSteps(months, plans, null, '2026-10')[0].ifNotAlready, 'unknown current plan: first step says "if you’re not already on it"');
  });
  for (const [what, opts] of [['negative charging', { customKwhPerWeek: -5 }], ['infinite charging', { customKwhPerWeek: Infinity }], ['1e309 charging', { customKwhPerWeek: Number('1e309') }], ['an impossible change date', { changeDate: '2026-02-30' }]])
    test('Milestone 3', `The forecast refuses ${what} with a clear error`, () => { let e = null; try { forecast(year, opts); } catch (x) { e = x; } ok(e && e.code === 'INVALID_INPUT', e ? e.message : 'accepted'); });
  test('Milestone 3', 'The whole-bill calculation refuses invalid inputs and dates with no rebate figures', () => {
    const base = { utilityId: 'alectra-powerstream', days: 30, kwh: 500, electricity: 60, deliveryFromBill: 40 };
    for (const bad of [{ days: -1 }, { electricity: NaN }, { kwh: Infinity }, { oerPercent: 150 }]) { let e = null; try { fullBill({ ...base, ...bad }); } catch (x) { e = x; } ok(e && e.code === 'INVALID_INPUT', JSON.stringify(bad)); }
    let e = null; try { fullBill({ ...base, billDate: '2021-06-01' }); } catch (x) { e = x; } ok(e && e.code === 'UNSUPPORTED_DATE', e ? e.message : 'accepted');
  });
  test('Milestone 3', 'A ULO bill from before May 2023 is refused as "plan not available", not a crash', () => {
    const iv = constant('2023-03-01', '2023-03-11', 3600, 1).map(([t, d, v]) => ({ start: t, dur: d, kwh: v, quality: [] }));
    let e = null; try { reconcileBill(iv, { plan: 'ulo', from: '2023-03-01', to: '2023-03-09', kwh: { on: 1, mid: 1, off: 1, overnight: 1 } }); } catch (x) { e = x; }
    ok(e && e.code === 'PLAN_NOT_AVAILABLE', e ? e.message : 'no error');
  });
  test('Milestone 3', '"Verified" needs the exact host: alectradc.savagedata.com.attacker.example is not Alectra', () => {
    eq(analyze(alectraShapeFile()).support.level, 'verified');
    const spoof = analyze(alectraShapeFile().replaceAll('alectradc.savagedata.com', 'alectradc.savagedata.com.attacker.example'));
    eq([spoof.support.level, spoof.support.profile.host], ['unverified', 'alectradc.savagedata.com.attacker.example']);
  });
  test('Milestone 3', 'Months the file only partly covers get no Tiered figure', () => {
    const a = A('synth-15min-dst-fall.xml');
    ok(a.history.every(m => !m.complete && m.atCurrent.tiered === null && (!m.atThen || m.atThen.tiered === null)), 'partial months priced as Tiered');
  });
  test('Milestone 3', 'A charging run right after a gap in the data is still found (and marked clipped)', () => {
    const iv = [], t0 = localMidnight('2026-03-02');
    const add = (h, kw) => iv.push({ start: t0 + h * 3600, dur: 3600, kwh: kw, quality: [] });
    for (let h = 0; h < 22; h++) add(h, 0.5); add(22, 7.5); add(23, 7.5);       // a run that ends at a gap…
    for (let h = 26; h < 50; h++) add(h, h < 28 ? 7.5 : 0.5);                   // …and another right after it
    const d = detectSessions(iv);
    eq(d.sessions.map(s => s.hour), [22, 2]); ok(d.sessions[1].clipped, 'clipped');
  });
  test('Milestone 3', 'Support results carry check codes for reports, never file text', () => {
    eq(A('val-conflicting-duplicate.xml').support.codes.includes('conflicting-duplicates'), true);
    eq(analyze('<feed xmlns="http://www.w3.org/2005/Atom"><entry><bad></entry></feed>').support.codes, ['parse']);
  });

  test('Prices', 'Prices are flagged as possibly out of date once a year and a week have passed since the latest prices started', () => {
    const F = pricesFreshness;
    const P = [{ effective: '2026-11-01' }];
    eq([F('2026-11-02', P).stale, F('2027-11-01', P).stale, F('2027-11-08', P).stale, F('2027-11-09', P).stale], [false, false, false, true]);
    eq(F('2027-11-09', P).expectedBy, '2027-11-08');
  });

  // ---- Whole bill ----
  test('Whole bill', 'Regulatory = 0.53¢ per loss-adjusted kWh + $0.25 a month prorated; HST and rebate rounded down', () => {
    const b = fullBill({ utilityId: 'alectra-powerstream', days: 365 / 12, kwh: 1000, electricity: 100, deliveryFromBill: 50, oerPercent: 15.7 });
    eq(b.lines.find(l => l.key === 'regulatory').amount, 5.75); eq(b.subtotal, 155.75); eq(b.hst, 20.24); eq(b.oer, 24.45); eq(b.total, 151.54);
  });
  test('Whole bill', 'Without delivery rates or a bill amount, no total is invented', () => {
    eq(fullBill({ utilityId: 'alectra-powerstream', days: 30, kwh: 500, electricity: 60 }).total, null);
  });
  test('Whole bill', 'A difference on the electricity line carries through to the amount due at 1 + 13% − rebate', () => near(billFactor(15.7), 0.973, 1e-12));
  return results;
}
