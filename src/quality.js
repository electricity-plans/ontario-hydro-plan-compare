// Data-quality report for the consumption channel (and register cross-check).
import { localParts, localMidnight, addDays } from './time.js';
import { toKwh, selectConsumption, pickRegisterChannel, EASTERN_LTP, QUALITY, ESTIMATED_QUALITY } from './espi.js';
import { priceOn, touPeriod, uloPeriod } from './tariff.js';

/** Normalize the consumption channel into [{start, dur, kwh, quality[], cost, tou}] sorted by start. */
export function intervalsOf(channel) {
  return channel.readings.map(r => ({ start: r.start, dur: r.duration, kwh: toKwh(r.value, channel.readingType), quality: r.quality, cost: r.cost, tou: r.tou }));
}

export function qualityReport(parsed) {
  const issues = [];   // {level: 'error'|'warning'|'info', code, message}
  const add = (level, code, message) => issues.push({ level, code, message });
  for (const p of parsed.problems) add('warning', 'structure', p);

  const sel = selectConsumption(parsed.channels);
  const ch = sel.channel;
  if (!ch) { add('error', sel.error.code, sel.error.message); return { issues, channels: summarizeChannels(parsed) }; }
  const rt = ch.readingType;
  const raw = intervalsOf(ch);
  if (!raw.length) { add('error', 'empty', 'The consumption channel has no readings.'); return { issues, channels: summarizeChannels(parsed) }; }
  const stop = (code, message) => { add('error', code, message); return { issues, channels: summarizeChannels(parsed) }; };

  // ---- Validate every reading before anything is calculated ----
  if (!Number.isFinite(rt.powerOfTenMultiplier)) return stop('invalid-units', 'The units in this file can’t be read, so its readings can’t be used safely.');
  let badT = 0, badD = 0, badV = 0, neg = 0;
  for (const x of raw) {
    if (!Number.isInteger(x.start) || x.start < 946684800 || x.start > 4102444800) badT++;      // 2000-01-01 .. 2100-01-01
    if (!Number.isInteger(x.dur) || x.dur <= 0 || x.dur > 3600) badD++;
    if (!Number.isFinite(x.kwh)) badV++; else if (x.kwh < 0) neg++;
  }
  if (badT + badD + badV) return stop('invalid-readings', `Some readings in this file have a missing or unusable time, length or value (${badT + badD + badV} of ${raw.length.toLocaleString('en-CA')}), so it can’t be used safely.`);
  // Supported: 5, 15, 30 or 60-minute readings, each starting on its own clock grid (a 15-minute reading at :00,
  // :15, :30 or :45). Each such reading fits inside one clock hour, which the price periods assume. Ontario's UTC
  // offsets are whole hours, so the grid can be checked on the timestamps directly.
  const SUPPORTED = [300, 900, 1800, 3600];
  const oddLength = raw.filter(x => !SUPPORTED.includes(x.dur));
  if (oddLength.length) return stop('unsupported-length', `This file has readings ${Math.round(oddLength[0].dur / 60)} minutes long. Only 5, 15, 30 or 60-minute readings are supported for now.`);
  const offGrid = raw.filter(x => x.start % x.dur !== 0);
  if (offGrid.length) return stop('unaligned', `${offGrid.length} readings don’t start on the clock (for example, a reading from 6:30 to 7:30). This format isn’t supported for now.`);
  if (neg) return stop('negative', `${neg} readings are negative, which a usage file shouldn’t have. This can mean the file includes power sent back to the grid.`);
  raw.sort((a, b) => a.start - b.start || a.dur - b.dur);
  if ((raw[raw.length - 1].start - raw[0].start) > 5 * 366 * 86400) return stop('too-long', 'This file covers more than 5 years. Download a shorter range: 2 years is plenty.');
  if (raw.length > 600000) return stop('too-many', 'This file has too many readings to handle here. Download a shorter range: 2 years is plenty.');

  // ---- Duplicates, overlaps, gaps (on the time actually covered) ----
  const lengths = {};
  for (const x of raw) lengths[x.dur] = (lengths[x.dur] || 0) + 1;
  if (Object.keys(lengths).length > 1) add('warning', 'mixed-lengths', `Readings have mixed interval lengths: ${JSON.stringify(lengths)}`);
  if (rt.intervalLength && !lengths[rt.intervalLength]) add('warning', 'length-mismatch', `ReadingType says ${rt.intervalLength}s intervals but readings use ${Object.keys(lengths).join(', ')}s`);
  const iv = [], gaps = [], dups = [];
  let conflicts = 0, overlapCount = 0, furthest = -Infinity;
  for (const x of raw) {
    const prev = iv[iv.length - 1];
    if (prev && x.start === prev.start) {
      if (x.dur === prev.dur && x.kwh === prev.kwh) { dups.push(x.start); continue; }   // identical: count once
      conflicts++; continue;
    }
    if (x.start < furthest) { overlapCount++; continue; }
    if (prev && x.start > furthest) gaps.push({ from: furthest, to: x.start, hours: (x.start - furthest) / 3600 });
    iv.push(x);
    furthest = Math.max(furthest, x.start + x.dur);
  }
  if (conflicts) return stop('conflicting-duplicates', `This file lists the same time twice with different readings (${conflicts} times), so we can’t tell which is right.`);
  if (overlapCount) return stop('overlaps', `Some readings in this file overlap in time (${overlapCount}), so they can’t be added up safely.`);
  if (gaps.length) add('warning', 'gaps', `${gaps.length} gap(s) totalling ${gaps.reduce((s, g) => s + g.hours, 0).toFixed(2)} hours of missing data`);
  if (dups.length) add('warning', 'duplicates', `${dups.length} repeated reading(s) were identical and counted once`);
  const overlaps = [];

  // Net metering is outside this tool's scope.
  for (const c of parsed.channels) if (c.usagePoint === ch.usagePoint && c.readingType.flowDirection === 19 && c.readings.some(r => r.value > 0)) return stop('generation', 'This file shows electricity sent back to the grid, for example from solar panels. This tool doesn’t cover net metering.');
  if (rt.flowDirection === 4) add('warning', 'net-only', 'This file only has net readings (use minus anything sent back to the grid). They are used as your usage.');

  // Coverage in local time
  const first = iv[0].start, last = iv[iv.length - 1].start + iv[iv.length - 1].dur;
  const fl = localParts(first), ll = localParts(last - 1);
  const spanDays = (last - first) / 86400;
  const coverage = { firstStart: first, lastEnd: last, firstLocal: fmtLocal(first), lastEndLocal: fmtLocal(last), days: +spanDays.toFixed(2), months: +(spanDays / (365.25 / 12)).toFixed(1), intervals: iv.length };
  if (spanDays < 365) add('warning', 'short', `Only ${coverage.months} months of data. A 12-month comparison needs at least 12 months; seasonal results will be less reliable.`);
  if (localParts(first).hour !== 0 || localParts(first).minute !== 0) add('info', 'partial-first-day', `Data starts at ${coverage.firstLocal} local time, so the first local day is partial (the export appears to be cut at UTC midnight).`);
  if (localParts(last).hour !== 0 || localParts(last).minute !== 0) add('info', 'partial-last-day', `Data ends at ${coverage.lastEndLocal} local time, so the last local day is partial.`);

  // DST days: compare interval counts with the true local day length
  const perDay = new Map();
  for (const x of iv) { const d = localParts(x.start).date; perDay.set(d, (perDay.get(d) || 0) + 1); }
  const dst = [];
  for (let d = fl.date; d <= ll.date; d = addDays(d, 1)) {
    const len = (localMidnight(addDays(d, 1)) - localMidnight(d)) / 3600;
    if (len !== 24) {
      const step = rt.intervalLength || Object.keys(lengths)[0];
      const expected = len * 3600 / step, actual = perDay.get(d) || 0;
      dst.push({ date: d, hours: len, expected, actual, ok: expected === actual });
      if (expected !== actual) add('warning', 'dst', `${d} is a ${len}-hour day; expected ${expected} intervals, found ${actual}`);
    }
  }

  // Values and quality flags
  let total = 0, zeros = 0, negatives = 0, estimated = 0;
  const qualityCodes = {};
  for (const x of iv) {
    total += x.kwh; if (x.kwh === 0) zeros++; if (x.kwh < 0) negatives++;
    for (const q of x.quality) { qualityCodes[q] = (qualityCodes[q] || 0) + 1; if (ESTIMATED_QUALITY.has(q)) { estimated++; break; } }
  }
  if (estimated) add('warning', 'estimated', `${estimated} interval(s) are flagged as estimated or edited`);
  else add('info', 'no-estimates-flagged', 'No readings are flagged as estimated. (Utilities do not always flag estimates.)');

  // Register cross-check
  let register = null;
  const reg = pickRegisterChannel(parsed.channels, ch.usagePoint);
  if (reg && reg.readings.length > 1) {
    const r0 = reg.readings[0], r1 = reg.readings[reg.readings.length - 1];
    const regDelta = (r1.value - r0.value) * reg.scale / 1000;
    let s = 0; for (const x of iv) if (x.start >= r0.start && x.start < r1.start) s += x.kwh;
    register = { reads: reg.readings.length, from: fmtLocal(r0.start), to: fmtLocal(r1.start), registerKwh: round(regDelta, 3), intervalKwh: round(s, 3), diffKwh: round(s - regDelta, 3) };
    const rel = Math.abs(s - regDelta) / Math.max(1, regDelta);
    add(rel < 0.001 ? 'info' : 'warning', 'register', `Interval total vs meter register over ${register.from} – ${register.to}: ${register.intervalKwh} vs ${register.registerKwh} kWh (difference ${register.diffKwh} kWh).`);
  }

  // Utility-supplied cost/tou fields: evidence only
  const evidence = costEvidence(iv);
  if (evidence) add('info', 'cost-field', evidence.message);

  // LocalTimeParameters
  const ltp = parsed.localTime;
  if (!ltp) add('info', 'no-ltp', 'No LocalTimeParameters in the file; America/Toronto time is used.');
  else if (ltp.tzOffset !== EASTERN_LTP.tzOffset || ltp.dstOffset !== EASTERN_LTP.dstOffset || (ltp.dstStartRule || '').toUpperCase() !== EASTERN_LTP.dstStartRule || (ltp.dstEndRule || '').toUpperCase() !== EASTERN_LTP.dstEndRule)
    add('warning', 'ltp', `LocalTimeParameters (${JSON.stringify(ltp)}) differ from North American Eastern values; America/Toronto time is used anyway.`);


  return {
    issues, channels: summarizeChannels(parsed),
    selected: { id: ch.id, usagePoint: ch.usagePoint },
    consumption: { id: ch.id, title: ch.title, uom: rt.uom, unit: 'Wh', multiplier: rt.powerOfTenMultiplier, intervalSeconds: rt.intervalLength, flow: rt.flowDirection, totalKwh: round(total, 3), zeros, negatives, estimated, qualityCodes: Object.fromEntries(Object.entries(qualityCodes).map(([k, v]) => [`${k} (${QUALITY[k] || 'unknown'})`, v])), lengths },
    coverage, gaps, duplicates: dups, overlaps, dst, register, costEvidence: evidence, intervals: iv,
  };
}

