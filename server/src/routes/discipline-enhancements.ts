import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { disciplineIncidents, disciplineActions, students } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

export const disciplineEnhancementsRouter = Router();
disciplineEnhancementsRouter.use(requireAuth, requireTenantMatch);

disciplineEnhancementsRouter.get("/dashboard", requirePermission("discipline.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [total] = await db.select({ n: sql<number>`count(*)` }).from(disciplineIncidents).where(eq(disciplineIncidents.tenantId, tenant.id));
    const [minor] = await db.select({ n: sql<number>`count(*) filter (where ${disciplineIncidents.severity} = 'minor')` })
      .from(disciplineIncidents).where(eq(disciplineIncidents.tenantId, tenant.id));
    const [major] = await db.select({ n: sql<number>`count(*) filter (where ${disciplineIncidents.severity} in ('major', 'critical'))` })
      .from(disciplineIncidents).where(eq(disciplineIncidents.tenantId, tenant.id));
    res.json({
      success: true,
      data: {
        total: Number(total?.n ?? 0),
        minor: Number(minor?.n ?? 0),
        major: Number(major?.n ?? 0),
      },
    });
  } catch (e) { next(e); }
});

disciplineEnhancementsRouter.get("/incidents/enriched", requirePermission("discipline.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      incident: disciplineIncidents,
      student: {
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      },
      actionCount: sql<number>`(
        select count(*)::int from discipline_actions da
        where da.incident_id = ${disciplineIncidents.id} and da.tenant_id = ${tenant.id}
      )`,
    }).from(disciplineIncidents)
      .innerJoin(students, eq(disciplineIncidents.studentId, students.id))
      .where(eq(disciplineIncidents.tenantId, tenant.id))
      .orderBy(desc(disciplineIncidents.incidentDate))
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

disciplineEnhancementsRouter.get("/incidents/:id/actions", requirePermission("discipline.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(disciplineActions).where(and(
      eq(disciplineActions.incidentId, req.params.id),
      eq(disciplineActions.tenantId, tenant.id),
    )).orderBy(desc(disciplineActions.actionDate));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

disciplineEnhancementsRouter.patch("/incidents/:id", requirePermission("discipline.manage"),
  validate({
    body: z.object({
      category: z.string().optional(),
      description: z.string().optional(),
      severity: z.enum(["minor", "moderate", "major", "critical"]).optional(),
      incidentDate: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.incidentDate) patch.incidentDate = new Date(patch.incidentDate as string);
      const [row] = await db.update(disciplineIncidents).set(patch).where(and(
        eq(disciplineIncidents.id, req.params.id),
        eq(disciplineIncidents.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Incident not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

disciplineEnhancementsRouter.delete("/incidents/:id", requirePermission("discipline.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(disciplineActions).where(and(
      eq(disciplineActions.incidentId, req.params.id),
      eq(disciplineActions.tenantId, tenant.id),
    ));
    const [row] = await db.delete(disciplineIncidents).where(and(
      eq(disciplineIncidents.id, req.params.id),
      eq(disciplineIncidents.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Incident not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});
