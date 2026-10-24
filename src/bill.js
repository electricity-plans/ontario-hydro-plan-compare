// Full-bill reconstruction: electricity line + delivery + regulatory, HST, Ontario Electricity Rebate.
import { UTILITIES, HST_RATE } from '../tariffs/utilities.js';
import { priceOn } from './tariff.js';

// Monthly charges are prorated by billing days / (365/12). This matched a 2026 (non-leap) Alectra bill.
// Whether utilities use 366/12 in leap years isn't confirmed yet; the difference is about a cent. Check with a 2028 bill.
const MONTH_DAYS = 365 / 12;
const cents = x => Math.round(x * 100 + 1e-9) / 100;
const roundBy = (x, how) => (how === 'floor' ? Math.floor(x * 100 + 1e-6) / 100 : cents(x));
export const utilityById = id => UTILITIES.find(u => u.id === id) || null;

/**
 * @param o {utilityId, days, kwh (metered), electricity ($, the commodity line), oerPercent?, billDate?, deliveryFromBill?}
 * @returns {lines: [{label, amount, detail}], subtotal, hst, oer, total, deliverySource}
 */
const invalid = (field, message) => Object.assign(new Error(message), { code: 'INVALID_INPUT', field });
const okNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
export function fullBill(o) {
  if (!okNum(o.days, 1, 400)) throw invalid('days', 'The billing period must be 1 to 400 days.');
  if (!okNum(o.kwh, 0, 1e7)) throw invalid('kwh', 'Usage must be a number of kWh, 0 or more.');
  if (!okNum(o.electricity, 0, 1e7)) throw invalid('electricity', 'The electricity charge must be 0 or more.');
  if (o.deliveryFromBill !== undefined && !okNum(o.deliveryFromBill, 0, 1e7)) throw invalid('delivery', 'Delivery must be 0 or more.');
  if (o.oerPercent !== undefined && !okNum(o.oerPercent, 0, 100)) throw invalid('oerPercent', 'The rebate must be 0 to 100%.');
  const u = utilityById(o.utilityId);
  if (!u) throw new Error('Unknown utility ' + o.utilityId);
  const adj = o.kwh * u.lossFactor;
  const months = o.days / MONTH_DAYS;
  const lines = [{ key: 'electricity', label: 'Electricity', amount: cents(o.electricity), detail: 'From your usage and the RPP prices' }];
  // Delivery
  let delivery, deliverySource;
  if (u.delivery) {
    let d = 0;
    for (const v of Object.values(u.delivery.monthly || {})) d += v * months;
    for (const v of Object.values(u.delivery.perAdjKwh || {})) d += v * adj;
    for (const v of Object.values(u.delivery.perKwh || {})) d += v * o.kwh;
    delivery = cents(d); deliverySource = 'tariff';
  } else if (o.deliveryFromBill !== undefined) { delivery = cents(o.deliveryFromBill); deliverySource = 'bill'; }
  else { delivery = null; deliverySource = 'missing'; }
  lines.push({ key: 'delivery', label: 'Delivery', amount: delivery, detail: deliverySource === 'tariff' ? `Tariff effective ${u.effective}` : deliverySource === 'bill' ? 'Taken from your bill (delivery rates for this utility are not in the app yet)' : 'Not available: enter it from your bill' });
  // Regulatory
  let r = 0;
  for (const v of Object.values(u.regulatory.perAdjKwh)) r += v * adj;
  for (const v of Object.values(u.regulatory.monthly)) r += v * months;
  const regulatory = cents(r);
  lines.push({ key: 'regulatory', label: 'Regulatory', amount: regulatory, detail: `${(Object.values(u.regulatory.perAdjKwh).reduce((a, b) => a + b, 0) * 100).toFixed(2)}¢ per loss-adjusted kWh (${adj.toFixed(3)} kWh = ${o.kwh.toFixed(3)} × ${u.lossFactor}) plus $${Object.values(u.regulatory.monthly).reduce((a, b) => a + b, 0).toFixed(2)} a month, prorated for ${o.days} days` });
  if (delivery === null) return { lines, subtotal: null, hst: null, oer: null, total: null, adjustedKwh: adj, deliverySource };
  const subtotal = cents(lines.reduce((s, l) => s + l.amount, 0));
  const oerPct = o.oerPercent ?? (priceOn(o.billDate || '2099-01-01')?.oer);
  if (oerPct === undefined) throw Object.assign(new Error('There are no rebate figures in the tool for this bill’s date.'), { code: 'UNSUPPORTED_DATE', field: 'billDate' });
  const hst = roundBy(subtotal * HST_RATE, u.rounding.hst);
  const oer = roundBy(subtotal * oerPct / 100, u.rounding.oer);
  return { lines, subtotal, hst, oer, oerPercent: oerPct, total: cents(subtotal + hst - oer), adjustedKwh: adj, deliverySource };
}

/**
 * How a difference on the electricity line carries through to the amount due.
 * Delivery and regulatory charges do not depend on the price plan, so only the electricity line differs;
 * HST is added on it and the OER is deducted from it.
 */
export const billFactor = oerPercent => 1 + HST_RATE - oerPercent / 100;
