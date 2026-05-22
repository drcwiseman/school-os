import { Router } from "express";
import { db } from "../db";
import { invoices, attendanceSessions, reportCards, savedReports } from "../db/schema";
import { eq, and, sql, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { getCampusId, pushCampusFilter } from "../lib/campus-scope";
import { validate } from "../utils/validate";
import { safeList } from "../lib/safe-route";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import {
  generateInvoicePdf, generateReceiptPdf, generateReportCardPdf, generatePayslipPdf, pdfStructureCheck,
} from "../services/pdf";
import { getTenantLocale } from "../services/tenant-locale";
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
    const conditions = [eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)];
    pushCampusFilter(conditions, invoices, req);
    const [summary] = await db.select({
      totalInvoiced: sql<number>`coalesce(sum(${invoices.totalAmount}),0)`,
      totalPaid: sql<number>`coalesce(sum(${invoices.paidAmount}),0)`,
    }).from(invoices).where(and(...conditions));
    const locale = await getTenantLocale(tenant.id);
    res.json({ success: true, data: { ...summary, currency: locale.currency, country: locale.country } });
  } catch (e) { next(e); }
});

router.get("/finance/debtors", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const conditions = [eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt), sql`${invoices.paidAmount} < ${invoices.totalAmount}`];
    pushCampusFilter(conditions, invoices, req);
    const rows = await db.select().from(invoices).where(and(...conditions));
    const locale = await getTenantLocale(tenant.id);
    res.json({
      success: true,
      data: rows.map((r) => ({ ...r, balance: r.totalAmount - r.paidAmount })),
      currency: locale.currency,
      country: locale.country,
    });
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

router.get("/builder", ...guard, requirePermission("reports.view"), safeList("saved-reports", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(savedReports).where(eq(savedReports.tenantId, tenant.id)).orderBy(desc(savedReports.createdAt));
}));

router.post("/builder", ...guard, requirePermission("reports.export"),
  validate({ body: z.object({ name: z.string().min(1), reportType: z.string().min(1), configJson: z.record(z.unknown()).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(savedReports).values({
        tenantId: tenant.id,
        name: req.body.name,
        reportType: req.body.reportType,
        configJson: req.body.configJson ?? {},
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.post("/builder/:id/run", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [report] = await db.select().from(savedReports).where(and(eq(savedReports.id, req.params.id), eq(savedReports.tenantId, tenant.id))).limit(1);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    const campusId = getCampusId(req);
    let rows: unknown[] = [];
    if (report.reportType === "finance_debtors") {
      const conditions = [eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt), sql`${invoices.paidAmount} < ${invoices.totalAmount}`];
      if (campusId) conditions.push(eq(invoices.campusId, campusId));
      rows = await db.select().from(invoices).where(and(...conditions)).limit(500);
    } else if (report.reportType === "attendance_summary") {
      const [r] = await db.select({ total: sql<number>`count(*)` }).from(attendanceSessions).where(eq(attendanceSessions.tenantId, tenant.id));
      rows = [{ sessions: Number(r?.total ?? 0) }];
    } else if (report.reportType === "academics_performance") {
      rows = await db.select().from(reportCards).where(eq(reportCards.tenantId, tenant.id)).orderBy(desc(reportCards.createdAt)).limit(100);
    } else {
      const conditions = [eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)];
      if (campusId) conditions.push(eq(invoices.campusId, campusId));
      const [summary] = await db.select({
        totalInvoiced: sql<number>`coalesce(sum(${invoices.totalAmount}),0)`,
        totalPaid: sql<number>`coalesce(sum(${invoices.paidAmount}),0)`,
      }).from(invoices).where(and(...conditions));
      rows = [summary];
    }
    res.json({ success: true, data: { report, rows } });
  } catch (e) { next(e); }
});

router.delete("/builder/:id", ...guard, requirePermission("reports.export"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(savedReports).where(and(eq(savedReports.id, req.params.id), eq(savedReports.tenantId, tenant.id)));
    res.json({ success: true });
  } catch (e) { next(e); }
});

export { pdfStructureCheck };
export default router;
