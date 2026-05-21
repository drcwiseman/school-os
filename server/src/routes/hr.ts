import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  staff, staffContracts, leaveRequests, staffAttendance, payrollTaxRules, jobPosts, jobApplicants,
  staffDisciplinary, staffDocuments, staffBenefits, performanceReviews,
} from "../db/schema";
import { eq, and, desc, isNull, inArray, sql, ne, or, ilike } from "drizzle-orm";
import { softDeleteStaffMember } from "../services/soft-delete";
import { createAuditLog } from "../services/audit";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, BadRequestError } from "../middleware/error";

async function findOverlappingLeave(tenantId: string, staffId: string, start: Date, end: Date, excludeId?: string) {
  const conditions = [
    eq(leaveRequests.tenantId, tenantId),
    eq(leaveRequests.staffId, staffId),
    inArray(leaveRequests.status, ["pending", "approved"]),
    sql`${leaveRequests.startDate} <= ${end}`,
    sql`${leaveRequests.endDate} >= ${start}`,
  ];
  if (excludeId) conditions.push(ne(leaveRequests.id, excludeId));
  return db.select({ id: leaveRequests.id, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, status: leaveRequests.status })
    .from(leaveRequests).where(and(...conditions)).limit(5);
}

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/staff", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const teachingOnly = req.query.teachingOnly === "1" || req.query.teachingOnly === "true";
    const conditions = [eq(staff.tenantId, tenant.id), isNull(staff.deletedAt)];
    if (teachingOnly) {
      conditions.push(or(
        ilike(staff.department, "%teacher%"),
        ilike(staff.department, "%teaching%"),
        ilike(staff.department, "%academic%"),
        eq(staff.department, "Teacher"),
        eq(staff.jobTitle, "Teacher"),
        ilike(staff.jobTitle, "%teacher%"),
      )!);
    }
    res.json({ success: true, data: await db.select().from(staff).where(and(...conditions)).orderBy(desc(staff.createdAt)) });
  } catch (e) { next(e); }
});

router.get("/staff/export/csv", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(staff).where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt)));
    const header = "employeeNo,firstName,lastName,email,department\n";
    const body = rows.map((s) =>
      [s.employeeNo, s.firstName, s.lastName, s.email ?? "", s.department ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=staff.csv");
    res.send(header + body);
  } catch (e) { next(e); }
});

router.post("/staff/import/csv", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ csv: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const lines = req.body.csv.trim().split("\n").slice(1);
      let imported = 0;
      for (const line of lines) {
        const [employeeNo, firstName, lastName, email, department] = line.split(",").map((s: string) => s.replace(/^"|"$/g, "").trim());
        if (!employeeNo || !firstName || !lastName) continue;
        await db.insert(staff).values({
          tenantId: tenant.id, employeeNo, firstName, lastName,
          email: email || undefined, department: department || undefined,
        }).onConflictDoNothing();
        imported++;
      }
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "staff.import", entityType: "staff", after: { imported }, ip: req.ip });
      res.json({ success: true, data: { imported } });
    } catch (e) { next(e); }
  }
);

