// 12-month forecast and plan decision.
// Method (all estimated from the user's own data; every assumption is returned with the result):
//  1. Detect EV-style charging sessions: sustained high-power runs, by a threshold derived from the data.
//  2. Split the load into "charging" and "household" (everything else).
//  3. Household: for each calendar month, an average day (by weekday / weekend-holiday, hour) from the most
//     relevant data: after the usage-change date if available, otherwise before it plus a measured adjustment.
//  4. Charging: sessions per day and kWh per session from data after the change date, with a seasonal index
//     measured from how much more energy each session took in colder months.
//  5. Price each forecast month under each plan at the latest RPP prices; compare strategies under
//     low / mid / high charging scenarios.
import { localParts, localMidnight, addDays, weekdayOf } from './time.js';
import { isHoliday } from './holidays.js';
import { billFactor } from './bill.js';
import { latestPrices, priceOn, touPeriod, uloPeriod, tierThreshold } from './tariff.js';

export const SCENARIOS = {
  low: { label: 'Less charging', chargeFactor: 0.5, seasonal: false },
  mid: { label: 'Like recent months', chargeFactor: 1.0, seasonal: true },
  high: { label: 'More charging', chargeFactor: 1.3, seasonal: true },
};
export const SWITCH_WORTH = 20;        // $/year a switching schedule must save over the best single plan to be recommended
const MIN_DAYS = 7;                    // days of data needed in a month to use it as a source
const PLANS = ['tou', 'ulo', 'tiered'];

/**
 * Detect sustained high-power runs (e.g. EV charging).
 * Start: power >= 75% of the 99.5th-percentile power. Continue while >= 50% of it. Pieces separated by
 * up to 90 minutes are merged (chargers taper and pause). Runs shorter than 45 minutes are ignored
 * (ovens, dryers). Energy is measured above the household baseline in the 2 hours before the run.
 */
const sessionCache = new WeakMap();
export function detectSessions(iv) {
  if (sessionCache.has(iv)) return sessionCache.get(iv);
  const out = detectSessionsUncached(iv);
  sessionCache.set(iv, out);
  return out;
}
function detectSessionsUncached(iv) {
  const kw = iv.map(x => x.kwh * 3600 / x.dur);
  const sorted = [...kw].sort((a, b) => a - b);
  const p995 = sorted[Math.floor(sorted.length * 0.995)] || 0;
  if (p995 < 3) return { sessions: [], thresholdKw: null };
  const T = 0.75 * p995, cont = 0.5 * p995;
  const runs = [];
  const contiguous = k => k > 0 && iv[k].start === iv[k - 1].start + iv[k - 1].dur;
  for (let i = 0; i < iv.length; i++) {
    // A run starts at a high reading whose previous reading was low, or that follows a gap (or starts the file).
    if (!(kw[i] >= T && (!contiguous(i) || kw[i - 1] < T))) continue;
    let j = i;
    while (j < iv.length && kw[j] >= cont && (j === i || iv[j].start === iv[j - 1].start + iv[j - 1].dur)) j++;
    runs.push([i, j]); i = j - 1;
  }
  const merged = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (prev && iv[r[0]].start - (iv[prev[1] - 1].start + iv[prev[1] - 1].dur) <= 5400) prev[1] = r[1];
    else merged.push([...r]);
  }
  const sessions = [];
  for (const [i, j] of merged) {
    const end = iv[j - 1].start + iv[j - 1].dur;
    if (end - iv[i].start < 2700) continue;
    // Household baseline: readings that start within the 2 hours before the session. Counted in time, not readings,
    // so hourly data doesn't reach back into the evening peak (8 readings would be 8 hours).
    let b0 = i;
    while (b0 > 0 && iv[i].start - iv[b0 - 1].start <= 7200) b0--;
    const before = kw.slice(b0, i).sort((a, b) => a - b);
    const baseKw = Math.min(before[Math.floor(before.length / 2)] ?? 0, cont);
    let kwh = 0;
    for (let k = i; k < j; k++) kwh += Math.max(0, iv[k].kwh - baseKw * iv[k].dur / 3600);
    const lp = localParts(iv[i].start);
    // Clipped: the run starts the file or follows a gap, or ends at a gap or the end of the file, so its true length
    // is unknown. Clipped sessions count towards how often charging happens, not towards energy per session.
    const clipped = !contiguous(i) || j >= iv.length || !(iv[j].start === iv[j - 1].start + iv[j - 1].dur);
    sessions.push({ startIndex: i, endIndex: j, start: iv[i].start, end, kwh, baseKw, date: lp.date, hour: lp.hour, minute: lp.minute, clipped });
  }
  return { sessions, thresholdKw: T };
}

