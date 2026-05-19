import { Router } from "express";
import { db } from "../db";
import { invoices, attendanceSessions, reportCards } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import {
  generateInvoicePdf, generateReceiptPdf, generateReportCardPdf, generatePayslipPdf, pdfStructureCheck,
} from "../services/pdf";
const router = Router();
const guard = [requireAuth, requireTenantMatch];

function sendPdf(res: any, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

router.get("/finance/collections", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [summary] = await db.select({
      totalInvoiced: sql<number>`coalesce(sum(${invoices.totalAmount}),0)`,
      totalPaid: sql<number>`coalesce(sum(${invoices.paidAmount}),0)`,
    }).from(invoices).where(eq(invoices.tenantId, tenant.id));
    res.json({ success: true, data: summary });
  } catch (e) { next(e); }
});

router.get("/finance/debtors", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenant.id), sql`${invoices.paidAmount} < ${invoices.totalAmount}`));
    res.json({ success: true, data: rows.map((r) => ({ ...r, balance: r.totalAmount - r.paidAmount })) });
  } catch (e) { next(e); }
});

router.get("/attendance/summary", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const count = await db.select({ total: sql<number>`count(*)` }).from(attendanceSessions).where(eq(attendanceSessions.tenantId, tenant.id));
    res.json({ success: true, data: { sessions: Number(count[0]?.total ?? 0) } });
  } catch (e) { next(e); }
});

router.get("/academics/performance", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(reportCards).where(eq(reportCards.tenantId, tenant.id)).orderBy(desc(reportCards.createdAt)).limit(50);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/pdf/invoice/:id", ...guard, requirePermission("reports.export"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateInvoicePdf(tenant.id, req.params.id);
    sendPdf(res, bytes, `invoice-${req.params.id}.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/receipt/:id", ...guard, requirePermission("reports.export"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateReceiptPdf(tenant.id, req.params.id);
    sendPdf(res, bytes, `receipt-${req.params.id}.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/report-card/:id", ...guard, requirePermission("reports.export"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateReportCardPdf(tenant.id, req.params.id);
    sendPdf(res, bytes, `report-card-${req.params.id}.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/payslip/:id", ...guard, requirePermission("reports.export"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generatePayslipPdf(tenant.id, req.params.id);
    sendPdf(res, bytes, `payslip-${req.params.id}.pdf`);
  } catch (e) { next(e); }
});

export { pdfStructureCheck };
export default router;
