/** East Africa–first product defaults (Uganda). */
export const DEFAULT_COUNTRY = "UG";
export const DEFAULT_CURRENCY = "UGX";

/** ISO 4217 currencies supported for tenant billing & platform display. */
export type CurrencyInfo = {
  code: string;
  name: string;
  symbol: string;
  /** ISO 3166-1 alpha-2 — primary countries using this currency */
  countries: string[];
};

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$", countries: ["US", "EC", "SV"] },
  { code: "EUR", name: "Euro", symbol: "€", countries: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI"] },
  { code: "GBP", name: "British Pound", symbol: "£", countries: ["GB"] },
  { code: "KES", name: "Kenyan Shilling", symbol: "Ksh", countries: ["KE"] },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", countries: ["UG"] },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", countries: ["TZ"] },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", countries: ["RW"] },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", countries: ["NG"] },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", countries: ["GH"] },
  { code: "ZAR", name: "South African Rand", symbol: "R", countries: ["ZA"] },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", countries: ["EG"] },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD", countries: ["MA"] },
  { code: "INR", name: "Indian Rupee", symbol: "₹", countries: ["IN"] },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", countries: ["PK"] },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", countries: ["BD"] },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", countries: ["AE"] },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", countries: ["SA"] },
  { code: "QAR", name: "Qatari Riyal", symbol: "QR", countries: ["QA"] },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", countries: ["AU"] },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", countries: ["CA"] },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", countries: ["CH"] },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", countries: ["JP"] },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", countries: ["CN"] },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", countries: ["SG"] },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", countries: ["MY"] },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", countries: ["PH"] },
  { code: "THB", name: "Thai Baht", symbol: "฿", countries: ["TH"] },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", countries: ["ID"] },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", countries: ["VN"] },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", countries: ["BR"] },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", countries: ["MX"] },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", countries: ["TR"] },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", countries: ["PL"] },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", countries: ["SE"] },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", countries: ["NO"] },
  { code: "DKK", name: "Danish Krone", symbol: "kr", countries: ["DK"] },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", countries: ["NZ"] },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", countries: ["HK"] },
];

export const CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase());
}

export function defaultCurrencyForCountry(countryCode: string): string {
  const cc = countryCode.toUpperCase().trim();
  if (!cc) return DEFAULT_CURRENCY;
  const hit = SUPPORTED_CURRENCIES.find((c) => c.countries.includes(cc));
  return hit?.code ?? DEFAULT_CURRENCY;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "UGX", "KES", "TZS", "RWF", "JPY", "KRW", "VND", "IDR", "CLP", "PYG", "XAF", "XOF",
]);

export function currencyFractionDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
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
    const info = getCurrencyInfo(code);
    const sym = info?.symbol ?? code;
    return `${sym} ${major.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
}
