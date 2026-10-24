// ESPI (NAESB REQ.21 Green Button) feed -> normalized channels.
// Never trusts the utility's `cost` or `tou` fields for pricing; keeps them only as evidence.
import { scanEntries, child, kids, text, ATOM_NS as XML_ATOM_NS } from './xml.js';

export const ESPI_NS = 'http://naesb.org/espi';
export const ATOM_NS = 'http://www.w3.org/2005/Atom';

// Code tables (subset used by this app), from espi.xsd enumerations.
export const UOM = { 72: 'Wh', 38: 'W', 169: 'kWh?', 0: 'none' };
export const FLOW = { 1: 'delivered', 4: 'net', 19: 'received' };
export const ACCUM = { 1: 'bulkQuantity', 3: 'cumulative', 4: 'deltaData', 6: 'indicating', 9: 'summation', 12: 'instantaneous' };
export const KIND = { 12: 'energy', 8: 'demand', 37: 'power' };
export const QUALITY = { 0: 'valid', 7: 'manually edited', 8: 'estimated using reference day', 9: 'estimated using linear interpolation', 10: 'questionable', 11: 'derived', 12: 'projected', 13: 'mixed', 14: 'raw', 15: 'normalized for weather', 16: 'other', 17: 'validated', 18: 'verified', 19: 'revenue-quality' };
export const ESTIMATED_QUALITY = new Set([7, 8, 9, 12, 13]);

const norm = h => (h || '').replace(/\/+$/, '');
// Fields are matched by namespace as well as name, so an element from another vocabulary can't stand in for one.
const ec = (el, l) => child(el, l, ESPI_NS), eks = (el, l) => kids(el, l, ESPI_NS);
const et = (el, l) => { const k = kids(el, l, ESPI_NS); if (k.length > 1) throw Object.assign(new Error(`An ESPI <${l}> appears more than once where only one is allowed`), { code: 'duplicate-field' }); return k.length ? k[0].text.trim() : undefined; };
const ac = (el, l) => child(el, l, XML_ATOM_NS), aks = (el, l) => kids(el, l, XML_ATOM_NS), at = (el, l) => text(el, l, XML_ATOM_NS);
const num = s => (s === undefined || s === '' ? undefined : Number(s));

/**
 * Parse an ESPI Atom feed string.
 * @returns {{usagePoints, readingTypes, meterReadings, channels, localTime, problems}}
 */
