import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { transportRoutes, transportStops, transportVehicles, routeAssignments } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/routes", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(transportRoutes).where(eq(transportRoutes.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/routes", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ name: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportRoutes).values({ tenantId: tenant.id, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/routes/:id/stops", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ name: z.string(), orderNo: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportStops).values({ tenantId: tenant.id, routeId: req.params.id, name: req.body.name, orderNo: req.body.orderNo ?? 0 }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/vehicles", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(transportVehicles).where(eq(transportVehicles.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/vehicles", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ registration: z.string(), capacity: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportVehicles).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/assignments", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ routeId: z.string().uuid(), studentId: z.string().uuid(), stopId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(routeAssignments).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

export default router;
