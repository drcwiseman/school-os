import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { sickbayVisits, healthFlags, students } from "../db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

export const healthEnhancementsRouter = Router();
healthEnhancementsRouter.use(requireAuth, requireTenantMatch);

healthEnhancementsRouter.get("/dashboard", requirePermission("health.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [visits] = await db.select({ n: sql<number>`count(*)` }).from(sickbayVisits).where(eq(sickbayVisits.tenantId, tenant.id));
    const [inSickbay] = await db.select({ n: sql<number>`count(*) filter (where ${sickbayVisits.dischargedAt} is null)` })
      .from(sickbayVisits).where(eq(sickbayVisits.tenantId, tenant.id));
    const [flags] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${healthFlags.active} = true)`,
    }).from(healthFlags).where(eq(healthFlags.tenantId, tenant.id));
    res.json({
      success: true,
      data: {
        visits: Number(visits?.n ?? 0),
        inSickbay: Number(inSickbay?.n ?? 0),
        flags: Number(flags?.total ?? 0),
        activeFlags: Number(flags?.active ?? 0),
      },
    });
  } catch (e) { next(e); }
});

healthEnhancementsRouter.get("/visits/enriched", requirePermission("health.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      visit: sickbayVisits,
      student: {
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      },
    }).from(sickbayVisits)
      .innerJoin(students, eq(sickbayVisits.studentId, students.id))
      .where(eq(sickbayVisits.tenantId, tenant.id))
      .orderBy(desc(sickbayVisits.visitDate))
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

healthEnhancementsRouter.get("/flags/enriched", requirePermission("health.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      flag: healthFlags,
      student: {
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      },
    }).from(healthFlags)
      .innerJoin(students, eq(healthFlags.studentId, students.id))
      .where(eq(healthFlags.tenantId, tenant.id))
      .orderBy(desc(healthFlags.createdAt))
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

healthEnhancementsRouter.patch("/visits/:id", requirePermission("health.manage"),
  validate({
    body: z.object({
      complaint: z.string().optional(),
      treatment: z.string().optional(),
      visitDate: z.string().optional(),
      dischargedAt: z.string().optional().nullable(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.visitDate) patch.visitDate = new Date(patch.visitDate as string);
      if (patch.dischargedAt === null) patch.dischargedAt = null;
      else if (patch.dischargedAt) patch.dischargedAt = new Date(patch.dischargedAt as string);
      const [row] = await db.update(sickbayVisits).set(patch).where(and(
        eq(sickbayVisits.id, req.params.id),
        eq(sickbayVisits.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Visit not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

healthEnhancementsRouter.post("/visits/:id/discharge", requirePermission("health.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.update(sickbayVisits).set({ dischargedAt: new Date() }).where(and(
      eq(sickbayVisits.id, req.params.id),
      eq(sickbayVisits.tenantId, tenant.id),
      isNull(sickbayVisits.dischargedAt),
    )).returning();
    if (!row) throw new NotFoundError("Active visit not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

healthEnhancementsRouter.delete("/visits/:id", requirePermission("health.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(sickbayVisits).where(and(
      eq(sickbayVisits.id, req.params.id),
      eq(sickbayVisits.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Visit not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

healthEnhancementsRouter.patch("/flags/:id", requirePermission("health.manage"),
  validate({
    body: z.object({
      flag: z.string().optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(healthFlags).set(req.body).where(and(
        eq(healthFlags.id, req.params.id),
        eq(healthFlags.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Health flag not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

healthEnhancementsRouter.delete("/flags/:id", requirePermission("health.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(healthFlags).where(and(
      eq(healthFlags.id, req.params.id),
      eq(healthFlags.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Health flag not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});
