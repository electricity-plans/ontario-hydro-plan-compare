// Parse a Green Button file and run the data-quality report, support check and price history.
import { parseEspi, pickRegisterChannel } from './espi.js';
import { qualityReport } from './quality.js';
import { historyTable } from './pricing.js';
import { supportLevel } from './support.js';

export function analyze(xml, opts = {}) {
  let parsed;
  try { parsed = parseEspi(xml, opts); }
  catch (e) {
    const report = { issues: [{ level: 'error', code: 'parse', message: `This file could not be read as a Green Button (ESPI) feed: ${e.message}` }], channels: [] };
    return { parsed: null, report, support: { level: 'unsupported', reasons: [report.issues[0].message], profile: null, codes: [e.code === 'duplicate-field' ? 'duplicate-field' : 'parse'] }, history: [], register: null };
  }
  const report = qualityReport(parsed);
  const support = supportLevel(xml, parsed, report);
  const history = report.intervals ? historyTable(report.intervals) : [];
  return { parsed, report, support, history, register: report.selected ? pickRegisterChannel(parsed.channels, report.selected.usagePoint) : null };
}
