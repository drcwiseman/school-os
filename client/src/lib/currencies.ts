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

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  const opt = CURRENCY_OPTIONS.find((c) => c.code === currency);
  const sym = opt?.symbol ?? currency;
  return `${sym} ${(amountMinor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
