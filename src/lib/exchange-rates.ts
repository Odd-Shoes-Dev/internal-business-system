/**
 * Builds a rates map from the raw exchange_rates rows returned by /api/exchange-rates.
 * The map is keyed by currency code and gives the rate TO convert FROM that currency
 * TO the base currency (e.g. base = UGX: { USD: 3700, EUR: 4000, UGX: 1 }).
 *
 * Usage:
 *   const rates = buildRatesMap(rows, 'UGX');
 *   const ugxAmount = convertCurrency(100, 'USD', 'UGX', rates); // → 370000
 */
export function buildRatesMap(
  rows: { from_currency: string; to_currency: string; rate: number }[],
  baseCurrency: string
): Record<string, number> {
  // Start with 1:1 for base
  const map: Record<string, number> = { [baseCurrency]: 1 };

  // First pass: rates stored as X → base
  rows.forEach((r) => {
    if (r.to_currency === baseCurrency) {
      map[r.from_currency] = Number(r.rate);
    }
  });

  // Second pass: rates stored as base → X  (invert them)
  rows.forEach((r) => {
    if (r.from_currency === baseCurrency && !map[r.to_currency]) {
      const rate = Number(r.rate);
      if (rate > 0) map[r.to_currency] = 1 / rate;
    }
  });

  // Third pass: cross rates via base (X → base → Y)
  rows.forEach((r) => {
    if (r.from_currency !== baseCurrency && r.to_currency !== baseCurrency) {
      if (!map[r.from_currency] && map[r.to_currency]) {
        map[r.from_currency] = Number(r.rate) * map[r.to_currency];
      }
    }
  });

  return map;
}

/**
 * Convert an amount from one currency to another using the rates map.
 * ratesMap values are "how many units of base currency = 1 unit of that currency".
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  ratesMap: Record<string, number>
): number {
  if (from === to) return amount;
  const fromRate = ratesMap[from] ?? 1;
  const toRate = ratesMap[to] ?? 1;
  // amount in FROM → amount in base → amount in TO
  return (amount * fromRate) / toRate;
}

/**
 * Get the exchange rate between two currencies (how many `to` units per 1 `from` unit).
 */
export function getExchangeRate(
  from: string,
  to: string,
  ratesMap: Record<string, number>
): number {
  if (from === to) return 1;
  const fromRate = ratesMap[from] ?? 1;
  const toRate = ratesMap[to] ?? 1;
  return fromRate / toRate;
}

/**
 * Server-side: fetch the global exchange_rates table and build a rates map
 * keyed to the given base currency. Fetch once per request, then use
 * convertCurrency()/getExchangeRate() synchronously for every amount.
 */
export async function getRatesMap(
  db: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  baseCurrency: string
): Promise<Record<string, number>> {
  const result = await db.query(
    `SELECT from_currency, to_currency, rate, effective_date::text FROM exchange_rates ORDER BY effective_date DESC`
  );
  return buildRatesMap(result.rows, baseCurrency);
}
