import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../db";
import { tenantSettings, tenants, students, invoices, payments, receipts, reportCards, payslips, staff } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { formatMoney } from "../utils/money";

export type PdfTemplate = "invoice" | "receipt" | "report_card" | "payslip";

interface Branding {
  schoolName: string;
  logoText?: string;
  primaryColor: { r: number; g: number; b: number };
  footer?: string;
}

async function loadBranding(tenantId: string): Promise<Branding> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const branding = (settings?.brandingJson ?? {}) as Record<string, string>;
  return {
    schoolName: tenant?.name ?? "School",
    logoText: branding.logoText ?? branding.name,
    primaryColor: { r: 0.1, g: 0.3, b: 0.6 },
    footer: branding.footer ?? "Official document — do not alter",
  };
}

async function basePage(branding: Branding, title: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();

  page.drawText(branding.schoolName, { x: 50, y: height - 50, size: 18, font: bold, color: rgb(branding.primaryColor.r, branding.primaryColor.g, branding.primaryColor.b) });
  page.drawText(title, { x: 50, y: height - 75, size: 14, font: bold });
  if (branding.footer) {
    page.drawText(branding.footer, { x: 50, y: 30, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return { doc, page, font, bold, height };
}

export async function generateInvoicePdf(tenantId: string, invoiceId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
  if (!inv) throw new Error("Invoice not found");
  const [student] = await db.select().from(students).where(eq(students.id, inv.studentId)).limit(1);

  const { doc, page, font, bold, height } = await basePage(branding, `Invoice ${inv.invoiceNo}`);
  let y = height - 110;
  const lines = [
    `Student: ${student?.firstName ?? ""} ${student?.lastName ?? ""} (${student?.admissionNumber ?? ""})`,
    `Status: ${inv.status}`,
    `Total: ${formatMoney(inv.totalAmount)}`,
    `Paid: ${formatMoney(inv.paidAmount)}`,
    `Balance: ${formatMoney(inv.totalAmount - inv.paidAmount)}`,
    `Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}`,
  ];
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 18;
  }
  return doc.save();
}

export async function generateReceiptPdf(tenantId: string, receiptId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [rec] = await db.select().from(receipts).where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId))).limit(1);
  if (!rec) throw new Error("Receipt not found");

  const { doc, page, font, bold, height } = await basePage(branding, `Receipt ${rec.receiptNo}`);
  page.drawText(`Amount received: ${formatMoney(rec.amount)}`, { x: 50, y: height - 110, size: 12, font: bold });
  page.drawText(`Date: ${new Date(rec.issuedAt).toLocaleString()}`, { x: 50, y: height - 130, size: 11, font });
  return doc.save();
}

export async function generateReportCardPdf(tenantId: string, reportCardId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [rc] = await db.select().from(reportCards).where(and(eq(reportCards.id, reportCardId), eq(reportCards.tenantId, tenantId))).limit(1);
  if (!rc) throw new Error("Report card not found");
  const [student] = await db.select().from(students).where(eq(students.id, rc.studentId)).limit(1);
  const data = rc.dataJson as Record<string, unknown>;

  const { doc, page, font, bold, height } = await basePage(branding, "Report Card");
  page.drawText(`${student?.firstName} ${student?.lastName}`, { x: 50, y: height - 110, size: 12, font: bold });
  page.drawText(`Average: ${data.average ?? "—"}`, { x: 50, y: height - 130, size: 11, font });
  page.drawText(rc.published ? "PUBLISHED" : "DRAFT", { x: 50, y: height - 150, size: 10, font });
  return doc.save();
}

export async function generatePayslipPdf(tenantId: string, payslipId: string): Promise<Uint8Array> {
  const branding = await loadBranding(tenantId);
  const [slip] = await db.select().from(payslips).where(and(eq(payslips.id, payslipId), eq(payslips.tenantId, tenantId))).limit(1);
  if (!slip) throw new Error("Payslip not found");
  const data = slip.dataJson as Record<string, unknown>;
  const [staffRow] = await db.select().from(staff).where(eq(staff.id, slip.staffId)).limit(1);

  const { doc, page, font, bold, height } = await basePage(branding, "Payslip");
  page.drawText(`${staffRow?.firstName ?? ""} ${staffRow?.lastName ?? ""} (${staffRow?.employeeNo ?? ""})`, { x: 50, y: height - 110, size: 11, font });
  page.drawText(`Period: ${data.period ?? "—"}`, { x: 50, y: height - 130, size: 11, font });
  page.drawText(`Net pay: ${formatMoney(Number(data.net ?? 0))}`, { x: 50, y: height - 150, size: 12, font: bold });
  return doc.save();
}

/** Deterministic structure check for tests */
export async function pdfStructureCheck(pdfBytes: Uint8Array): Promise<{ pageCount: number; hasContent: boolean }> {
  const doc = await PDFDocument.load(pdfBytes);
  return { pageCount: doc.getPageCount(), hasContent: pdfBytes.length > 500 };
}
