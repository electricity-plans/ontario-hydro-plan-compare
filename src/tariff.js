import { PRICES, PERIODS } from '../tariffs/rpp.js';
import { isHoliday } from './holidays.js';

export const EARLIEST_SUPPORTED = PRICES[0].effective;

/** Price entry in effect on a local date (YYYY-MM-DD), or null if before the supported range. */
export function priceOn(dateStr) {
  let cur = null;
  for (const p of PRICES) if (p.effective <= dateStr) cur = p;
  return cur;
}
export const latestPrices = () => PRICES[PRICES.length - 1];

/** Classify one interval by its local start time. lp = localParts(...) */
export function touPeriod(lp) {
  if (lp.weekday >= 6 || isHoliday(lp.date)) return 'off';
  const season = PERIODS.tou.summer.months.includes(lp.month) ? PERIODS.tou.summer : PERIODS.tou.winter;
  for (const r of season.weekday) if (lp.hour >= r.from && lp.hour < r.to) return r.p;
  return 'off';
}
export function uloPeriod(lp) {
  const o = PERIODS.ulo.allYear.overnight;
  if (lp.hour >= o.from || lp.hour < o.to) return 'overnight';
  if (lp.weekday >= 6 || isHoliday(lp.date)) return 'off';
  for (const r of PERIODS.ulo.allYear.weekday) if (lp.hour >= r.from && lp.hour < r.to) return r.p;
  throw new Error('ULO period table has a gap at hour ' + lp.hour);
}
export const tierSeason = month => (PERIODS.tiered.summerMonths.includes(month) ? 'summer' : 'winter');
export const tierThreshold = month => PERIODS.tiered.residentialThreshold[tierSeason(month)];

/**
 * Are the app's prices out of date? New OEB prices normally start every November 1, so once a year has passed since
 * the latest known prices started (plus a week's grace for the update), the app's prices are probably stale.
 * @param today 'YYYY-MM-DD' (Ontario date)
 * @returns {{stale: boolean, latest: string, expectedBy: string}}
 */
export function pricesFreshness(today, prices = PRICES) {
  const latest = prices[prices.length - 1].effective;
  const due = new Date(`${+latest.slice(0, 4) + 1}${latest.slice(4)}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 7);
  const expectedBy = due.toISOString().slice(0, 10);
  return { stale: today > expectedBy, latest, expectedBy };
}
