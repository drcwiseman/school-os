import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { staff, staffAttendance, leaveRequests } from "../db/schema";
import { eq, and, isNull, desc, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { generateStaffIdCardPdf, generateStaffIdCardsBulkPdf } from "../services/pdf";

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
    const today = new Date().toISOString().slice(0, 10);
    const [staffCount] = await db.select({ n: sql<number>`count(*)` }).from(staff)
      .where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt), eq(staff.status, "active")));
    const [att] = await db.select({
      present: sql<number>`count(*) filter (where ${staffAttendance.status} = 'present')`,
      absent: sql<number>`count(*) filter (where ${staffAttendance.status} = 'absent')`,
      late: sql<number>`count(*) filter (where ${staffAttendance.status} = 'late')`,
    }).from(staffAttendance).where(and(eq(staffAttendance.tenantId, tenant.id), eq(staffAttendance.date, today)));
    const [leavePending] = await db.select({ n: sql<number>`count(*)` }).from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenant.id), eq(leaveRequests.status, "pending")));
    res.json({
      success: true,
      data: {
        activeStaff: Number(staffCount?.n ?? 0),
        attendanceToday: att,
        pendingLeave: Number(leavePending?.n ?? 0),
      },
    });
  } catch (e) { next(e); }
});

hrEnhancementsRouter.get("/staff-attendance", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);
    const rows = await db.select({
      attendance: staffAttendance,
      staff: {
        id: staff.id,
        employeeNo: staff.employeeNo,
        firstName: staff.firstName,
        lastName: staff.lastName,
        department: staff.department,
        jobTitle: staff.jobTitle,
      },
    }).from(staff)
      .leftJoin(staffAttendance, and(
        eq(staffAttendance.staffId, staff.id),
        eq(staffAttendance.tenantId, tenant.id),
        eq(staffAttendance.date, date),
      ))
      .where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt), eq(staff.status, "active")))
      .orderBy(staff.employeeNo);

    res.json({ success: true, data: { date, rows } });
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
      const { date, records } = req.body;
      const saved = [];
      for (const rec of records) {
        const [s] = await db.select().from(staff).where(and(
          eq(staff.id, rec.staffId), eq(staff.tenantId, tenant.id), isNull(staff.deletedAt),
        )).limit(1);
        if (!s) continue;
        const [existing] = await db.select().from(staffAttendance).where(and(
          eq(staffAttendance.tenantId, tenant.id),
          eq(staffAttendance.staffId, rec.staffId),
          eq(staffAttendance.date, date),
        )).limit(1);
        let row;
        if (existing) {
          [row] = await db.update(staffAttendance).set({
            status: rec.status,
            notes: rec.notes,
            checkedInAt: new Date(),
            userId: s.userId ?? existing.userId,
          }).where(eq(staffAttendance.id, existing.id)).returning();
        } else {
          [row] = await db.insert(staffAttendance).values({
            tenantId: tenant.id,
            staffId: rec.staffId,
            userId: s.userId ?? undefined,
            date,
            status: rec.status,
            notes: rec.notes,
          }).returning();
        }
        if (row) saved.push(row);
      }
      res.json({ success: true, data: { saved: saved.length } });
    } catch (e) { next(e); }
  },
);

hrEnhancementsRouter.get("/staff-attendance/report", requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const from = typeof req.query.from === "string" ? req.query.from : new Date().toISOString().slice(0, 10);
    const to = typeof req.query.to === "string" ? req.query.to : from;
    const rows = await db.select({
      staffId: staffAttendance.staffId,
      employeeNo: staff.employeeNo,
      firstName: staff.firstName,
      lastName: staff.lastName,
      present: sql<number>`count(*) filter (where ${staffAttendance.status} = 'present')`,
      absent: sql<number>`count(*) filter (where ${staffAttendance.status} = 'absent')`,
      late: sql<number>`count(*) filter (where ${staffAttendance.status} = 'late')`,
      onLeave: sql<number>`count(*) filter (where ${staffAttendance.status} = 'on_leave')`,
    }).from(staffAttendance)
      .innerJoin(staff, eq(staffAttendance.staffId, staff.id))
      .where(and(
        eq(staffAttendance.tenantId, tenant.id),
        gte(staffAttendance.date, from),
        lte(staffAttendance.date, to),
      ))
      .groupBy(staffAttendance.staffId, staff.employeeNo, staff.firstName, staff.lastName);
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
      const [row] = await db.update(staff).set(req.body).where(and(
        eq(staff.id, req.params.id), eq(staff.tenantId, tenant.id), isNull(staff.deletedAt),
      )).returning();
      if (!row) throw new NotFoundError("Staff not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default hrEnhancementsRouter;