router.get("/staff/:id", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.select().from(staff).where(and(
      eq(staff.id, req.params.id),
      eq(staff.tenantId, tenant.id),
      isNull(staff.deletedAt),
    )).limit(1);
    if (!row) throw new NotFoundError("Staff not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post("/staff", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ employeeNo: z.string(), firstName: z.string(), lastName: z.string(), email: z.string().optional(), department: z.string().optional(), jobTitle: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(staff).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/staff/:id", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({
    employeeNo: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    status: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(staff).where(and(
        eq(staff.id, req.params.id),
        eq(staff.tenantId, tenant.id),
        isNull(staff.deletedAt),
      )).limit(1);
      if (!existing) throw new NotFoundError("Staff not found");
      const [row] = await db.update(staff).set(req.body).where(eq(staff.id, req.params.id)).returning();
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/staff/:id", ...guard, requirePermission("hr.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(staff).where(and(eq(staff.id, req.params.id), eq(staff.tenantId, tenant.id), isNull(staff.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Staff not found");
    const updated = await softDeleteStaffMember(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "staff.soft_delete", entityType: "staff", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/staff/:id/contracts", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [s] = await db.select().from(staff).where(and(eq(staff.id, req.params.id), eq(staff.tenantId, tenant.id), isNull(staff.deletedAt))).limit(1);
    if (!s) throw new NotFoundError("Staff not found");
    const rows = await db.select().from(staffContracts).where(and(
      eq(staffContracts.staffId, s.id),
      eq(staffContracts.tenantId, tenant.id),
    )).orderBy(desc(staffContracts.startDate));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/staff/:id/contracts", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ salary: z.number().int(), startDate: z.string(), endDate: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [s] = await db.select().from(staff).where(and(eq(staff.id, req.params.id), eq(staff.tenantId, tenant.id))).limit(1);
      if (!s) throw new NotFoundError("Staff not found");
      const [row] = await db.insert(staffContracts).values({
        tenantId: tenant.id, staffId: s.id, salary: req.body.salary,
        startDate: new Date(req.body.startDate), endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/staff/:staffId/contracts/:contractId", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({
    endDate: z.string().nullable().optional(),
    salary: z.number().int().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const updates: Record<string, unknown> = {};
      if (req.body.salary !== undefined) updates.salary = req.body.salary;
      if (req.body.endDate !== undefined) {
        updates.endDate = req.body.endDate === null ? null : new Date(req.body.endDate);
      }
      const [row] = await db.update(staffContracts).set(updates).where(and(
        eq(staffContracts.id, req.params.contractId),
        eq(staffContracts.staffId, req.params.staffId),
        eq(staffContracts.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Contract not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/leave/check", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { staffId, startDate, endDate, excludeId } = req.query;
    if (typeof staffId !== "string" || typeof startDate !== "string" || typeof endDate !== "string") {
      throw new BadRequestError("staffId, startDate, and endDate are required");
    }
    const overlaps = await findOverlappingLeave(
      tenant.id, staffId, new Date(startDate), new Date(endDate),
      typeof excludeId === "string" ? excludeId : undefined,
    );
    res.json({ success: true, data: { hasConflict: overlaps.length > 0, overlaps } });
  } catch (e) { next(e); }
});

router.get("/leave", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const conditions = [eq(leaveRequests.tenantId, tenant.id)];
    if (statusFilter) conditions.push(eq(leaveRequests.status, statusFilter as any));
    const rows = await db
      .select({
        id: leaveRequests.id,
        staffId: leaveRequests.staffId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
        staffFirstName: staff.firstName,
        staffLastName: staff.lastName,
        employeeNo: staff.employeeNo,
      })
      .from(leaveRequests)
      .innerJoin(staff, eq(leaveRequests.staffId, staff.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/leave", ...guard, requirePermission("hr.view"),
  validate({ body: z.object({ staffId: z.string().uuid(), startDate: z.string(), endDate: z.string(), reason: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (end < start) throw new BadRequestError("End date must be on or after start date");
      const overlaps = await findOverlappingLeave(tenant.id, req.body.staffId, start, end);
      if (overlaps.length) throw new BadRequestError("Leave overlaps an existing pending or approved request");
      const [row] = await db.insert(leaveRequests).values({
        tenantId: tenant.id, staffId: req.body.staffId,
        startDate: start, endDate: end, reason: req.body.reason,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/leave/:id", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ status: z.enum(["approved", "rejected", "cancelled"]) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(leaveRequests).where(and(
        eq(leaveRequests.id, req.params.id), eq(leaveRequests.tenantId, tenant.id),
      )).limit(1);
      if (!existing) throw new NotFoundError("Leave request not found");
      if (req.body.status === "approved") {
        const overlaps = await findOverlappingLeave(
          tenant.id, existing.staffId, existing.startDate, existing.endDate, existing.id,
        );
        if (overlaps.length) throw new BadRequestError("Cannot approve: overlaps another approved or pending leave");
      }
      const [row] = await db.update(leaveRequests).set({ status: req.body.status }).where(and(
        eq(leaveRequests.id, req.params.id), eq(leaveRequests.tenantId, tenant.id),
      )).returning();
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/staff-attendance/check-in", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ userId: z.string().uuid().optional(), status: z.enum(["present", "absent", "late"]).default("present") }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const uid = req.body.userId ?? user.id;
      const date = new Date().toISOString().slice(0, 10);
      const [existing] = await db.select().from(staffAttendance).where(and(
        eq(staffAttendance.tenantId, tenant.id), eq(staffAttendance.userId, uid), eq(staffAttendance.date, date),
      )).limit(1);
      let row;
      if (existing) {
        [row] = await db.update(staffAttendance).set({ status: req.body.status, checkedInAt: new Date() }).where(eq(staffAttendance.id, existing.id)).returning();
      } else {
        [row] = await db.insert(staffAttendance).values({ tenantId: tenant.id, userId: uid, date, status: req.body.status }).returning();
      }
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/staff-attendance/today", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const date = new Date().toISOString().slice(0, 10);
    res.json({ success: true, data: await db.select().from(staffAttendance).where(and(eq(staffAttendance.tenantId, tenant.id), eq(staffAttendance.date, date))) });
  } catch (e) { next(e); }
});

router.get("/analytics", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [counts] = await db.select({
      staff: sql<number>`count(*)`,
      onLeave: sql<number>`count(*) filter (where ${leaveRequests.status} = 'approved')`,
    }).from(staff).leftJoin(leaveRequests, eq(leaveRequests.staffId, staff.id))
      .where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt)));
    res.json({ success: true, data: counts });
  } catch (e) { next(e); }
});

router.get("/tax-rules", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(payrollTaxRules).where(eq(payrollTaxRules.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/tax-rules", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ name: z.string(), ratePercent: z.number().int(), thresholdMinor: z.number().int().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(payrollTaxRules).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/jobs", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(jobPosts).where(eq(jobPosts.tenantId, tenant.id)).orderBy(desc(jobPosts.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/jobs", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ title: z.string(), department: z.string().optional(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(jobPosts).values({ tenantId: tenant.id, title: req.body.title, department: req.body.department, description: req.body.description ?? "" }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/jobs/:id/applicants", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(jobApplicants).where(and(eq(jobApplicants.jobPostId, req.params.id), eq(jobApplicants.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/jobs/:id/applicants", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ name: z.string(), email: z.string().optional(), phone: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(jobApplicants).values({ tenantId: tenant.id, jobPostId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/org-chart", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({ department: staff.department, count: sql<number>`count(*)` })
      .from(staff).where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt))).groupBy(staff.department);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/staff/:id/disciplinary", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(staffDisciplinary).where(and(eq(staffDisciplinary.staffId, req.params.id), eq(staffDisciplinary.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/staff/:id/disciplinary", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ description: z.string(), action: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(staffDisciplinary).values({ tenantId: tenant.id, staffId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/staff/:id/documents", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(staffDocuments).where(and(eq(staffDocuments.staffId, req.params.id), eq(staffDocuments.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/staff/:id/documents", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ documentType: z.string(), fileName: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(staffDocuments).values({ tenantId: tenant.id, staffId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/staff/:id/benefits", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(staffBenefits).where(and(eq(staffBenefits.staffId, req.params.id), eq(staffBenefits.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/staff/:id/benefits", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ name: z.string(), amountMinor: z.number().int() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(staffBenefits).values({ tenantId: tenant.id, staffId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/staff/:id/reviews", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(performanceReviews).where(and(eq(performanceReviews.staffId, req.params.id), eq(performanceReviews.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/staff/:id/reviews", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ period: z.string(), score: z.number().int().optional(), comments: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(performanceReviews).values({ tenantId: tenant.id, staffId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default router;
