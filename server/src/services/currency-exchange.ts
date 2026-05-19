import { CURRENCY_CODES } from "../lib/currencies";

type RateCache = { rates: Record<string, number>; fetchedAt: number };
const cache = new Map<string, RateCache>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

/** Free FX via Frankfurter (ECB data, no API key). */
export async function getExchangeRates(base: string): Promise<Record<string, number>> {
  const from = base.toUpperCase();
  if (!CURRENCY_CODES.has(from)) throw new Error(`Unsupported base currency: ${from}`);

  const hit = cache.get(from);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.rates;

  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Exchange rate service unavailable (${res.status})`);

  const body = (await res.json()) as { rates: Record<string, number> };
  const rates: Record<string, number> = { [from]: 1 };
  for (const [code, rate] of Object.entries(body.rates ?? {})) {
    if (CURRENCY_CODES.has(code)) rates[code] = rate;
  }
  for (const code of CURRENCY_CODES) {
    if (rates[code] === undefined && code === from) rates[code] = 1;
  }

  cache.set(from, { rates, fetchedAt: Date.now() });
  return rates;
}

/** Convert minor units (cents) between currencies. */
export async function convertMinor(amountMinor: number, from: string, to: string): Promise<number> {
  const src = from.toUpperCase();
  const dst = to.toUpperCase();
  if (src === dst) return amountMinor;
  const rates = await getExchangeRates(src);
  const rate = rates[dst];
  if (!rate) throw new Error(`No FX rate ${src} → ${dst}`);
  return Math.round(amountMinor * rate);
}
