// Reconcile one bill against interval data.
// Bill dates follow Alectra's convention: "From" is the previous meter-read day; usage starts the next local midnight.
import { localParts, localMidnight, addDays } from './time.js';
import { priceOn, touPeriod, uloPeriod } from './tariff.js';

export const BILL_PERIODS = { tou: ['on', 'mid', 'off'], ulo: ['on', 'mid', 'off', 'overnight'], tiered: ['total'] };

/**
 * @param iv intervals [{start, dur, kwh}]
 * @param bill {plan:'tou'|'ulo'|'tiered', from, to, kwh:{period:kWh}, dollars?:{period:$}, totalKwh?, prices?:{period:¢}}
 * @param opts {remainderPeriod?: string} the period the utility fills with "register total minus the other periods"
 */
export function reconcileBill(iv, bill, opts = {}) {
  for (const k of ['from', 'to']) if (!/^\d{4}-\d{2}-\d{2}$/.test(bill[k] || '')) throw Object.assign(new Error('Billing dates must be real dates.'), { code: 'INVALID_INPUT', field: k });
  const startT = localMidnight(addDays(bill.from, 1)), endT = localMidnight(addDays(bill.to, 1));
  const got = {}, cost = {};
  const effectiveDates = new Set();
  let total = 0, covered = 0;
  for (const x of iv) {
    if (x.start < startT || x.start >= endT) continue;
    const lp = localParts(x.start);
    const p = bill.plan === 'ulo' ? uloPeriod(lp) : bill.plan === 'tou' ? touPeriod(lp) : 'total';
    got[p] = (got[p] || 0) + x.kwh; total += x.kwh; covered += x.dur;
    const pe = priceOn(lp.date);
    if (!pe) throw Object.assign(new Error(`The tool has no prices for ${lp.date}, so this bill can’t be checked.`), { code: 'NO_PRICES' });
    if (bill.plan !== 'tiered' && !pe[bill.plan]) throw Object.assign(new Error(`${bill.plan === 'ulo' ? 'Ultra-Low Overnight' : 'This plan'} wasn’t available on ${lp.date}, so this bill can’t be checked as that plan.`), { code: 'PLAN_NOT_AVAILABLE' });
    if (bill.plan !== 'tiered') { effectiveDates.add(pe.effective); cost[p] = (cost[p] || 0) + x.kwh * pe[bill.plan][p] / 100; }
  }
  const periods = Object.keys(bill.kwh);
  const remainder = opts.remainderPeriod && bill.totalKwh !== undefined && periods.includes(opts.remainderPeriod) ? opts.remainderPeriod : null;
  const modelled = { ...got };
  if (remainder) modelled[remainder] = bill.totalKwh - periods.filter(p => p !== remainder).reduce((s, p) => s + (got[p] || 0), 0);
  const single = effectiveDates.size <= 1 ? priceOn(bill.to) : null;
  const rows = periods.map(p => {
    const b = bill.kwh[p], i = got[p] || 0, mo = modelled[p] ?? 0;
    const price = bill.prices?.[p] ?? (single && bill.plan !== 'tiered' ? single[bill.plan][p] : undefined);
    const intervalDollars = bill.prices?.[p] !== undefined ? i * bill.prices[p] / 100 : cost[p];
    const modelDollars = price !== undefined ? mo * price / 100 : (i ? (cost[p] || 0) * mo / i : undefined);
    return { period: p, billKwh: b, intervalKwh: i, diffKwh: i - b, modelKwh: mo, modelDiffKwh: mo - b, price,
      billDollars: bill.dollars?.[p], intervalDollars: r2(intervalDollars), modelDollars: r2(modelDollars) };
  });
  return {
    window: { start: startT, end: endT, days: Math.round((endT - startT) / 86400) },
    coverage: covered / (endT - startT), intervalTotalKwh: total, remainderPeriod: remainder,
    crossesPriceChange: effectiveDates.size > 1, rows,
  };
}

/** Find register reads equal (to 0.005 kWh) to the bill's previous/current meter readings. */
export function matchRegisterReads(register, prevReading, currReading) {
  if (!register) return null;
  const reads = register.readings.map(r => ({ start: r.start, kwh: r.value * register.scale / 1000, local: localParts(r.start).date }));
  const near = v => (v === undefined || v === null || isNaN(v) ? null : reads.find(r => Math.abs(r.kwh - v) < 0.005) || null);
  return { prev: near(prevReading), curr: near(currReading) };
}
const r2 = x => (x === undefined || x === null ? undefined : Math.round(x * 100) / 100);
