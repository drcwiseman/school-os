export const BILLING_INTERVALS = ["monthly", "quarterly", "yearly", "lifetime"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  lifetime: "One-time (lifetime buyoff)",
};

export function formatPeriodPrice(
  periodAmount: number | null,
  priceMonthly: number | null,
  interval: BillingInterval | null,
  currency: string,
  formatMoneyMinor: (n: number, c: string) => string,
): string {
  if (!interval || !currency) return "—";
  if (interval === "lifetime") {
    if (periodAmount != null) return `${formatMoneyMinor(periodAmount, currency)} one-time`;
    return "One-time buyoff";
  }
  if (periodAmount != null) {
    const suffix = interval === "monthly" ? "/ mo" : interval === "quarterly" ? "/ qtr" : "/ yr";
    return `${formatMoneyMinor(periodAmount, currency)}${suffix}`;
  }
  if (priceMonthly != null) return `${formatMoneyMinor(priceMonthly, currency)}/ mo`;
  return "—";
}
