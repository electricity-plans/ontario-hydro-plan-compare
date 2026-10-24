// How far the app's results can be trusted for a given file.
// "Verified" means: this exact export profile has been reconciled against a real bill.
export const VERIFIED_PROFILES = [
  { id: 'alectra-savagedata-15min-wh', utility: 'Alectra Utilities', hostname: 'alectradc.savagedata.com', intervalSeconds: 900, uom: 72, multiplier: -3, verifiedWith: 'A real Alectra bill (2026): every period’s kWh matched to 0.001 kWh' },
];

export function supportLevel(xml, parsed, report) {
  const reasons = [];
  if (report.issues.some(i => i.level === 'error')) return { level: 'unsupported', reasons: report.issues.filter(i => i.level === 'error').map(i => i.message), profile: null, codes: report.issues.map(i => i.code) };
  const upId = report.selected?.usagePoint;
  const up = parsed.usagePoints.find(u => upId && (u.self || '').endsWith('/UsagePoint/' + upId)) || parsed.usagePoints[0];
  if (up && up.serviceKind !== undefined && up.serviceKind !== 0) return { level: 'unsupported', reasons: [`This is not an electricity usage point (ServiceCategory kind ${up.serviceKind}).`], profile: null, codes: ['not-electricity'] };
  const c = report.consumption;
  // Data custodian = the exact hostname of the selected channel's ReadingType link. This says which export format
  // the file is in; it doesn't authenticate the file or prove its readings are right.
  const sel = report.selected && parsed.channels.find(ch => ch.id === report.selected.id && ch.usagePoint === report.selected.usagePoint);
  let host = 'unknown';
  try { host = new URL(sel?.readingType.self || '').hostname.toLowerCase() || 'unknown'; } catch { host = 'unknown'; }
  const profile = { host, intervalSeconds: c.intervalSeconds, uom: c.uom ?? 72, multiplier: c.multiplier, flow: c.flow, generation: report.issues.some(i => i.code === 'generation') };
  const match = VERIFIED_PROFILES.find(v => v.hostname === host);
  if (!match) reasons.push(`Data from ${host} has not yet been checked against a real bill from that utility.`);
  else {
    if (c.intervalSeconds !== match.intervalSeconds) reasons.push(`Interval length is ${c.intervalSeconds / 60} minutes; only ${match.intervalSeconds / 60}-minute data has been verified.`);
    if (c.multiplier !== match.multiplier) reasons.push(`Values use a 10^${c.multiplier} multiplier; only 10^${match.multiplier} has been verified.`);
    if ((c.uom ?? 72) !== match.uom) reasons.push('The readings use units that haven’t been verified.');
    if (c.flow !== 1) reasons.push('The readings aren’t delivered energy (flow direction 1), which is the only kind verified.');
  }
  if (profile.generation) reasons.push('The file includes generation (net metering), which is not modelled.');
  if (report.issues.some(i => ['gaps', 'duplicates', 'dst', 'mixed-lengths', 'length-mismatch'].includes(i.code))) reasons.push('The data has gaps, repeated readings or daylight-saving irregularities (see the data-quality report).');
  if (report.issues.some(i => i.code === 'net-only')) reasons.push('Only net readings are in the file; this has not been checked against a bill.');
  return { level: reasons.length ? 'unverified' : 'verified', reasons, profile, verifiedProfile: match || null, codes: report.issues.map(i => i.code) };
}

/**
 * Text for a public compatibility report. Allowlisted metadata only: never readings, and never text copied
 * from the file (channel titles, error text), because that can contain identifying details.
 */
export function featureRequestText(support, report) {
  const c = report.consumption || {};
  return [
    '### Compatibility report: Green Button file', '',
    `- Data custodian host: ${support.profile?.host ?? 'unknown'}`,
    `- Interval length: ${c.intervalSeconds ? c.intervalSeconds / 60 + ' min' : 'unknown'}`,
    `- Units: uom ${c.uom ?? '?'} x 10^${c.multiplier ?? '?'}`,
    `- Channels: ${report.channels.map(ch => `uom ${ch.uom} x10^${ch.multiplier}, flow ${ch.flow}, accumulation ${ch.accumulation}, ${ch.intervalLength}s, ${ch.readings} readings`).join('; ')}`,
    `- Coverage: ${report.coverage ? report.coverage.months + ' months' : 'unknown'}`,
    `- Support level: ${support.level}`,
    `- Issue codes: ${report.issues.map(i => i.code).join(', ') || 'none'}`, '',
    '(No usage values or text from the file are included in this report.)',
  ].join('\n');
}
