import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { staff, staffContracts, leaveRequests } from "../db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { softDeleteStaffMember } from "../services/soft-delete";
import { createAuditLog } from "../services/audit";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/staff", ...guard, requirePermission("hr.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(staff).where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt))).orderBy(desc(staff.createdAt)) });
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

router.post("/staff", ...guard, requirePermission("hr.manage"),
  validate({ body: z.object({ employeeNo: z.string(), firstName: z.string(), lastName: z.string(), email: z.string().optional(), department: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(staff).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
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
      const [row] = await db.insert(leaveRequests).values({
        tenantId: tenant.id, staffId: req.body.staffId,
        startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate), reason: req.body.reason,
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
      const [row] = await db.update(leaveRequests).set({ status: req.body.status }).where(and(eq(leaveRequests.id, req.params.id), eq(leaveRequests.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("Leave request not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

export default router;
