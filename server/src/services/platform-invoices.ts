import { db } from "../db";
import { invoices, tenants, students, tenantSettings } from "../db/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { getPlatformDefaults } from "./platform-settings";
import { convertMinor } from "./currency-exchange";

export type PlatformInvoiceRow = {
  id: string;
  invoiceNo: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  studentName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  totalDisplayMinor: number;
  paidDisplayMinor: number;
  balanceDisplayMinor: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  overdue: boolean;
};

export type PlatformInvoicesLedger = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    totalInvoices: number;
    unpaidCount: number;
    overdueCount: number;
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    schoolsWithInvoices: number;
  };
  invoices: PlatformInvoiceRow[];
};

export async function getPlatformInvoicesLedger(): Promise<PlatformInvoicesLedger> {
  const defaults = await getPlatformDefaults();
  const displayCurrency = defaults.displayCurrency;
  const now = new Date();

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      tenantId: invoices.tenantId,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      studentFirst: students.firstName,
      studentLast: students.lastName,
      currency: tenantSettings.currency,
    })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .innerJoin(students, eq(students.id, invoices.studentId))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, invoices.tenantId))
    .where(isNull(invoices.deletedAt))
    .orderBy(desc(invoices.createdAt))
    .limit(500);

  let totalInvoiced = 0;
  let totalPaid = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  const schoolIds = new Set<string>();

  const invoiceRows: PlatformInvoiceRow[] = [];

  for (const r of rows) {
    const cur = (r.currency ?? "USD").toUpperCase();
    const balance = Math.max(0, r.totalAmount - r.paidAmount);
    const totalDisplayMinor = await convertMinor(r.totalAmount, cur, displayCurrency);
    const paidDisplayMinor = await convertMinor(r.paidAmount, cur, displayCurrency);
    const balanceDisplayMinor = await convertMinor(balance, cur, displayCurrency);

    totalInvoiced += totalDisplayMinor;
    totalPaid += paidDisplayMinor;
    schoolIds.add(r.tenantId);

    const isUnpaid = balance > 0 || r.status === "unpaid" || r.status === "partial";
    if (isUnpaid) unpaidCount += 1;

    const overdue = balance > 0 && r.dueDate != null && r.dueDate < now;
    if (overdue) overdueCount += 1;

    invoiceRows.push({
      id: r.id,
      invoiceNo: r.invoiceNo,
      tenantId: r.tenantId,
      tenantSlug: r.tenantSlug,
      tenantName: r.tenantName,
      studentName: `${r.studentFirst} ${r.studentLast}`.trim(),
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      balance,
      currency: cur,
      totalDisplayMinor,
      paidDisplayMinor,
      balanceDisplayMinor,
      status: r.status,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      overdue,
    });
  }

  return {
    displayCurrency,
    fxProvider: "frankfurter.app + fallbacks",
    summary: {
      totalInvoices: invoiceRows.length,
      unpaidCount,
      overdueCount,
      totalInvoiced,
      totalPaid,
      totalOutstanding: Math.max(0, totalInvoiced - totalPaid),
      schoolsWithInvoices: schoolIds.size,
    },
    invoices: invoiceRows,
  };
}
