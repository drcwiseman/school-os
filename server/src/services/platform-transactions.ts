import { db } from "../db";
import {
  payments, expenses, tenants, students, invoices, tenantSettings,
} from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { getPlatformDefaults } from "./platform-settings";
import { convertMinor } from "./currency-exchange";

export type PlatformTransactionRow = {
  id: string;
  type: "payment" | "expense";
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  amount: number;
  currency: string;
  amountDisplayMinor: number;
  method: string | null;
  reference: string | null;
  receiptNo: string | null;
  invoiceNo: string | null;
  studentName: string | null;
  description: string | null;
  category: string | null;
  status: "completed" | "voided";
  occurredAt: string;
};

export type PlatformTransactionsLedger = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    totalTransactions: number;
    paymentCount: number;
    expenseCount: number;
    voidedPayments: number;
    volumeTotal: number;
    volume30d: number;
    expensesTotal: number;
    expenses30d: number;
    netFlow: number;
    schoolsActive: number;
    byMethod: Record<string, number>;
  };
  transactions: PlatformTransactionRow[];
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getPlatformTransactionsLedger(): Promise<PlatformTransactionsLedger> {
  const defaults = await getPlatformDefaults();
  const displayCurrency = defaults.displayCurrency;
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const paymentRows = await db
    .select({
      id: payments.id,
      tenantId: payments.tenantId,
      amount: payments.amount,
      method: payments.method,
      reference: payments.reference,
      receiptNo: payments.receiptNo,
      paidAt: payments.paidAt,
      deletedAt: payments.deletedAt,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      studentFirst: students.firstName,
      studentLast: students.lastName,
      invoiceNo: invoices.invoiceNo,
      currency: tenantSettings.currency,
    })
    .from(payments)
    .innerJoin(tenants, eq(tenants.id, payments.tenantId))
    .innerJoin(students, eq(students.id, payments.studentId))
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, payments.tenantId))
    .orderBy(desc(payments.paidAt))
    .limit(400);

  const expenseRows = await db
    .select({
      id: expenses.id,
      tenantId: expenses.tenantId,
      amount: expenses.amount,
      description: expenses.description,
      category: expenses.category,
      spentAt: expenses.spentAt,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      currency: tenantSettings.currency,
    })
    .from(expenses)
    .innerJoin(tenants, eq(tenants.id, expenses.tenantId))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, expenses.tenantId))
    .orderBy(desc(expenses.spentAt))
    .limit(200);

  const transactions: PlatformTransactionRow[] = [];
  let volumeTotal = 0;
  let volume30d = 0;
  let expensesTotal = 0;
  let expenses30d = 0;
  let paymentCount = 0;
  let expenseCount = 0;
  let voidedPayments = 0;
  const schoolIds = new Set<string>();
  const byMethod: Record<string, number> = {};

  for (const p of paymentRows) {
    const cur = (p.currency ?? "USD").toUpperCase();
    const voided = p.deletedAt != null;
    const displayAmt = await convertMinor(p.amount, cur, displayCurrency);

    if (!voided) {
      paymentCount += 1;
      volumeTotal += displayAmt;
      if (p.paidAt >= cutoff) volume30d += displayAmt;
      const m = (p.method ?? "other").toLowerCase();
      byMethod[m] = (byMethod[m] ?? 0) + displayAmt;
    } else {
      voidedPayments += 1;
    }
    schoolIds.add(p.tenantId);

    transactions.push({
      id: p.id,
      type: "payment",
      tenantId: p.tenantId,
      tenantSlug: p.tenantSlug,
      tenantName: p.tenantName,
      amount: p.amount,
      currency: cur,
      amountDisplayMinor: displayAmt,
      method: p.method,
      reference: p.reference,
      receiptNo: p.receiptNo,
      invoiceNo: p.invoiceNo,
      studentName: `${p.studentFirst} ${p.studentLast}`.trim(),
      description: null,
      category: null,
      status: voided ? "voided" : "completed",
      occurredAt: p.paidAt.toISOString(),
    });
  }

  for (const e of expenseRows) {
    const cur = (e.currency ?? "USD").toUpperCase();
    const displayAmt = await convertMinor(e.amount, cur, displayCurrency);
    expenseCount += 1;
    expensesTotal += displayAmt;
    if (e.spentAt >= cutoff) expenses30d += displayAmt;
    schoolIds.add(e.tenantId);

    transactions.push({
      id: e.id,
      type: "expense",
      tenantId: e.tenantId,
      tenantSlug: e.tenantSlug,
      tenantName: e.tenantName,
      amount: e.amount,
      currency: cur,
      amountDisplayMinor: displayAmt,
      method: null,
      reference: null,
      receiptNo: null,
      invoiceNo: null,
      studentName: null,
      description: e.description,
      category: e.category,
      status: "completed",
      occurredAt: e.spentAt.toISOString(),
    });
  }

  transactions.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const limited = transactions.slice(0, 500);

  return {
    displayCurrency,
    fxProvider: "frankfurter.app + fallbacks",
    summary: {
      totalTransactions: limited.length,
      paymentCount,
      expenseCount,
      voidedPayments,
      volumeTotal,
      volume30d,
      expensesTotal,
      expenses30d,
      netFlow: volumeTotal - expensesTotal,
      schoolsActive: schoolIds.size,
      byMethod,
    },
    transactions: limited,
  };
}