/** Infer the scale and the plan the utility's per-interval `cost` field was priced at. */
export function costEvidence(iv) {
  let cost = 0, n = 0;
  const priced = { tou: 0, ulo: 0 };
  for (const x of iv) {
    if (x.cost === undefined) continue;
    const lp = localParts(x.start), p = priceOn(lp.date);
    if (!p) continue;
    cost += x.cost; n++;
    priced.tou += x.kwh * p.tou[touPeriod(lp)] / 100;
    if (p.ulo) priced.ulo += x.kwh * p.ulo[uloPeriod(lp)] / 100;
  }
  if (!n || cost === 0) return null;
  let best = null;
  for (const plan of ['tou', 'ulo']) {
    if (!priced[plan]) continue;
    const exp = Math.log10(priced[plan] / cost);       // dollars = cost * 10^exp
    const rounded = Math.round(exp);
    const err = Math.abs(exp - rounded);
    if (!best || err < best.err) best = { plan, exponent: rounded, err };
  }
  if (!best || best.err > 0.01) return { matches: false, message: 'The file includes per-interval cost values that do not match any RPP price plan at a power-of-ten scale. They are ignored.' };
  const spec = -5;
  const scaleNote = best.exponent === spec ? 'in hundred-thousandths of a dollar, as the ESPI spec defines' : `in units of 10^${best.exponent} dollars; the ESPI spec defines hundred-thousandths (10^-5), so this export is non-standard`;
  return { matches: true, plan: best.plan, exponent: best.exponent, message: `The file’s cost values match ${best.plan.toUpperCase()} prices ${scaleNote}. They describe how the utility labels data, not necessarily your actual plan, and are not used for pricing.` };
}

function summarizeChannels(parsed) {
  return parsed.channels.map(c => ({ id: c.id, title: c.title, uom: c.readingType.uom, multiplier: c.readingType.powerOfTenMultiplier, flow: c.readingType.flowDirection, accumulation: c.readingType.accumulationBehaviour, kind: c.readingType.kind, intervalLength: c.readingType.intervalLength, readings: c.readings.length, nonZero: c.readings.filter(r => r.value).length }));
}
export function fmtLocal(t) { const p = localParts(t); return `${p.date} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`; }
export const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