/** Most common session start time, and how concentrated starts are. */
export function startPattern(sessions) {
  const c = new Map();
  for (const s of sessions) { const k = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`; c.set(k, (c.get(k) || 0) + 1); }
  const top = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { time: top[0], share: top[1] / sessions.length } : null;
}

const dayType = d => (weekdayOf(d) >= 6 || isHoliday(d) ? 'we' : 'wk');

/**
 * @param iv intervals [{start, dur, kwh}]
 * @param opts {changeDate?: 'YYYY-MM-DD', treatAsCharging?: boolean, customKwhPerWeek?: number, startMonth?: 'YYYY-MM', prices?}
 */
const bad = (field, message) => Object.assign(new Error(message), { code: 'INVALID_INPUT', field });
function checkOptions(o) {
  if (o.customKwhPerWeek !== undefined) {
    // 2,000 kWh a week is more than an 11.5 kW home charger delivers running nonstop (1,932 kWh), so anything above is not a real household.
    if (typeof o.customKwhPerWeek !== 'number' || !Number.isFinite(o.customKwhPerWeek) || o.customKwhPerWeek < 0 || o.customKwhPerWeek > 2000) throw bad('customKwhPerWeek', 'Charging must be a number from 0 to 2,000 kWh a week.');
  }
  if (o.changeDate !== undefined && o.changeDate !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.changeDate) || Number.isNaN(Date.parse(o.changeDate + 'T12:00:00Z')) || new Date(o.changeDate + 'T12:00:00Z').toISOString().slice(0, 10) !== o.changeDate) throw bad('changeDate', 'The change date must be a real date.');
  }
  if (o.startMonth !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(o.startMonth)) throw bad('startMonth', 'The start month must look like 2026-11.');
}

export function forecast(iv, opts = {}) {
  checkOptions(opts);
  // Each forecast month is priced at the OEB prices in effect that month. Months after the next expected
  // price change (a year after the latest known prices start) use the latest known prices, and say so.
  const latest = opts.prices || latestPrices();
  const nextChange = `${+latest.effective.slice(0, 4) + 1}${latest.effective.slice(4)}`;
  const priceFor = mk => {
    if (opts.prices) return { prices: opts.prices, assumed: false };
    const day = `${mk}-01`;
    return { prices: priceOn(day) || latest, assumed: day >= nextChange };
  };
  const assumptions = [];
  const det = detectSessions(iv);
  const charging = opts.treatAsCharging !== false && det.sessions.length > 0;
  const change = opts.changeDate || null;

  // ---- Per-day household and charging energy, with day coverage ----
  const days = new Map(); // date -> {cover seconds, type, hh: Float64Array(24) household kWh by hour, ch: kWh charging, chHour: Float64Array(24)}
  const sessionOf = new Map();
  for (const s of det.sessions) for (let k = s.startIndex; k < s.endIndex; k++) sessionOf.set(k, s);
  iv.forEach((x, i) => {
    const lp = localParts(x.start);
    let d = days.get(lp.date);
    if (!d) { d = { date: lp.date, cover: 0, type: dayType(lp.date), hh: new Float64Array(24), ch: 0, chHour: new Float64Array(24) }; days.set(lp.date, d); }
    d.cover += x.dur;
    const s = charging ? sessionOf.get(i) : null;
    if (s) { const base = Math.min(x.kwh, s.baseKw * x.dur / 3600); d.hh[lp.hour] += base; d.ch += x.kwh - base; d.chHour[lp.hour] += x.kwh - base; }
    else d.hh[lp.hour] += x.kwh;
  });
  // Only complete days are used: every second of the local day covered (DST days have 23 or 25 hours).
  const full = [...days.values()].filter(d => d.cover >= (localMidnight(addDays(d.date, 1)) - localMidnight(d.date)));
  const fullDates = new Set(full.map(d => d.date));
  const last = full.length ? full[full.length - 1].date : null;
  if (!last) throw new Error('Not enough complete days of data to forecast');
  const yearAgo = addDays(last, -364);
  const regime = d => (change && d.date < change ? 'pre' : 'post');

  // ---- Household profiles: calendar month x regime x day type -> avg kWh per hour ----
  const prof = new Map(); // key `${m}|${regime}|${type}` -> {sum: Float64Array(24), n}
  const recent = full.filter(d => d.date > yearAgo);
  const addTo = (map, key, d) => { let p = map.get(key); if (!p) { p = { sum: new Float64Array(24), n: 0, days: 0 }; map.set(key, p); } for (let h = 0; h < 24; h++) p.sum[h] += d.hh[h]; p.n++; };
  for (const d of recent) addTo(prof, `${+d.date.slice(5, 7)}|${regime(d)}|${d.type}`, d);
  const countDays = (m, r) => (prof.get(`${m}|${r}|wk`)?.n || 0) + (prof.get(`${m}|${r}|we`)?.n || 0);

  // Measured household change after the change date: same calendar months, before vs after (all data, not just last year)
  let delta = null;
  if (change) {
    // Compare the same calendar month before and after, using only the same days of the month in both,
    // so that a partial month does not compare early-month weather with late-month weather.
    const both = [];
    const sums = { wk: new Float64Array(24), we: new Float64Array(24) }, weights = { wk: 0, we: 0 };
    for (let m = 1; m <= 12; m++) {
      const pre = full.filter(d => +d.date.slice(5, 7) === m && d.date < change), post = full.filter(d => +d.date.slice(5, 7) === m && d.date >= change);
      const dom = new Set(pre.map(d => d.date.slice(8))); const common = new Set(post.map(d => d.date.slice(8)).filter(x => dom.has(x)));
      const a = pre.filter(d => common.has(d.date.slice(8))), b = post.filter(d => common.has(d.date.slice(8)));
      if (a.length < MIN_DAYS || b.length < MIN_DAYS) continue;
      both.push(m);
      for (const t of ['wk', 'we']) {
        const A = a.filter(d => d.type === t), B = b.filter(d => d.type === t);
        if (!A.length || !B.length) continue;
        for (let h = 0; h < 24; h++) sums[t][h] += B.reduce((s, d) => s + d.hh[h], 0) / B.length - A.reduce((s, d) => s + d.hh[h], 0) / A.length;
        weights[t]++;
      }
    }
    if (both.length) {
      delta = { wk: sums.wk.map(v => (weights.wk ? v / weights.wk : 0)), we: sums.we.map(v => (weights.we ? v / weights.we : 0)), months: both };
      const perDay = (delta.wk.reduce((s, v) => s + v, 0) * 5 + delta.we.reduce((s, v) => s + v, 0) * 2) / 7;
      delta.perDay = perDay;
      assumptions.push(`Household use (not counting charging) changed by ${perDay >= 0 ? '+' : ''}${perDay.toFixed(1)} kWh a day after ${change}. This was measured by comparing the same days of ${both.map(m => MONTH[m - 1]).join(', ')} before and after, so it also includes any difference in weather between those days. Months that only have data from before ${change} are adjusted by this amount.`);
    } else assumptions.push(`No calendar month has at least ${MIN_DAYS} matching days both before and after ${change}, so the change in household use could not be measured. Months with data only from before ${change} are used as they were.`);
  }

  // ---- Charging model ----
  let chg = null;
  if (charging) {
    const inBase = change ? (d => d >= change) : (d => d > addDays(last, -91));
    const baseSessions = det.sessions.filter(s => inBase(s.date) && fullDates.has(s.date));
    const baseDays = full.filter(d => inBase(d.date)).length;
    // Seasonal index from per-session energy by calendar month, in the reference period (before the change, or all data)
    const refSessions = (change ? det.sessions.filter(s => s.date < change) : det.sessions).filter(s => fullDates.has(s.date));
    const byM = new Map();
    for (const s of refSessions.filter(x => !x.clipped)) { const m = +s.date.slice(5, 7); const r = byM.get(m) || { kwh: 0, n: 0 }; r.kwh += s.kwh; r.n++; byM.set(m, r); }
    const avg = m => (byM.get(m) && byM.get(m).n >= 5 ? byM.get(m).kwh / byM.get(m).n : null);
    const warm = [5, 6, 7, 8, 9].map(avg).filter(v => v !== null);
    const known = [...Array(12)].map((_, i) => avg(i + 1)).filter(v => v !== null);
    const ref = warm.length ? warm.reduce((a, b) => a + b) / warm.length : (known.length ? Math.min(...known) : null);
    const index = [...Array(12)].map((_, i) => { const a = avg(i + 1); return a !== null && ref ? Math.max(1, a / ref) : 1; });
    const whole = baseSessions.filter(x => !x.clipped);
    const adjKwh = whole.reduce((s, x) => s + x.kwh / index[+x.date.slice(5, 7) - 1], 0);
    const perSession = whole.length ? adjKwh / whole.length : 0;
    const perDay = baseDays ? baseSessions.length / baseDays : 0;
    // Hour-of-day shape of charging energy
    const shape = new Float64Array(24);
    let tot = 0;
    for (const d of full) if (inBase(d.date)) for (let h = 0; h < 24; h++) { shape[h] += d.chHour[h]; tot += d.chHour[h]; }
    if (tot > 0) for (let h = 0; h < 24; h++) shape[h] /= tot; else shape[23] = 1;
    const sp = startPattern(baseSessions.length ? baseSessions : det.sessions);
    chg = { sessionsPerDay: perDay, kwhPerSession: perSession, warmKwhPerWeek: perDay * perSession * 7, index, shape, startPattern: sp, baseSessions: baseSessions.length, baseDays };
    assumptions.push(`Charging: ${baseSessions.length} sessions over ${baseDays} days ${change ? `since ${change}` : 'in the last 90 days'}, about ${(perDay * 7).toFixed(1)} a week at ${perSession.toFixed(1)} kWh each in mild weather (${chg.warmKwhPerWeek.toFixed(0)} kWh a week).${sp ? ` Most sessions start at ${sp.time}.` : ''}`);
    const cold = index.map((v, i) => [MONTH[i], v]).filter(([, v]) => v > 1.05);
    if (cold.length) assumptions.push(`Each session used more energy in colder months (measured from ${change ? `sessions before ${change}` : 'your sessions'}): ${cold.map(([m, v]) => `${m} +${Math.round((v - 1) * 100)}%`).join(', ')}. The "less charging" scenario leaves this out.`);
  } else if (det.sessions.length) assumptions.push('Detected high-power sessions are treated as ordinary household use.');

  // ---- Forecast months ----
  const start = opts.startMonth || nextMonth(last.slice(0, 7));
  const months = [];
  for (let k = 0; k < 12; k++) months.push(addMonths(start, k));
  const notes = new Set();
  const result = {};
  for (const sc of Object.keys(SCENARIOS)) result[sc] = [];
  for (const mk of months) {
    const [y, m] = mk.split('-').map(Number);
    const nd = new Date(y, m, 0).getDate();
    const dts = [...Array(nd)].map((_, i) => `${mk}-${String(i + 1).padStart(2, '0')}`);
    // Source of household profile
    let src = null;
    if (countDays(m, 'post') >= MIN_DAYS) src = { regime: 'post', m };
    else if (countDays(m, 'pre') >= MIN_DAYS) src = { regime: 'pre', m };
    else {
      for (let dist = 1; dist <= 6 && !src; dist++) for (const mm of [((m - 1 + dist) % 12) + 1, ((m - 1 - dist + 12) % 12) + 1]) {
        if (countDays(mm, 'post') >= MIN_DAYS) { src = { regime: 'post', m: mm, borrowed: true }; break; }
        if (countDays(mm, 'pre') >= MIN_DAYS) { src = { regime: 'pre', m: mm, borrowed: true }; break; }
      }
      if (!src) throw Object.assign(new Error(`Not enough data to estimate the next 12 months: the file needs at least ${MIN_DAYS} full days in at least one month.`), { code: 'NOT_ENOUGH_DATA' });
      notes.add(`${MONTH[m - 1]}: no data for this month, so ${MONTH[src.m - 1]} was used instead.`);
    }
    const hhFor = (type, h) => {
      const p = prof.get(`${src.m}|${src.regime}|${type}`) || prof.get(`${src.m}|${src.regime}|${type === 'wk' ? 'we' : 'wk'}`);
      let v = p ? p.sum[h] / p.n : 0;
      if (src.regime === 'pre' && delta) v += delta[type][h];
      return Math.max(0, v);
    };
    for (const [sc, cfg] of Object.entries(SCENARIOS)) {
      const T = { on: 0, mid: 0, off: 0 }, U = { on: 0, mid: 0, off: 0, overnight: 0 };
      let total = 0, chKwh = 0;
      const idx = chg && cfg.seasonal ? chg.index[m - 1] : 1;
      const perDayCh = chg ? (opts.customKwhPerWeek !== undefined ? opts.customKwhPerWeek / 7 : chg.sessionsPerDay * chg.kwhPerSession) * cfg.chargeFactor * idx : 0;
      for (const d of dts) {
        const type = dayType(d), wd = weekdayOf(d);
        for (let h = 0; h < 24; h++) {
          const lp = { date: d, month: m, weekday: wd, hour: h };
          const e = hhFor(type, h) + (chg ? perDayCh * chg.shape[h] : 0);
          T[touPeriod(lp)] += e; U[uloPeriod(lp)] += e; total += e;
        }
        chKwh += perDayCh;
      }
      const pf = priceFor(mk);
      const cost = costs(T, U, total, m, pf.prices), factor = billFactor(pf.prices.oer);
      // billCost: the electricity charges plus HST, minus the rebate, for this month's rebate rate. Delivery and
      // regulatory charges are left out because they are the same on every plan.
      result[sc].push({ month: mk, kwh: total, chargingKwh: chKwh, tou: T, ulo: U, cost, factor, billCost: Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, v * factor])), priceEffective: pf.prices.effective, priceAssumed: pf.assumed, source: src });
    }
  }

  // ---- Strategies ----
  const strategies = {};
  for (const sc of Object.keys(SCENARIOS)) {
    const rows = result[sc];
    // Decisions use the cost after tax and rebate (billCost); electricity-only totals are kept for display.
    const sum = key => Object.fromEntries(PLANS.map(p => [p, rows.reduce((s, r) => s + r[key][p], 0)]));
    strategies[sc] = { single: sum('billCost'), bestMonthly: rows.reduce((s, r) => s + Math.min(...PLANS.map(p => r.billCost[p])), 0), electricity: { single: sum('cost') } };
  }
  const sched = bestSchedule(result.mid);
  for (const sc of Object.keys(SCENARIOS)) { strategies[sc].schedule = scheduleCost(result[sc], sched, 'billCost'); strategies[sc].electricity.schedule = scheduleCost(result[sc], sched, 'cost'); }
  const midSingle = strategies.mid.single;
  const bestSingle = PLANS.reduce((a, b) => (midSingle[b] < midSingle[a] ? b : a));
  const useSchedule = sched && midSingle[bestSingle] - strategies.mid.schedule >= SWITCH_WORTH;
  const rec = useSchedule ? { kind: 'schedule', schedule: sched } : { kind: 'single', plan: bestSingle };
  const costOfRec = sc => (rec.kind === 'single' ? strategies[sc].single[rec.plan] : strategies[sc].schedule);
  const bestIn = sc => Math.min(...PLANS.map(p => strategies[sc].single[p]), strategies[sc].schedule);
  // The recommendation "holds" in a scenario only if it is still the cheapest option compared there
  // (each plan all year, and the same switching schedule). No tolerance.
  const holds = ['low', 'high'].filter(sc => costOfRec(sc) - bestIn(sc) <= 0.005);
  const confidence = holds.length === 2 ? 'high' : holds.length === 1 ? 'medium' : 'low';

  // ---- Break-even charging (ULO vs TOU, ULO vs Tiered), per month, mid household ----
  const breakEven = chg ? result.mid.map((r, i) => {
    const m = +r.month.slice(5, 7);
    const per1 = chargingPeriodKwh(r.month, chg.shape);
    const without = { tou: sub(r.tou, scale(per1.tou, r.chargingKwh)), ulo: sub(r.ulo, scale(per1.ulo, r.chargingKwh)), kwh: r.kwh - r.chargingKwh };
    const mp = priceFor(r.month).prices;
    const at = c => costs(add(without.tou, scale(per1.tou, c)), add(without.ulo, scale(per1.ulo, c)), without.kwh + c, m, mp);
    const solve = (a, b) => bisect(c => at(c)[a] - at(c)[b], 0, 5000);
    const nd = new Date(+r.month.slice(0, 4), m, 0).getDate();
    const vsTou = solve('ulo', 'tou'), vsTier = solve('ulo', 'tiered');
    return { month: r.month, expectedKwhPerWeek: r.chargingKwh / nd * 7, uloVsTouKwhPerWeek: vsTou === null ? null : vsTou / nd * 7, uloVsTieredKwhPerWeek: vsTier === null ? null : vsTier / nd * 7 };
  }) : null;

  const used = [...new Set(result.mid.map(r => r.priceEffective))];
  const assumedMonths = result.mid.filter(r => r.priceAssumed).map(r => r.month);
  const lastKnownDay = (() => { const d = new Date(nextChange + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  assumptions.push(used.length === 1 && !assumedMonths.length
    ? `Prices: the OEB prices that start ${latest.effective}, which apply to all 12 months.`
    : `Prices: each month uses the OEB prices in effect that month (prices starting ${used.join(' and ')}).${assumedMonths.length ? ` Prices after ${lastKnownDay} aren’t known yet, so the last ${assumedMonths.length === 1 ? 'month assumes' : `${assumedMonths.length} months assume`} they stay the same.` : ''} Prices normally change every November 1.`);
  const pricing = { effectives: used, assumedMonths, lastKnownDay, latest: latest.effective };
  assumptions.push('Weather like the same months in your data. A hotter summer or colder winter changes the results.');
  return { householdDelta: delta ? { perDay: delta.perDay, months: delta.months } : null, months, scenarios: result, strategies, schedule: sched, recommendation: { ...rec, confidence, holdsIn: holds, cost: { low: costOfRec('low'), mid: costOfRec('mid'), high: costOfRec('high') } }, breakEven, charging: chg, detection: { sessions: det.sessions.length, thresholdKw: det.thresholdKw, startPattern: startPattern(det.sessions), treated: charging }, change, assumptions, notes: [...notes], prices: latest.effective, pricing };
}

function costs(T, U, kwh, m, p) {
  const th = tierThreshold(m);
  return {
    tou: (T.on * p.tou.on + T.mid * p.tou.mid + T.off * p.tou.off) / 100,
    ulo: (U.on * p.ulo.on + U.mid * p.ulo.mid + U.off * p.ulo.off + U.overnight * p.ulo.overnight) / 100,
    tiered: (Math.min(kwh, th) * p.tiered.t1 + Math.max(0, kwh - th) * p.tiered.t2) / 100,
  };
}
// Fraction of one kWh of charging landing in each period, for a given month (by its calendar and the charging shape).
function chargingPeriodKwh(mk, shape) {
  const [y, m] = mk.split('-').map(Number), nd = new Date(y, m, 0).getDate();
  const T = { on: 0, mid: 0, off: 0 }, U = { on: 0, mid: 0, off: 0, overnight: 0 };
  for (let i = 1; i <= nd; i++) {
    const d = `${mk}-${String(i).padStart(2, '0')}`, wd = weekdayOf(d);
    for (let h = 0; h < 24; h++) { const lp = { date: d, month: m, weekday: wd, hour: h }; T[touPeriod(lp)] += shape[h] / nd; U[uloPeriod(lp)] += shape[h] / nd; }
  }
  return { tou: T, ulo: U };
}
const scale = (o, k) => Object.fromEntries(Object.entries(o).map(([a, v]) => [a, v * k]));
const add = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + b[k]]));
const sub = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] - b[k]]));
function bisect(f, lo, hi) {
  const flo = f(lo), fhi = f(hi);
  if (flo <= 0) return 0;             // already cheaper with no charging
  if (fhi > 0) return null;           // never breaks even in range
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** Best schedule with at most two switches a year: plan A for one contiguous run of months, plan B for the rest. */
function bestSchedule(rows) {
  let best = null;
  const n = rows.length;
  for (const a of PLANS) for (const b of PLANS) {
    if (a === b) continue;
    for (let s = 0; s < n; s++) for (let len = 1; len < n; len++) {
      const plan = rows.map((_, i) => (((i - s + n) % n) < len ? a : b));
      const c = rows.reduce((t, r, i) => t + r.billCost[plan[i]], 0);
      if (!best || c < best.cost - 1e-9) best = { cost: c, plan };
    }
  }
  if (!best) return null;
  return { plan: best.plan, runs: runsOf(rows.map(r => r.month), best.plan) };
}
const scheduleCost = (rows, sched, key = 'billCost') => (sched ? rows.reduce((t, r, i) => t + r[key][sched.plan[i]], 0) : Infinity);
function runsOf(months, plan) {
  const runs = [];
  months.forEach((m, i) => { if (runs.length && runs[runs.length - 1].plan === plan[i]) runs[runs.length - 1].to = m; else runs.push({ plan: plan[i], from: m, to: m }); });
  if (runs.length > 2 && runs[0].plan === runs[runs.length - 1].plan) { const lastRun = runs.pop(); runs[0] = { plan: lastRun.plan, from: lastRun.from, to: runs[0].to, wraps: true }; }
  return runs;
}
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function nextMonth(mk) { return addMonths(mk, 1); }
function addMonths(mk, k) { const [y, m] = mk.split('-').map(Number); const t = (y * 12 + m - 1) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }

/** Suggest a usage-change date: the month boundary where average daily charging energy shifts most (by at least 30%). */
export function suggestChangeDate(iv) {
  const { sessions } = detectSessions(iv);
  if (sessions.length < 20) return null;
  const days = new Map();
  for (const x of iv) { const d = localParts(x.start).date; days.set(d.slice(0, 7), (days.get(d.slice(0, 7)) || new Set()).add(d)); }
  const months = [...days.keys()].sort().filter(k => days.get(k).size >= 20);
  if (months.length < 4) return null;
  const e = new Map(months.map(k => [k, 0]));
  for (const s of sessions) { const k = s.date.slice(0, 7); if (e.has(k)) e.set(k, e.get(k) + s.kwh); }
  const perDay = months.map(k => e.get(k) / days.get(k).size);
  let best = null;
  for (let i = 2; i <= months.length - 2; i++) {
    const a = perDay.slice(0, i), b = perDay.slice(i);
    const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
    const rel = Math.abs(mb - ma) / Math.max(ma, mb);
    if (rel >= 0.3 && (!best || rel > best.rel)) best = { date: months[i] + '-01', rel, before: ma * 7, after: mb * 7 };
  }
  return best;
}

/**
 * The switches someone needs to make, in order, from the recommended plan for each month.
 * @param months ['YYYY-MM', ...], plans [plan per month], current 'tou'|'ulo'|'tiered'|null, today 'YYYY-MM'
 * @returns [{plan, from: 'YYYY-MM', due: boolean, first: boolean, ifNotAlready: boolean}]
 */
export function switchSteps(months, plans, current, today) {
  const steps = [];
  if (current !== plans[0]) steps.push({ plan: plans[0], from: months[0], first: true, ifNotAlready: !current });
  for (let i = 1; i < months.length; i++) if (plans[i] !== plans[i - 1]) steps.push({ plan: plans[i], from: months[i], first: false, ifNotAlready: false });
  return steps.map(s => ({ ...s, due: s.from <= today }));
}
