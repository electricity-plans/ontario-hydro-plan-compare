// Ontario Regulated Price Plan (RPP) data. Data only: no logic.
// Prices in cents per kWh. Each entry applies from `effective` (inclusive) until the next entry.
// Add a new entry each November 1 (and cite it). Do not edit past entries except to fix a transcription error.

export const SOURCES = {
  oebHistorical: { title: 'OEB, Historical electricity rates', url: 'https://oeb.ca/consumer-information-and-protection/electricity-rates/historical-electricity-rates', accessed: '2026-10-21' },
  oeb2026: { title: 'OEB news release, Oct 16 2026: prices effective Nov 1 2026', url: 'https://www.oeb.ca/newsroom/2026/ontario-energy-board-announces-changes-electricity-prices-households-small-businesses', accessed: '2026-10-21' },
  oebHolidays: { title: 'OEB, Holiday schedule - Time-of-Use and Ultra-Low Overnight', url: 'https://www.oeb.ca/consumer-information-and-protection/electricity-rates/holiday-schedule-time-use-and-ultra-low', accessed: '2026-10-21' },
  oeb2023: { title: 'OEB news release, Oct 2023: prices effective Nov 1 2023 (OER 19.3%)', url: 'https://www.oeb.ca/node/4389', accessed: '2026-10-21' },
  oeb2024: { title: 'OEB news release, Oct 2024: prices effective Nov 1 2024 (OER 13.1%)', url: 'https://oeb.ca/node/4893', accessed: '2026-10-21' },
  alectra2023: { title: 'Alectra summer 2023 bill insert (OER 11.7%)', url: 'https://news.alectrautilities.com/sites/default/files/assets/pdf/summer_charts_insert_alectraversion_may30-digital.pdf', accessed: '2026-10-21' },
  entegrus2025: { title: 'Entegrus rates page (OER 23.5% from Nov 1 2025); confirmed on a 2026 Alectra bill', url: 'https://entegrus.com/rates', accessed: '2026-10-21' },
};

// Price periods. Hours are local clock hours [start, end).
export const PERIODS = {
  tou: {
    summer: { months: [5, 6, 7, 8, 9, 10], weekday: [{ from: 7, to: 11, p: 'mid' }, { from: 11, to: 17, p: 'on' }, { from: 17, to: 19, p: 'mid' }] },
    winter: { months: [11, 12, 1, 2, 3, 4], weekday: [{ from: 7, to: 11, p: 'on' }, { from: 11, to: 17, p: 'mid' }, { from: 17, to: 19, p: 'on' }] },
    otherwise: 'off', // weekday 19:00-07:00, weekends and holidays all day
    source: 'oeb2026',
  },
  ulo: {
    allYear: { overnight: { from: 23, to: 7 }, weekday: [{ from: 7, to: 16, p: 'mid' }, { from: 16, to: 21, p: 'on' }, { from: 21, to: 23, p: 'mid' }], weekendHoliday: 'off' },
    source: 'oeb2026',
  },
  tiered: { residentialThreshold: { summer: 600, winter: 1000 }, summerMonths: [5, 6, 7, 8, 9, 10], source: 'oebHistorical' },
};

export const PRICES = [
  { effective: '2022-11-01', tou: { off: 7.4, mid: 10.2, on: 15.1 }, ulo: null, tiered: { t1: 8.7, t2: 10.3 }, oer: 11.7, source: 'oebHistorical', oerSource: 'alectra2023' },
  { effective: '2023-05-01', tou: { off: 7.4, mid: 10.2, on: 15.1 }, ulo: { overnight: 2.4, off: 7.4, mid: 10.2, on: 24.0 }, tiered: { t1: 8.7, t2: 10.3 }, oer: 11.7, source: 'oebHistorical', oerSource: 'alectra2023', note: 'ULO introduced May 1 2023; TOU and Tiered unchanged' },
  { effective: '2023-11-01', tou: { off: 8.7, mid: 12.2, on: 18.2 }, ulo: { overnight: 2.8, off: 8.7, mid: 12.2, on: 28.6 }, tiered: { t1: 10.3, t2: 12.5 }, oer: 19.3, source: 'oebHistorical', oerSource: 'oeb2023' },
  { effective: '2024-11-01', tou: { off: 7.6, mid: 12.2, on: 15.8 }, ulo: { overnight: 2.8, off: 7.6, mid: 12.2, on: 28.4 }, tiered: { t1: 9.3, t2: 11.0 }, oer: 13.1, source: 'oebHistorical', oerSource: 'oeb2024' },
  { effective: '2025-11-01', tou: { off: 9.8, mid: 15.7, on: 20.3 }, ulo: { overnight: 3.9, off: 9.8, mid: 15.7, on: 39.1 }, tiered: { t1: 12.0, t2: 14.2 }, oer: 23.5, source: 'oebHistorical', oerSource: 'entegrus2025' },
  { effective: '2026-11-01', tou: { off: 9.1, mid: 14.6, on: 18.9 }, ulo: { overnight: 3.7, off: 9.1, mid: 14.6, on: 37.7 }, tiered: { t1: 11.2, t2: 13.2 }, oer: 15.7, source: 'oeb2026', oerSource: 'oeb2026' },
];

// Holiday pricing days the OEB has published, used to test the holiday rule generator.
export const PUBLISHED_HOLIDAYS = {
  2026: ['2026-01-01', '2026-02-16', '2026-04-03', '2026-05-18', '2026-07-01', '2026-08-03', '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-28'],
};
