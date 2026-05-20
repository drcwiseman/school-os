/** Format integer cents to a human-readable currency string */
export function formatMoney(cents: number, currency = "UGX"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Convert a decimal amount to integer cents */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert cents to decimal */
export function fromCents(cents: number): number {
  return cents / 100;
}