export function parseEspi(xml, { onProgress } = {}) {
  const problems = [];
  const readingTypes = new Map();   // self href -> ReadingType
  const meterReadings = new Map();  // self href -> {self, readingTypeHref, title}
  const blocks = [];                // {upHref, readings[]}
  const usagePoints = [];
  let localTime = null;
  let entryCount = 0;

  for (const entry of scanEntries(xml)) {
    entryCount++;
    if (onProgress && entryCount % 100 === 0) onProgress(entry.endOffset / xml.length);
    const links = aks(entry, 'link').map(l => ({ rel: l.attrs.rel, href: norm(l.attrs.href) }));
    const self = links.find(l => l.rel === 'self')?.href;
    const up = links.find(l => l.rel === 'up')?.href;
    const related = links.filter(l => l.rel === 'related').map(l => l.href);
    const content = ac(entry, 'content');
    const res = content && content.children.find(c => c.uri === ESPI_NS);
    if (!res) { if (content && content.children.length) problems.push(`An entry has non-ESPI content`); continue; }
    const title = at(entry, 'title');
    switch (res.local) {
      case 'UsagePoint': {
        const kind = num(et(ec(res, 'ServiceCategory'), 'kind'));
        usagePoints.push({ self, title, serviceKind: kind });
        break;
      }
      case 'LocalTimeParameters':
        localTime = { tzOffset: num(et(res, 'tzOffset')), dstOffset: num(et(res, 'dstOffset')), dstStartRule: et(res, 'dstStartRule'), dstEndRule: et(res, 'dstEndRule') };
        break;
      case 'ReadingType': {
        const f = {};
        for (const c of res.children) if (c.uri === ESPI_NS) { if (c.local in f) throw Object.assign(new Error(`An ESPI <${c.local}> appears twice in a ReadingType`), { code: 'duplicate-field' }); f[c.local] = c.text.trim(); }
        readingTypes.set(self, {
          self, title,
          uom: num(f.uom), powerOfTenMultiplier: num(f.powerOfTenMultiplier) ?? 0, flowDirection: num(f.flowDirection),
          accumulationBehaviour: num(f.accumulationBehaviour), kind: num(f.kind), commodity: num(f.commodity),
          intervalLength: num(f.intervalLength), currency: num(f.currency), raw: f,
        });
        break;
      }
      case 'MeterReading': {
        // Its ReadingType is whichever related link points at a ReadingType resource.
        const rt = related.find(h => /\/ReadingType\//.test(h));
        meterReadings.set(self, { self, title, readingTypeHref: rt });
        break;
      }
      case 'IntervalBlock': {
        const readings = [];
        for (const ir of eks(res, 'IntervalReading')) {
          if (eks(ir, 'timePeriod').length !== 1) throw Object.assign(new Error('A reading must have exactly one ESPI <timePeriod>'), { code: 'duplicate-field' });
          const tp = ec(ir, 'timePeriod');
          const q = eks(ir, 'ReadingQuality').map(r => num(et(r, 'quality')));
          readings.push({
            start: num(et(tp, 'start')), duration: num(et(tp, 'duration')), value: num(et(ir, 'value')),
            cost: num(et(ir, 'cost')), tou: num(et(ir, 'tou')), quality: q,
          });
        }
        // IntervalBlock "up" = <MeterReading self>/IntervalBlock ; "related" usually = MeterReading self
        const mr = related.find(h => meterReadings.has(h)) || (up ? up.replace(/\/IntervalBlock$/, '') : undefined) || related[0];
        blocks.push({ meterReadingHref: mr, readings });
        break;
      }
      default: break;
    }
  }
  if (!entryCount) problems.push('The feed contains no entries');

  // Assemble channels: one per MeterReading.
  const channels = [];
  for (const mr of meterReadings.values()) {
    const rt = readingTypes.get(mr.readingTypeHref);
    if (!rt) { problems.push(`MeterReading "${mr.title}" has no ReadingType`); continue; }
    const readings = [];
    for (const b of blocks) if (b.meterReadingHref === mr.self) for (const r of b.readings) readings.push(r);
    readings.sort((a, b) => a.start - b.start);
    const up = (mr.self.match(/\/UsagePoint\/([^/]+)\/MeterReading\//) || [])[1] || null;
    channels.push({ id: mr.self.split('/').pop(), title: rt.title || mr.title, readingType: rt, readings, scale: Math.pow(10, rt.powerOfTenMultiplier), usagePoint: up });
  }
  const orphan = blocks.filter(b => !meterReadings.has(b.meterReadingHref)).length;
  if (orphan) problems.push(`${orphan} IntervalBlock(s) could not be linked to a MeterReading`);
  return { usagePoints, readingTypes: [...readingTypes.values()], meterReadings: [...meterReadings.values()], channels, localTime, problems };
}

/** Convert a raw reading value to kWh using the ReadingType's uom and multiplier. Returns undefined for unsupported units. */
export function toKwh(rawValue, rt) {
  const v = rawValue * Math.pow(10, rt.powerOfTenMultiplier || 0);
  if (rt.uom === 72) return v / 1000;      // Wh -> kWh
  return undefined;                        // anything else is not interval energy we understand
}

const eligible = c => c.readingType.uom === 72 && c.readingType.accumulationBehaviour === 4 && c.readingType.intervalLength > 0 && c.readingType.intervalLength <= 3600;

/**
 * Choose the household consumption channel, or explain why none can be chosen safely.
 * Delivered energy (flow 1) is preferred; a net channel (flow 4) is used only when it is the only one.
 * More than one candidate is never resolved by guessing.
 * @returns {{channel, error?: {code, message}}}
 */
export function selectConsumption(channels) {
  const delivered = channels.filter(c => eligible(c) && c.readingType.flowDirection === 1);
  const net = channels.filter(c => eligible(c) && c.readingType.flowDirection === 4);
  const pick = list => {
    if (list.length === 1) return { channel: list[0] };
    if (new Set(list.map(c => c.usagePoint)).size > 1) return { channel: null, error: { code: 'multiple-meters', message: 'This file has readings from more than one meter. Download the file for one meter (one address) at a time.' } };
    return { channel: null, error: { code: 'ambiguous-channels', message: 'This file has more than one set of usage readings, and we can’t tell which one your bill uses.' } };
  };
  if (delivered.length) return pick(delivered);
  if (net.length) return pick(net);
  return { channel: null, error: { code: 'no-consumption', message: 'No interval energy channel (Wh, delivered, 1-hour or shorter intervals) was found in this file.' } };
}
/** Kept for existing callers: the chosen channel, or null. */
export const pickConsumptionChannel = channels => selectConsumption(channels).channel;

/** Register reads (bulkQuantity / summation, Wh, delivered) for the same meter as the consumption channel. */
export function pickRegisterChannel(channels, usagePoint) {
  return channels.find(c => c.readingType.uom === 72 && [1, 3, 9].includes(c.readingType.accumulationBehaviour) && c.readingType.flowDirection === 1 && (usagePoint === undefined || c.usagePoint === usagePoint)) || null;
}

/** The ESPI LocalTimeParameters values Ontario utilities should publish (North American Eastern rules). */
export const EASTERN_LTP = { tzOffset: -18000, dstOffset: 3600, dstStartRule: '360E2000', dstEndRule: 'B40E2000' };
