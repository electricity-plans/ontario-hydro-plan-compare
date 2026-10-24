// Runs inside a Web Worker. The engine bundle is prepended to this file at runtime.
self.onmessage = async (ev) => {
  try {
    const xml = await ev.data.file.text();
    let last = 0;
    const a = self.Engine.analyze(xml, { onProgress: f => { if (f - last > 0.02) { last = f; self.postMessage({ type: 'progress', value: f }); } } });
    self.postMessage({ type: 'done', result: slim(a) });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e && e.message || e) });
  }
};
function slim(a) {
  // Drop raw channel readings (large) before sending results back to the page.
  const reg = a.register ? { scale: a.register.scale, readings: a.register.readings.map(r => ({ start: r.start, value: r.value })) } : null;
  // The page only needs each reading's start, length and kWh. Dropping the quality flags, cost and TOU labels
  // halves the cost of copying the readings to the page (measured Oct 2026: 63 ms -> 27 ms for a year of
  // 15-minute data, 124 ms -> 52 ms for two years) and saves memory.
  const profile = a.report.intervals ? self.Engine.hourlyProfile(a.report.intervals) : [];
  const report = a.report.intervals ? { ...a.report, intervals: a.report.intervals.map(x => ({ start: x.start, dur: x.dur, kwh: x.kwh })) } : a.report;
  return { report, support: a.support, history: a.history, register: reg, profile };
}
