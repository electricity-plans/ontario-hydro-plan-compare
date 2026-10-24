// Synthetic Green Button feeds with hand-checkable answers. Pure ES module: used by the test suite
// (in Node and in the browser) and by tests/make-fixtures.mjs to write the files in tests/fixtures/.
import { localMidnight, localParts } from '../src/time.js';

const HOST = 'https://example-utility.test/espi/1_1/resource';
const ALECTRA_HOST = 'https://alectradc.savagedata.com/DataCustodian/espi/1_1/resource';
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function entry(kind, self, content, title, related = [], up) {
  return `<entry><id>urn:uuid:${kind}-${Math.abs(hash(self))}</id><title>${title}</title><content>${content}</content><link rel="self" href="${self}"/>${up ? `<link rel="up" href="${up}"/>` : ''}${related.map(r => `<link rel="related" href="${r}"/>`).join('')}</entry>`;
}
export function feed({ serviceKind = 0, channels, host = HOST }) {
  const HOST_ = host;
  const e = [];
  e.push(entry('UsagePoint', `${HOST_}/UsagePoint/1`, `<espi:UsagePoint><espi:ServiceCategory><espi:kind>${serviceKind}</espi:kind></espi:ServiceCategory></espi:UsagePoint>`, 'Usage point'));
  e.push(entry('LocalTimeParameters', `${HOST_}/LocalTimeParameters/1`, '<espi:LocalTimeParameters><espi:dstEndRule>B40E2000</espi:dstEndRule><espi:dstOffset>3600</espi:dstOffset><espi:dstStartRule>360E2000</espi:dstStartRule><espi:tzOffset>-18000</espi:tzOffset></espi:LocalTimeParameters>', 'DST'));
  channels.forEach((c, k) => {
    const rt = `${HOST_}/ReadingType/${k}`, mr = `${HOST_}/UsagePoint/${c.up || 1}/MeterReading/${k}`;
    e.push(entry('ReadingType', rt, `<espi:ReadingType><espi:accumulationBehaviour>${c.acc ?? 4}</espi:accumulationBehaviour><espi:commodity>1</espi:commodity><espi:currency>124</espi:currency><espi:dataQualifier>12</espi:dataQualifier><espi:flowDirection>${c.flow ?? 1}</espi:flowDirection><espi:intervalLength>${c.interval ?? c.step}</espi:intervalLength><espi:kind>12</espi:kind><espi:phase>0</espi:phase><espi:powerOfTenMultiplier>${c.mult}</espi:powerOfTenMultiplier><espi:uom>72</espi:uom></espi:ReadingType>`, 'Energy'));
    e.push(entry('MeterReading', mr, '<espi:MeterReading/>', 'Meter reading', [rt]));
    const irs = c.readings.map(([s, d, v]) => `<espi:IntervalReading><espi:timePeriod><espi:duration>${d}</espi:duration><espi:start>${s}</espi:start></espi:timePeriod><espi:value>${v}</espi:value></espi:IntervalReading>`).join('');
    e.push(entry('IntervalBlock', `${mr}/IntervalBlock/1`, `<espi:IntervalBlock><espi:interval><espi:duration>${c.readings.length * c.step}</espi:duration><espi:start>${c.readings[0][0]}</espi:start></espi:interval>${irs}</espi:IntervalBlock>`, 'Block', [mr], `${mr}/IntervalBlock`));
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xmlns:espi="http://naesb.org/espi">\n<id>urn:uuid:synthetic</id><title>Synthetic test feed</title>\n${e.join('\n')}\n</feed>\n`;
}
export function constant(fromDate, toDate, step, raw) {
  const out = [];
  for (let t = localMidnight(fromDate); t < localMidnight(toDate); t += step) out.push([t, step, raw]);
  return out;
}
export function syntheticFiles() {
  return {
    // Thu Oct 30 – Wed Nov 5 2025 (exclusive), includes the 25-hour Nov 2. 0.25 kWh per 15 min = 1 kWh/h. Wh x10^-3 like Alectra.
    'synth-15min-dst-fall.xml': feed({ channels: [{ step: 900, mult: -3, readings: constant('2025-10-30', '2025-11-05', 900, 250000) }] }),
    // Fri Mar 6 – Tue Mar 10 2026 (exclusive), includes the 23-hour Mar 8. 1 kWh/h, Wh x10^0.
    'synth-hourly-dst-spring.xml': feed({ channels: [{ step: 3600, mult: 0, readings: constant('2026-03-06', '2026-03-10', 3600, 1000) }] }),
    // Same as hourly but with one missing hour and one duplicated hour.
    'synth-hourly-gap-dup.xml': (() => { const r = constant('2026-03-06', '2026-03-10', 3600, 1000); r.splice(10, 1); r.splice(30, 0, r[30]); return feed({ channels: [{ step: 3600, mult: 0, readings: r }] }); })(),
    'synth-gas.xml': feed({ serviceKind: 1, channels: [{ step: 3600, mult: 0, readings: constant('2026-03-06', '2026-03-07', 3600, 1000) }] }),
    'synth-not-espi.xml': '<?xml version="1.0"?>\n<rates><rate>9.1</rate></rates>\n',
    ...validationFiles(),
    'synth-alectra-shape.xml': alectraShapeFile(),
  };
}
/** Household 1 kW all day plus a 5 kW charging session every night 23:00–01:00 (10 kWh), all of 2025. */
export function syntheticYear() {
  const iv = [];
  for (let t = localMidnight('2025-01-01'), end = localMidnight('2026-01-01') + 7200; t < end; t += 900) {
    const h = localParts(t).hour;
    iv.push({ start: t, dur: 900, kwh: (h === 23 || h === 0) ? 1.5 : 0.25, quality: [] });
  }
  return iv;
}

/**
 * A made-up sample household for the app's "Try demo data" button: a year of hourly readings with
 * ordinary daily routines, summer air conditioning and an electric car charged most nights from 11 p.m.
 * Deterministic (no randomness between runs). No real person's usage is used.
 */
export function demoHouseholdFile() {
  let seed = 20261101;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const readings = [];
  const start = localMidnight('2025-10-01'), end = localMidnight('2026-10-01');
  let chargeLeft = 0;
  for (let t = start; t < end; t += 3600) {
    const p = localParts(t), h = p.hour, m = p.month, wkend = p.weekday >= 6;
    const winter = [11, 12, 1, 2, 3].includes(m), summer = [6, 7, 8, 9].includes(m);
    let kw = 0.35 + rnd() * 0.15;                                     // fridge, standby, furnace fan
    if (h >= 6 && h < 9) kw += wkend ? 0.4 : 0.9;                     // mornings
    if (h >= 9 && h < 17) kw += wkend ? 0.8 : 0.3;                    // daytime
    if (h >= 17 && h < 21) kw += 0.5 + (winter ? 0.2 : 0);            // cooking, lights
    if (summer && h >= 14 && h < 20) kw += 1.0 + rnd() * 0.6;         // air conditioning
    if (h === 23 && rnd() < 0.9) chargeLeft = (winter ? 16 : 13) + rnd() * 3;    // car plugged in at 11 p.m.
    if (h === 23 || h < 7) { const c = Math.min(7.2, chargeLeft); kw += c; chargeLeft -= c; }
    readings.push([t, 3600, Math.round(kw * 1000)]);
  }
  return feed({ channels: [{ step: 3600, mult: 0, readings }] }).replaceAll('example-utility.test', 'sample-household.example');
}

/** Files that must be rejected (or cleaned) before any calculation. Each is a 4-day hourly file at 1 kWh/h. */
export function validationFiles() {
  const base = () => constant('2026-03-06', '2026-03-10', 3600, 1000);
  const one = readings => feed({ channels: [{ step: 3600, mult: 0, readings }] });
  return {
    'val-identical-duplicate.xml': (() => { const r = base(); r.splice(20, 0, [...r[20]]); return one(r); })(),
    'val-conflicting-duplicate.xml': (() => { const r = base(); r.splice(20, 0, [r[20][0], 3600, 2500]); return one(r); })(),
    'val-overlap.xml': (() => { const r = base(); r.splice(21, 0, [r[20][0] + 900, 900, 250]); return one(r); })(),   // on the 15-minute grid, inside an hourly reading
    'val-bad-value.xml': (() => { const r = base(); r[30] = [r[30][0], 3600, 'abc']; return one(r); })(),
    'val-zero-duration.xml': (() => { const r = base(); r[30] = [r[30][0], 0, 1000]; return one(r); })(),
    'val-daily-in-hourly.xml': feed({ channels: [{ step: 900, mult: 0, readings: constant('2026-03-01', '2026-03-10', 86400, 24000) }] }),
    'val-generation.xml': feed({ channels: [{ step: 3600, mult: 0, readings: base() }, { step: 3600, mult: 0, flow: 19, readings: base().map(([t, d]) => [t, d, 300]) }] }),
    'val-two-meters.xml': feed({ channels: [{ step: 3600, mult: 0, readings: base(), up: 1 }, { step: 3600, mult: 0, readings: base(), up: 2 }] }),
    'val-unaligned.xml': one(constant('2026-03-06', '2026-03-10', 3600, 1000).map(([t, d, v]) => [t + 1800, d, v])),   // 6:30 to 7:30 and so on
    'val-odd-length.xml': feed({ channels: [{ step: 1200, mult: 0, readings: constant('2026-03-06', '2026-03-08', 1200, 333) }] }),   // 20-minute readings
    'val-two-channels.xml': feed({ channels: [{ step: 3600, mult: 0, readings: base() }, { step: 3600, mult: 0, readings: base() }] }),
  };
}

/**
 * A made-up file built the way Alectra's exports are: 15-minute delivered readings in Wh x 10^-3, daily meter-register
 * reads (cumulative, duration 0), Alectra's data-custodian address, across the fall DST change. Usage follows a simple
 * daily pattern so that every price period gets a different total. No real household's data is used.
 */
export function alectraShapeFile() {
  const hourly = [0.4, 0.35, 0.35, 0.35, 0.4, 0.5, 0.9, 1.3, 1.0, 0.7, 0.6, 0.6, 0.7, 0.6, 0.6, 0.8, 1.4, 1.9, 2.2, 1.8, 1.4, 1.1, 0.8, 2.6];
  const readings = [], reads = [];
  let register = 24000000000;   // Wh x 10^-3, like Alectra's register channel
  for (let t = localMidnight('2025-10-30'); t < localMidnight('2025-11-05'); t += 900) {
    const p = localParts(t);
    if (p.hour === 0 && p.minute === 0) reads.push([t, 0, register]);
    const v = Math.round(hourly[p.hour] * 250000 * (p.weekday >= 6 ? 1.15 : 1));   // kWh per 15 min x 10^6
    readings.push([t, 900, v]); register += v;
  }
  return feed({ host: ALECTRA_HOST, channels: [
    { step: 900, mult: -3, readings },
    { step: 900, mult: -3, interval: 86400, acc: 1, readings: reads },
  ] });
}

/**
 * Variants of one small valid file (4 hourly days, 95 kWh) for the XML reader. "same" variants must read exactly like
 * the base file; "refuse" variants must be rejected. Each targets one rule of src/xml.js or the namespace lookups.
 */
export function xmlVariants() {
  const base = feed({ channels: [{ step: 3600, mult: 0, readings: constant('2026-03-06', '2026-03-10', 3600, 1000) }] });
  const block = base.slice(base.indexOf('<entry><id>urn:uuid:IntervalBlock'), base.indexOf('</entry>', base.indexOf('<entry><id>urn:uuid:IntervalBlock')) + 8);
  const fakeBlock = block.replace(/<espi:value>1000<\/espi:value>/g, '<espi:value>999999</espi:value>');
  const atEnd = (x, add) => x.replace('\n</feed>', '\n' + add + '\n</feed>');
  return {
    same: {
      'comment hides a fake entry': atEnd(base, `<!-- ${fakeBlock} -->`),
      'CDATA contains entry markup': base.replace('<title>Synthetic test feed</title>', '<title><![CDATA[<entry><content>not real</content></entry>]]></title>'),
      'quoted > inside an attribute value': base.replace('<link rel="self" href="', '<link data-note="a>b" rel="self" href="'),
      'different namespace prefixes': base.replace('xmlns:espi="http://naesb.org/espi"', 'xmlns:e="http://naesb.org/espi" xmlns:atom="http://www.w3.org/2005/Atom"').replaceAll('espi:', 'e:').replaceAll('<entry>', '<atom:entry>').replaceAll('</entry>', '</atom:entry>'),
      'field from another vocabulary is ignored': base.replace('<espi:value>1000</espi:value>', '<f:value xmlns:f="urn:other">999999</f:value><espi:value>1000</espi:value>'),
      'entry nested inside another element is not an entry': atEnd(base, `<other xmlns="urn:other">${fakeBlock.replace('<entry>', '<entry xmlns="http://www.w3.org/2005/Atom">')}</other>`),
    },
    refuse: {
      'DOCTYPE declaration': base.replace('<feed ', '<!DOCTYPE feed [<!ENTITY x "y">]>\n<feed '),
      'file cut off before the feed closes': base.slice(0, base.length - 200),
      'repeated value in one reading': base.replace('<espi:value>1000</espi:value>', '<espi:value>1000</espi:value><espi:value>5000</espi:value>'),
      'unknown entity': base.replace('<title>Synthetic test feed</title>', '<title>Synthetic &bogus; feed</title>'),
      'text after the end of the feed': base + 'trailing text',
      'markup after the end of the feed': base + '<feed xmlns="http://www.w3.org/2005/Atom"></feed>',
    },
  };
}
