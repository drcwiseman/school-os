import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { disciplineIncidents, disciplineActions } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/incidents", ...guard, requirePermission("discipline.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(disciplineIncidents).where(eq(disciplineIncidents.tenantId, tenant.id)).orderBy(desc(disciplineIncidents.incidentDate)) });
  } catch (e) { next(e); }
});

router.post("/incidents", ...guard, requirePermission("discipline.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), category: z.string(), description: z.string(), severity: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(disciplineIncidents).values({ tenantId: tenant.id, ...req.body, createdBy: user.id }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/incidents/:id/actions", ...guard, requirePermission("discipline.manage"),
  validate({ body: z.object({ action: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [inc] = await db.select().from(disciplineIncidents).where(and(eq(disciplineIncidents.id, req.params.id), eq(disciplineIncidents.tenantId, tenant.id))).limit(1);
      if (!inc) throw new NotFoundError("Incident not found");
      const [row] = await db.insert(disciplineActions).values({ tenantId: tenant.id, incidentId: inc.id, action: req.body.action, notes: req.body.notes }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

export default router;
