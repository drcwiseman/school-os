export type CurrencyOption = { code: string; name: string; symbol: string };

/** Uganda-first defaults for SchoolOS (East Africa). */
export const DEFAULT_COUNTRY = "UG";
export const DEFAULT_CURRENCY = "UGX";

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "KES", name: "Kenyan Shilling", symbol: "Ksh" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
];

export const COUNTRY_OPTIONS = [
  { code: "UG", name: "Uganda" },
  { code: "KE", name: "Kenya" },
  { code: "TZ", name: "Tanzania" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "ZA", name: "South Africa" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
];

const COUNTRY_CURRENCY: Record<string, string> = {
  UG: "UGX",
  KE: "KES",
  TZ: "TZS",
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  US: "USD",
  GB: "GBP",
  IN: "INR",
  AE: "AED",
  AU: "AUD",
  CA: "CAD",
};

export function currencyForCountry(countryCode: string): string {
  const cc = countryCode.toUpperCase().trim();
  if (!cc) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY[cc] ?? DEFAULT_CURRENCY;
}

/** ISO 4217 currencies with no minor unit — amounts are still stored ×100 in the DB. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "UGX", "KES", "TZS", "RWF", "JPY", "KRW", "VND", "IDR", "CLP", "PYG", "XAF", "XOF",
]);

export function currencyFractionDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

export function moneyInputStep(currency: string): string {
  return currencyFractionDigits(currency) === 0 ? "1" : "0.01";
}

export function minorFromMajor(major: number, _currency?: string): number {
  return Math.round(major * 100);
}

export function majorFromMinor(minor: number): number {
  return minor / 100;
}

export function countryLabel(countryCode: string): string {
  const cc = countryCode.toUpperCase().trim();
  return COUNTRY_OPTIONS.find((c) => c.code === cc)?.name ?? cc;
}

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const major = amountMinor / 100;
  const digits = currencyFractionDigits(code);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    const opt = CURRENCY_OPTIONS.find((c) => c.code === code);
    const sym = opt?.symbol ?? code;
    return `${sym} ${major.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
}
