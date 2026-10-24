// Average kWh per clock hour, by month: the "shape" of a household's day.
import { localParts } from './time.js';

/** @returns [{month, hours: number[24] (average kWh in that clock hour per day), days}] */
export function hourlyProfile(iv) {
  const m = new Map();
  for (const x of iv) {
    const lp = localParts(x.start);
    const key = lp.date.slice(0, 7);
    let r = m.get(key);
    if (!r) { r = { month: key, sum: new Array(24).fill(0), dayHours: new Array(24).fill(null).map(() => new Set()) }; m.set(key, r); }
    r.sum[lp.hour] += x.kwh;
    r.dayHours[lp.hour].add(lp.date);
  }
  return [...m.values()].map(r => ({ month: r.month, hours: r.sum.map((s, h) => (r.dayHours[h].size ? s / r.dayHours[h].size : 0)), days: Math.max(...r.dayHours.map(d => d.size)) }));
}
