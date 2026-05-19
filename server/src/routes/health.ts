import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { sickbayVisits, healthFlags } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/visits", ...guard, requirePermission("health.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(sickbayVisits).where(eq(sickbayVisits.tenantId, tenant.id)).orderBy(desc(sickbayVisits.visitDate)) });
  } catch (e) { next(e); }
});

router.post("/visits", ...guard, requirePermission("health.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), complaint: z.string(), treatment: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(sickbayVisits).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/flags", ...guard, requirePermission("health.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(healthFlags).where(eq(healthFlags.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/flags", ...guard, requirePermission("health.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), flag: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(healthFlags).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

export default router;
