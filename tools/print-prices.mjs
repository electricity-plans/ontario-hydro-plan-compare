// Prints the app's price table in the same layout as the OEB's "Historical electricity rates" page, and the
// holiday pricing days for a year, so both can be compared side by side with the OEB's pages.
// Usage: node tools/print-prices.mjs [year-for-holidays]      e.g. node tools/print-prices.mjs 2027
import { PRICES, PUBLISHED_HOLIDAYS } from '../tariffs/rpp.js';
import { holidayPricingDays } from '../src/holidays.js';

const f = v => v.toFixed(1).padStart(5);
console.log('Effective     TOU off   mid    on | ULO overnight weekend  mid    on | Tiered lower higher | Rebate');
for (const p of [...PRICES].reverse()) {
  const ulo = p.ulo ? `${f(p.ulo.overnight)}     ${f(p.ulo.off)}  ${f(p.ulo.mid)} ${f(p.ulo.on)}` : '        (no ULO yet)          ';
  console.log(`${p.effective}   ${f(p.tou.off)} ${f(p.tou.mid)} ${f(p.tou.on)} | ${ulo} | ${f(p.tiered.t1)}  ${f(p.tiered.t2)}     | ${p.oer}%`);
}
const year = Number(process.argv[2]) || new Date().getFullYear();
const map = holidayPricingDays(year), days = [...map.keys()].sort();   // Map(date -> holiday name)
console.log(`\nHoliday pricing days in ${year} (weekend prices all day):`);
for (const d of days) console.log(`  ${new Date(d + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' }).padEnd(22)} ${map.get(d)}`);
if (PUBLISHED_HOLIDAYS[year]) {
  const same = JSON.stringify(PUBLISHED_HOLIDAYS[year]) === JSON.stringify(days);
  console.log(same ? `Matches the OEB list recorded in tariffs/rpp.js for ${year}.` : `DIFFERS from the OEB list recorded in tariffs/rpp.js for ${year}: check!`);
} else console.log(`No OEB list recorded for ${year} yet: compare with the OEB's holiday page, then add it to PUBLISHED_HOLIDAYS.`);
