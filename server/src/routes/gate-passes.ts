import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { gatePasses, students, classes, streams, staff } from "../db/schema";
import { eq, and, desc, sql, gte, lte, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { nextGatePassNumber, resolveStudentPlacement } from "../services/gate-pass";

export const gatePassesRouter = Router();
gatePassesRouter.use(requireAuth, requireTenantMatch);

gatePassesRouter.get("/dashboard", requirePermission("gate_pass.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const today = new Date().toISOString().slice(0, 10);
    const [stats] = await db.select({
      todayTotal: sql<number>`count(*) filter (where ${gatePasses.passDate} = ${today}::date)`,
      activeNow: sql<number>`count(*) filter (where ${gatePasses.passDate} = ${today}::date and ${gatePasses.outTime} is null and ${gatePasses.status} = 'active')`,
      checkedOut: sql<number>`count(*) filter (where ${gatePasses.passDate} = ${today}::date and ${gatePasses.outTime} is not null)`,
    }).from(gatePasses).where(eq(gatePasses.tenantId, tenant.id));
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
});

gatePassesRouter.get("/", requirePermission("gate_pass.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const date = req.query.date as string | undefined;
    const status = req.query.status as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const conds = [eq(gatePasses.tenantId, tenant.id)];
    if (date) conds.push(eq(gatePasses.passDate, date));
    if (status) conds.push(eq(gatePasses.status, status));
    if (studentId) conds.push(eq(gatePasses.studentId, studentId));

    const rows = await db.select({
      pass: gatePasses,
      student: {
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      },
      className: classes.name,
      streamName: streams.name,
      authorizer: {
        firstName: staff.firstName,
        lastName: staff.lastName,
        employeeNo: staff.employeeNo,
      },
    }).from(gatePasses)
      .innerJoin(students, eq(gatePasses.studentId, students.id))
      .leftJoin(classes, eq(gatePasses.classId, classes.id))
      .leftJoin(streams, eq(gatePasses.streamId, streams.id))
      .innerJoin(staff, eq(gatePasses.authorizedByStaffId, staff.id))
      .where(and(...conds))
      .orderBy(desc(gatePasses.inTime))
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

gatePassesRouter.get("/students/:studentId/placement", requirePermission("gate_pass.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const placement = await resolveStudentPlacement(tenant.id, req.params.studentId);
    res.json({ success: true, data: placement });
  } catch (e) { next(e); }
});

gatePassesRouter.post("/", requirePermission("gate_pass.manage"),
  validate({
    body: z.object({
      visitorName: z.string().min(1),
      visitorMobile: z.string().optional(),
      relationToStudent: z.string().optional(),
      studentId: z.string().uuid(),
      passDate: z.string().optional(),
      inTime: z.string().optional(),
      authorizedByStaffId: z.string().uuid(),
      purpose: z.string().optional(),
      notes: z.string().optional(),
      passNumber: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(
        eq(students.id, req.body.studentId),
        eq(students.tenantId, tenant.id),
        isNull(students.deletedAt),
      )).limit(1);
      if (!student) throw new NotFoundError("Student not found");

      const placement = await resolveStudentPlacement(tenant.id, student.id);
      const passNumber = req.body.passNumber ?? await nextGatePassNumber(tenant.id);
      const passDate = req.body.passDate ?? new Date().toISOString().slice(0, 10);
      const inTime = req.body.inTime ? new Date(req.body.inTime) : new Date();

      const [row] = await db.insert(gatePasses).values({
        tenantId: tenant.id,
        passNumber,
        visitorName: req.body.visitorName,
        visitorMobile: req.body.visitorMobile ?? null,
        relationToStudent: req.body.relationToStudent ?? null,
        studentId: student.id,
        classId: placement?.classId ?? null,
        streamId: placement?.streamId ?? null,
        passDate,
        inTime,
        authorizedByStaffId: req.body.authorizedByStaffId,
        purpose: req.body.purpose ?? null,
        notes: req.body.notes ?? null,
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

gatePassesRouter.patch("/:id", requirePermission("gate_pass.manage"),
  validate({
    body: z.object({
      visitorName: z.string().optional(),
      visitorMobile: z.string().optional(),
      relationToStudent: z.string().optional(),
      purpose: z.string().optional(),
      notes: z.string().optional(),
      inTime: z.string().optional(),
      outTime: z.string().optional().nullable(),
      passDate: z.string().optional(),
      authorizedByStaffId: z.string().uuid().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.inTime) patch.inTime = new Date(patch.inTime as string);
      if (patch.outTime === null) patch.outTime = null;
      else if (patch.outTime) patch.outTime = new Date(patch.outTime as string);
      const [row] = await db.update(gatePasses).set(patch).where(and(
        eq(gatePasses.id, req.params.id),
        eq(gatePasses.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Gate pass not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

gatePassesRouter.post("/:id/checkout", requirePermission("gate_pass.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const outTime = req.body?.outTime ? new Date(req.body.outTime) : new Date();
    const [row] = await db.update(gatePasses).set({ outTime, status: "checked_out" }).where(and(
      eq(gatePasses.id, req.params.id),
      eq(gatePasses.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Gate pass not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

gatePassesRouter.get("/report/daily", requirePermission("gate_pass.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || from;
    const rows = await db.select({
      passDate: gatePasses.passDate,
      total: sql<number>`count(*)`,
      checkedOut: sql<number>`count(*) filter (where ${gatePasses.outTime} is not null)`,
    }).from(gatePasses).where(and(
      eq(gatePasses.tenantId, tenant.id),
      gte(gatePasses.passDate, from),
      lte(gatePasses.passDate, to),
    )).groupBy(gatePasses.passDate).orderBy(gatePasses.passDate);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

export default gatePassesRouter;
