import { formatMoneyMinor } from "../lib/currencies";

/** Format integer minor units (cents) using the tenant currency. */
export function formatMoney(cents: number, currency = "UGX"): string {
  return formatMoneyMinor(cents, currency);
}

/** Convert a decimal amount to integer minor units. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert minor units to decimal major amount. */
export function fromCents(cents: number): number {
  return cents / 100;
}
