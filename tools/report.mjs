// Usage: node tools/report.mjs <green-button.xml>
// Prints the data-quality report and monthly history. Runs locally; nothing is uploaded.
import { readFileSync } from 'node:fs';
import { analyze } from '../src/index.js';

const file = process.argv[2];
if (!file) { console.error('Usage: node tools/report.mjs <green-button.xml>'); process.exit(1); }
const t0 = Date.now();
const { report, support, history } = analyze(readFileSync(file, 'utf8'));
console.log(`Parsed in ${Date.now() - t0} ms\nSupport level: ${support.level.toUpperCase()}`);
for (const r of support.reasons) console.log('  - ' + r);
console.log('\nChannels:'); for (const c of report.channels) console.log(`  ${c.title}: uom ${c.uom} x10^${c.multiplier}, flow ${c.flow}, accum ${c.accumulation}, ${c.intervalLength}s, ${c.readings} readings (${c.nonZero} non-zero)`);
if (report.coverage) console.log('\nCoverage:', report.coverage);
if (report.consumption) console.log('Consumption:', { ...report.consumption });
console.log('DST days:', report.dst);
console.log('Register:', report.register);
console.log('\nIssues:'); for (const i of report.issues) console.log(`  [${i.level}] ${i.message}`);
console.log('\nMonth     kWh     TOU on/mid/off              ULO on/mid/off/overnight          then:TOU    ULO   Tier | now:TOU    ULO   Tier');
const f = (x, w = 7, d = 1) => (x === null || x === undefined ? '-' : x.toFixed(d)).padStart(w);
for (const m of history) console.log(`${m.month} ${f(m.kwh, 7)}  ${f(m.tou.on)}${f(m.tou.mid)}${f(m.tou.off)}   ${f(m.ulo.on)}${f(m.ulo.mid)}${f(m.ulo.off)}${f(m.ulo.overnight)}   ${f(m.atThen?.tou, 8, 2)}${f(m.atThen?.ulo, 8, 2)}${f(m.atThen?.tiered, 8, 2)} |${f(m.atCurrent.tou, 8, 2)}${f(m.atCurrent.ulo, 8, 2)}${f(m.atCurrent.tiered, 8, 2)}`);
