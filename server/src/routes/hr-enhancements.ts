import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { generateStaffIdCardPdf, generateStaffIdCardsBulkPdf } from "../services/pdf";
import {
  bulkSaveStaffAttendance,
  getHrDashboard,
  listStaffAttendanceRoster,
  staffAttendanceReport,
} from "../lib/hr-query";
import { getStaffById } from "../lib/staff-query";
import { db } from "../db";
import { staff } from "../db/schema";
import { and, eq } from "drizzle-orm";

function sendPdf(res: any, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

export const hrEnhancementsRouter = Router();
hrEnhancementsRouter.use(requireAuth, requireTenantMatch);

hrEnhancementsRouter.get("/dashboard", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const data = await getHrDashboard(tenant.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

hrEnhancementsRouter.get("/staff-attendance", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
    const data = await listStaffAttendanceRoster(tenant.id, date);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

hrEnhancementsRouter.post("/staff-attendance/bulk", requirePermission("hr.manage"),
  validate({
    body: z.object({
      date: z.string(),
      records: z.array(z.object({
        staffId: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "on_leave"]),
        notes: z.string().optional(),
      })),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const saved = await bulkSaveStaffAttendance(tenant.id, req.body.date, req.body.records);
      res.json({ success: true, data: { saved: saved.length } });
    } catch (e) { next(e); }
  },
);

hrEnhancementsRouter.get("/staff-attendance/report", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const from = typeof req.query.from === "string" ? req.query.from : new Date().toISOString().slice(0, 10);
    const to = typeof req.query.to === "string" ? req.query.to : from;
    const rows = await staffAttendanceReport(tenant.id, from, to);
    res.json({ success: true, data: { from, to, rows } });
  } catch (e) { next(e); }
});

hrEnhancementsRouter.get("/staff/:staffId/pdf/id-card", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateStaffIdCardPdf(tenant.id, req.params.staffId);
    sendPdf(res, bytes, `staff-id-${req.params.staffId.slice(0, 8)}.pdf`);
  } catch (e) { next(e); }
});

hrEnhancementsRouter.get("/staff/pdf/id-cards/bulk", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const ids = typeof req.query.staffIds === "string"
      ? req.query.staffIds.split(",").filter(Boolean)
      : undefined;
    const bytes = await generateStaffIdCardsBulkPdf(tenant.id, ids);
    sendPdf(res, bytes, "staff-id-cards.pdf");
  } catch (e) { next(e); }
});

hrEnhancementsRouter.patch("/staff/:id", requirePermission("hr.manage"),
  validate({ body: z.object({
    jobTitle: z.string().optional(),
    department: z.string().optional(),
    userId: z.string().uuid().nullable().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const existing = await getStaffById(tenant.id, req.params.id);
      if (!existing) throw new NotFoundError("Staff not found");
      const [row] = await db.update(staff).set(req.body).where(and(
        eq(staff.id, req.params.id), eq(staff.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Staff not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default hrEnhancementsRouter;
