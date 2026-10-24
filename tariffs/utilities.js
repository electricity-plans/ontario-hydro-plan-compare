// Utility (distributor) tariffs for full-bill mode. Data only.
// Rates in dollars. "perAdjKwh" rates apply to loss-adjusted kWh (metered kWh x loss factor).
// "monthly" charges are prorated by billing days / (365/12).
// A null `delivery` means the delivery rates have not been entered yet: the app then takes
// the Delivery line from the user's bill instead of computing it.

export const UTILITY_SOURCES = {
  oeb2026alectra: { title: 'OEB Final Rate Order EB-2025-0055, Alectra Utilities, Schedule A: Tariff of Rates and Charges effective Jan 1 2026', url: 'https://www.rds.oeb.ca/CMWebDrawer/Record/927401/File/document', accessed: '2026-10-21' },
  alectraPrz2022: { title: 'Alectra PowerStream RZ Tariff of Rates and Charges, Jan 1 2022 (loss factor 1.0369)', url: 'https://alectrautilities.com/sites/default/files/assets/pdf/2022TariffSheets_PowerStreamRZ.pdf', accessed: '2026-10-21' },
  ontarioHst: { title: 'HST 13% in Ontario (applies to the whole electricity bill before the OER is deducted)', url: 'https://www.ontario.ca/page/harmonized-sales-tax', accessed: '2026-10-21' },
};

export const UTILITIES = [
  {
    id: 'alectra-powerstream',
    name: 'Alectra Utilities, PowerStream rate zone (Aurora, Barrie, Markham, Richmond Hill, Vaughan and area)',
    effective: '2026-01-01',
    lossFactor: 1.0369,                 // Total loss factor, secondary metered < 5,000 kW; matches a 2026 Alectra bill
    regulatory: {
      perAdjKwh: { 'Wholesale Market Service': 0.0041, 'Capacity Based Recovery': 0.0006, 'Rural or Remote Rate Protection': 0.0006 },
      monthly: { 'Standard Supply Service administration': 0.25 },
      source: 'oeb2026alectra',
    },
    delivery: null,                     // PowerStream RZ residential page still to be transcribed
    rounding: { hst: 'floor', oer: 'floor' }, // consistent with one Alectra bill (2026); confirm with more bills
    source: 'oeb2026alectra',
  },
];

export const HST_RATE = 0.13;
