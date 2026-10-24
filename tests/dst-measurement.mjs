// How much does the forecast's 24-hour day differ from real clock hours around daylight saving?
// Controlled case chosen to make the effect as large as possible:
//   household 1 kW all day, plus a car adding 3 kW from midnight to 4 a.m. every night (crossing the repeated and
//   missing 1-2 a.m. hour). History: Nov 2025 - Oct 2026; forecast: Nov 2026 - Oct 2027. Both years contain one
//   23-hour and one 25-hour day.
// Reference: the same rules applied to every real hour of the forecast year, priced by the same engine.
// Usage: node tests/dst-measurement.mjs     (also run by the test suite, which checks the result stays small)
import { localMidnight, localParts } from '../src/time.js';
import { forecast } from '../src/forecast.js';
import { monthlyPeriods, costAt } from '../src/pricing.js';
import { priceOn } from '../src/tariff.js';
import { billFactor } from '../src/bill.js';

const kwAt = h => 1 + (h < 4 ? 3 : 0);
const series = (from, to) => { const iv = []; for (let t = localMidnight(from); t < localMidnight(to); t += 3600) iv.push({ start: t, dur: 3600, kwh: kwAt(localParts(t).hour), quality: [] }); return iv; };

export function dstMeasurement() {
  const history = series('2025-11-01', '2026-11-01');
  const f = forecast(history, { startMonth: '2026-11' });
  const model = f.scenarios.mid;
  const actual = monthlyPeriods(series('2026-11-01', '2027-11-01'));
  const rows = model.map((r, i) => {
    const a = actual[i], p = priceOn(`${a.month}-01`), c = costAt(a, p), k = billFactor(p.oer);
    return { month: r.month, modelKwh: r.kwh, actualKwh: a.kwh, model: r.billCost, actual: { tou: c.tou * k, ulo: c.ulo * k, tiered: c.tiered * k } };
  });
  const sum = (sel) => rows.reduce((s, r) => s + sel(r), 0);
  const plans = ['tou', 'ulo', 'tiered'];
  const res = {
    kwh: { model: sum(r => r.modelKwh), actual: sum(r => r.actualKwh) },
    cost: Object.fromEntries(plans.map(p => [p, { model: sum(r => r.model[p]), actual: sum(r => r.actual[p]) }])),
  };
  // What matters for a recommendation: the difference between plans.
  res.gap = { model: res.cost.tou.model - res.cost.ulo.model, actual: res.cost.tou.actual - res.cost.ulo.actual };
  res.dstMonths = rows.filter(r => Math.abs(r.modelKwh - r.actualKwh) > 1e-6).map(r => ({ month: r.month, modelKwh: +r.modelKwh.toFixed(2), actualKwh: +r.actualKwh.toFixed(2) }));
  return res;
}

if (process.argv[1] && process.argv[1].endsWith('dst-measurement.mjs')) {
  const r = dstMeasurement(), d = (a, b) => (a - b >= 0 ? '+' : '') + (a - b).toFixed(2);
  console.log(`Annual energy: forecast ${r.kwh.model.toFixed(2)} kWh, real hours ${r.kwh.actual.toFixed(2)} kWh (${d(r.kwh.model, r.kwh.actual)} kWh)`);
  for (const [p, c] of Object.entries(r.cost)) console.log(`${p.padEnd(6)} after tax and rebate: forecast $${c.model.toFixed(2)}, real hours $${c.actual.toFixed(2)} (${d(c.model, c.actual)} $)`);
  console.log(`TOU minus ULO: forecast $${r.gap.model.toFixed(2)}, real hours $${r.gap.actual.toFixed(2)} (${d(r.gap.model, r.gap.actual)} $)`);
  console.log('Months where energy differs:', JSON.stringify(r.dstMonths));
}
