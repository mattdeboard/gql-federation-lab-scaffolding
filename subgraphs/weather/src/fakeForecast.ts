// A stand-in for a third-party forecast API. Deterministic: the same project
// and date always get the same forecast, so responses are stable across runs.
//
// It needs a projectId and a date, neither of which the weather subgraph stores.

const FORECASTS = [
  'Clear and dry. Good day for concrete.',
  'Partly cloudy, light winds.',
  'Overcast, chance of afternoon showers.',
  'Rain likely after 1pm. Cover exposed materials.',
  'Gusty winds over 25 mph. Crane picks may be restricted.',
  'Hot. Schedule heavy work for the morning and plan water breaks.',
  'Cold morning; frost possible before 9am.',
];

// A small string hash (FNV-1a), so the choice doesn't depend on Math.random.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function forecastFor(projectId: string, date: string): string {
  return FORECASTS[hash(`${projectId}:${date}`) % FORECASTS.length]!;
}
