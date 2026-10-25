// Creates the synthetic files the browser regression tests need, in the folder given (default: system temp).
// Usage: node tests/browser/make-data.mjs <folder>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { feed, demoHouseholdFile, syntheticFiles } from '../synthetic.js';
import { localMidnight, localParts } from '../../src/time.js';
import { analyze, reconcileBill } from '../../src/index.js';

const dir = process.argv[2] || join(tmpdir(), 'pricecompare-browser-tests');
mkdirSync(dir, { recursive: true });
// A full year from a utility the app hasn't verified (the sample household under another web address).
const unverified = demoHouseholdFile().replaceAll('sample-household.example', 'greenbutton.otherutility.example');
writeFileSync(join(dir, 'unverified-year.xml'), unverified);
// The bill figures that file should match for one billing period.
const r = reconcileBill(analyze(unverified).report.intervals, { plan: 'tou', from: '2026-04-10', to: '2026-05-12', kwh: { on: 0, mid: 0, off: 0 } }, {});
writeFileSync(join(dir, 'unv-bill.json'), JSON.stringify({ kwh: Object.fromEntries(r.rows.map(x => [x.period, x.intervalKwh.toFixed(3)])), total: r.intervalTotalKwh.toFixed(3) }));
// A year with only 20 car-charging nights (too few for the car question to appear).
const rd = []; let n = 0, day = 0;
for (let t = localMidnight('2025-10-01'), end = localMidnight('2026-10-01'); t < end; t += 3600) {
  const p = localParts(t); if (p.hour === 0) day++;
  if (p.hour === 23 && n < 20 && day % 15 === 0) { n++; for (let k = 0; k < 3; k++) rd.push([t + k * 3600, 3600, 7800]); t += 7200; continue; }
  rd.push([t, 3600, 800]);
}
writeFileSync(join(dir, 'few-sessions.xml'), feed({ channels: [{ step: 3600, mult: 0, readings: rd }] }));
// Early 2023, before Ultra-Low Overnight existed (May 1 2023), with zero usage in places.
const early = []; for (let t = localMidnight('2023-01-01'), end = localMidnight('2023-04-01'); t < end; t += 3600) early.push([t, 3600, 0]);
writeFileSync(join(dir, 'early-2023-zero.xml'), feed({ channels: [{ step: 3600, mult: 0, readings: early }] }));
// A year of readings that ended long ago (2024).
const oldR = []; for (let t = localMidnight('2023-10-01'), end = localMidnight('2024-10-01'); t < end; t += 3600) oldR.push([t, 3600, 900]);
writeFileSync(join(dir, 'old-file.xml'), feed({ channels: [{ step: 3600, mult: 0, readings: oldR }] }));
for (const [name, xml] of Object.entries(syntheticFiles())) writeFileSync(join(dir, name), xml);   // the made-up test files
// A household whose cheapest plans are within $20 of each other (a "close" result).
writeFileSync(join(dir, 'close-plans.xml'), feed({ channels: [{ step: 3600, mult: 0, readings: (() => { const r = []; for (let t = localMidnight('2025-10-01'), end = localMidnight('2026-10-01'); t < end; t += 3600) r.push([t, 3600, 1400]); return r; })() }] }));
// A large file (two years of 5-minute readings, about 210,000) that takes a few seconds to read, so a test can
// press Cancel while it loads. Used instead of a real export when none is available (as on GitHub).
{ const r = []; for (let t = localMidnight('2024-10-01'), end = localMidnight('2026-10-01'); t < end; t += 300) r.push([t, 300, 80 + (t / 300) % 7]);
  writeFileSync(join(dir, 'large-file.xml'), feed({ channels: [{ step: 300, mult: 0, readings: r }] })); }
console.log(dir);
