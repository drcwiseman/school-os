import { DEFAULT_COUNTRY, DEFAULT_CURRENCY, defaultCurrencyForCountry } from "../lib/currencies";

export type TenantLocale = {
  country: string;
  currency: string;
};

/** Resolve school country/currency — Uganda (UG / UGX) when unset. */
export function resolveTenantLocale(settings?: {
  country?: string | null;
  currency?: string | null;
} | null): TenantLocale {
  const rawCountry = (settings?.country ?? "").trim().toUpperCase();
  const country = rawCountry || DEFAULT_COUNTRY;
  const rawCurrency = (settings?.currency ?? "").trim().toUpperCase();
  const currency = rawCurrency || (rawCountry ? defaultCurrencyForCountry(rawCountry) : DEFAULT_CURRENCY);
  return { country, currency };
}
