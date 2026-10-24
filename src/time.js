// Ontario local time, computed with the browser's built-in IANA time zone data (America/Toronto).
// The ESPI feed's LocalTimeParameters are checked for consistency, but the IANA zone is authoritative.
export const ZONE = 'America/Toronto';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
const WD = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const cache = new Map(); // UTC hour -> parts at that hour; minutes are added locally (all Ontario offsets are whole hours)

/** Local calendar parts for a Unix timestamp (seconds). weekday: 1=Mon..7=Sun */
export function localParts(unixSec) {
  const hourKey = Math.floor(unixSec / 3600);
  let p = cache.get(hourKey);
  if (!p) {
    const o = {};
    for (const x of fmt.formatToParts(new Date(hourKey * 3600 * 1000))) o[x.type] = x.value;
    p = { year: +o.year, month: +o.month, day: +o.day, hour: +o.hour, weekday: WD[o.weekday] };
    p.date = `${o.year}-${o.month}-${o.day}`;
    if (cache.size > 200000) cache.clear();
    cache.set(hourKey, p);
  }
  const minute = Math.floor((unixSec % 3600) / 60);
  return { ...p, minute };
}

/** Unix seconds for local midnight at the start of the given local date (YYYY-MM-DD). */
export function localMidnight(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Try both possible Eastern offsets; pick the one that maps back to 00:00 on that date.
  for (const off of [5, 4]) {
    const t = Date.UTC(y, m - 1, d, off) / 1000;
    const p = localParts(t);
    if (p.date === dateStr && p.hour === 0 && p.minute === 0) return t;
  }
  throw new Error('Cannot resolve local midnight for ' + dateStr);
}

export const addDays = (dateStr, n) => { const [y, m, d] = dateStr.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
export const weekdayOf = dateStr => { const [y, m, d] = dateStr.split('-').map(Number); return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1; };
