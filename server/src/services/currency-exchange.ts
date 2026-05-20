import { CURRENCY_CODES } from "../lib/currencies";

type RateCache = { rates: Record<string, number>; fetchedAt: number };
const cache = new Map<string, RateCache>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

/** USD-per-unit fallback when Frankfurter omits a currency (East Africa–first). */
const STATIC_USD_PER_UNIT: Record<string, number> = {
  UGX: 3700,
  KES: 129,
  TZS: 2650,
  RWF: 1350,
  NGN: 1550,
  GHS: 15.5,
  ZAR: 18.5,
};

async function getUsdRates(): Promise<Record<string, number>> {
  const hit = cache.get("USD");
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.rates;

  const rates: Record<string, number> = { USD: 1 };
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as { rates: Record<string, number> };
      for (const [code, rate] of Object.entries(body.rates ?? {})) {
        if (CURRENCY_CODES.has(code)) rates[code] = rate;
      }
    }
  } catch (err) {
    console.warn("[FX] fetch failed:", (err as Error).message?.slice(0, 80));
  }

  for (const [code, rate] of Object.entries(STATIC_USD_PER_UNIT)) {
    if (rates[code] === undefined) rates[code] = rate;
  }

  cache.set("USD", { rates, fetchedAt: Date.now() });
  return rates;
}

/** Rates as units of each currency per 1 unit of `base`. */
export async function getExchangeRates(base = "USD"): Promise<Record<string, number>> {
  const from = base.toUpperCase();
  if (!CURRENCY_CODES.has(from)) throw new Error(`Unsupported base currency: ${from}`);

  const usd = await getUsdRates();
  if (from === "USD") return { ...usd };

  const rFrom = usd[from];
  if (!rFrom) throw new Error(`Unsupported base currency: ${from}`);

  const out: Record<string, number> = { [from]: 1 };
  for (const [code, r] of Object.entries(usd)) {
    out[code] = code === from ? 1 : r / rFrom;
  }
  return out;
}

/** Convert minor units between currencies (USD pivot; never throws). */
export async function convertMinor(amountMinor: number, from: string, to: string): Promise<number> {
  const src = from.toUpperCase();
  const dst = to.toUpperCase();
  if (src === dst || amountMinor === 0) return amountMinor;

  try {
    const rates = await getUsdRates();
    const rFrom = src === "USD" ? 1 : rates[src];
    const rTo = dst === "USD" ? 1 : rates[dst];
    if (!rFrom || !rTo) {
      console.warn(`[FX] no rate ${src}→${dst}, passthrough`);
      return amountMinor;
    }
    const inUsd = src === "USD" ? amountMinor : amountMinor / rFrom;
    const out = dst === "USD" ? inUsd : inUsd * rTo;
    return Math.round(out);
  } catch (err) {
    console.warn("[FX] convert failed:", (err as Error).message?.slice(0, 80));
    return amountMinor;
  }
}
