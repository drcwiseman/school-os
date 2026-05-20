import { formatMoneyMinor } from "./currencies";

export const BILLING_INTERVALS = ["monthly", "quarterly", "yearly", "lifetime"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  lifetime: "One-time (lifetime)",
};

export function isBillingInterval(v: string): v is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(v);
}

export function intervalMonthMultiplier(interval: BillingInterval): number {
  switch (interval) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "yearly": return 12;
    case "lifetime": return 0;
    default: return 1;
  }
}

export function computeRenewsAt(startedAt: Date, interval: BillingInterval): Date | null {
  if (interval === "lifetime") return null;
  const d = new Date(startedAt);
  if (interval === "monthly") d.setMonth(d.getMonth() + 1);
  else if (interval === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (interval === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function formatBillingAmount(priceMonthlyMinor: number, interval: BillingInterval, currency: string): string {
  if (interval === "lifetime") return "One-time buyoff";
  const mult = intervalMonthMultiplier(interval);
  const suffix = interval === "monthly" ? "/ mo" : interval === "quarterly" ? "/ qtr" : "/ yr";
  return `${formatMoneyMinor(priceMonthlyMinor * mult, currency)}${suffix}`;
}
