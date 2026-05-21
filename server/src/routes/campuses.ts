import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  tenantCampuses, campusDepartments, students, classes, invoices, users,
} from "../db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { requireTenantFeature } from "../middleware/require-feature";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch, requireTenantFeature("multi_campus")];

router.get("/", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(tenantCampuses).where(eq(tenantCampuses.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string(), code: z.string(), address: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(tenantCampuses).values({
        tenantId: tenant.id,
        name: req.body.name,
        code: req.body.code,
        address: req.body.address ?? "",
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().optional(), status: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(tenantCampuses).set(req.body).where(and(eq(tenantCampuses.id, req.params.id), eq(tenantCampuses.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("Campus not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/:id/departments", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(campusDepartments).where(and(eq(campusDepartments.campusId, req.params.id), eq(campusDepartments.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/:id/departments", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string(), parentId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(campusDepartments).values({ tenantId: tenant.id, campusId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/consolidated-report", ...guard, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const campuses = await db.select().from(tenantCampuses).where(eq(tenantCampuses.tenantId, tenant.id));
    const report = [];
    for (const c of campuses) {
      const [stu] = await db.select({ count: sql<number>`count(*)` }).from(students).where(and(eq(students.tenantId, tenant.id), eq(students.campusId, c.id), isNull(students.deletedAt)));
      const [inv] = await db.select({ total: sql<number>`coalesce(sum(${invoices.totalAmount}),0)`, paid: sql<number>`coalesce(sum(${invoices.paidAmount}),0)` })
        .from(invoices).where(and(eq(invoices.tenantId, tenant.id), eq(invoices.campusId, c.id), isNull(invoices.deletedAt)));
      report.push({ campus: c, students: Number(stu?.count ?? 0), invoiced: Number(inv?.total ?? 0), collected: Number(inv?.paid ?? 0) });
    }
    res.json({ success: true, data: report });
  } catch (e) { next(e); }
});

/** Assign campus admin user */
router.post("/:id/admins", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ userId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(users).set({ campusId: req.params.id }).where(and(eq(users.id, req.body.userId), eq(users.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("User not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default router;
