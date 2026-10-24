// Monthly kWh per period and electricity-line cost under each plan.
import { localParts, localMidnight } from './time.js';
import { priceOn, latestPrices, touPeriod, uloPeriod, tierThreshold } from './tariff.js';

/** Group intervals into local calendar months with TOU/ULO period kWh. */
export function monthlyPeriods(iv) {
  const months = new Map();
  for (const x of iv) {
    const lp = localParts(x.start);
    const key = lp.date.slice(0, 7);
    let m = months.get(key);
    if (!m) { m = { month: key, kwh: 0, tou: { on: 0, mid: 0, off: 0 }, ulo: { on: 0, mid: 0, off: 0, overnight: 0 }, hist: { tou: 0, ulo: 0, uloAvailable: true, priced: true }, days: new Set(), covered: 0 }; months.set(key, m); }
    m.kwh += x.kwh; m.days.add(lp.date); m.covered += x.dur;
    const tp = touPeriod(lp), up = uloPeriod(lp);
    m.tou[tp] += x.kwh; m.ulo[up] += x.kwh;
    const p = priceOn(lp.date);
    if (!p) { m.hist.priced = false; continue; }
    m.hist.tou += x.kwh * p.tou[tp] / 100;
    if (p.ulo) m.hist.ulo += x.kwh * p.ulo[up] / 100; else m.hist.uloAvailable = false;
  }
  // A month is complete only if readings cover all of its time (not just every date).
  return [...months.values()].map(m => {
    const [y, mo] = m.month.split('-').map(Number);
    const startT = localMidnight(`${m.month}-01`), endT = localMidnight(mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`);
    const coverage = m.covered / (endT - startT);
    return { ...m, days: m.days.size, coverage, complete: coverage >= 0.999 };
  });
}

/** Cost of one month's period totals at a given price entry. */
export function costAt(m, prices) {
  const tou = (m.tou.on * prices.tou.on + m.tou.mid * prices.tou.mid + m.tou.off * prices.tou.off) / 100;
  const ulo = prices.ulo ? (m.ulo.on * prices.ulo.on + m.ulo.mid * prices.ulo.mid + m.ulo.off * prices.ulo.off + m.ulo.overnight * prices.ulo.overnight) / 100 : null;
  const th = tierThreshold(+m.month.slice(5, 7));
  const tiered = (Math.min(m.kwh, th) * prices.tiered.t1 + Math.max(0, m.kwh - th) * prices.tiered.t2) / 100;
  return { tou, ulo, tiered };
}

/** Full history table: each month at the prices then in effect, and at the latest (today's) prices. */
export function historyTable(iv, current = latestPrices()) {
  return monthlyPeriods(iv).map(m => {
    const then = priceOn(m.month + '-01') || priceOn(m.month + '-28');
    // Tiered uses a monthly threshold, so a partial month can't be priced fairly: no Tiered figure for it.
    const atThen = m.hist.priced ? { tou: m.hist.tou, ulo: m.hist.uloAvailable ? m.hist.ulo : null, tiered: then && m.complete ? costAt(m, then).tiered : null } : null;
    const atCurrent = costAt(m, current); if (!m.complete) atCurrent.tiered = null;
    return { ...m, atThen, atCurrent, currentEffective: current.effective };
  });
}
