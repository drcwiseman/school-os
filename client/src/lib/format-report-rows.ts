/** Money fields returned from reports APIs (integer minor units). */
const MONEY_KEYS = new Set([
  "totalAmount",
  "paidAmount",
  "balance",
  "amount",
  "totalInvoiced",
  "totalPaid",
  "debitMinor",
  "creditMinor",
]);

export function formatReportRowsForDisplay(
  rows: unknown[],
  formatMoney: (minor: number | undefined | null) => string,
): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return { value: row };
    const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const key of Object.keys(out)) {
      if (MONEY_KEYS.has(key) && typeof out[key] === "number") {
        out[`${key}Formatted`] = formatMoney(out[key] as number);
      }
    }
    return out;
  });
}
