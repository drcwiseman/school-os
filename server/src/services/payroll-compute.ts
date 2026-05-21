export type DeductionLine = { name: string; amountMinor: number };

export type TaxRuleInput = { name: string; ratePercent: number; thresholdMinor: number };

export function computePayrollDeductions(
  grossMinor: number,
  taxRules: TaxRuleInput[],
  extraLines: DeductionLine[] = [],
): { deductionsMinor: number; netPayMinor: number; breakdown: DeductionLine[] } {
  const breakdown: DeductionLine[] = [...extraLines];
  let deductionsMinor = extraLines.reduce((s, l) => s + l.amountMinor, 0);

  for (const rule of taxRules) {
    const taxable = Math.max(0, grossMinor - (rule.thresholdMinor ?? 0));
    if (taxable <= 0 || !rule.ratePercent) continue;
    const amt = Math.round(taxable * (rule.ratePercent / 100));
    if (amt > 0) {
      breakdown.push({ name: rule.name, amountMinor: amt });
      deductionsMinor += amt;
    }
  }

  deductionsMinor = Math.min(deductionsMinor, grossMinor);
  return {
    deductionsMinor,
    netPayMinor: grossMinor - deductionsMinor,
    breakdown,
  };
}
