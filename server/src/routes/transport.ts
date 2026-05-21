import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  transportRoutes, transportStops, transportVehicles, routeAssignments,
  transportDrivers, vehicleGpsPings, transportFuelLogs, vehicleMaintenanceLogs, transportAlerts,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { safeList } from "../lib/safe-route";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/routes", ...guard, requirePermission("transport.view"), safeList("transport-routes", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(transportRoutes).where(eq(transportRoutes.tenantId, tenant.id));
}));

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

router.get("/routes/:id/stops", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(transportStops).where(and(eq(transportStops.routeId, req.params.id), eq(transportStops.tenantId, tenant.id))).orderBy(transportStops.orderNo);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/routes/:id/stops", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ name: z.string(), orderNo: z.number().optional(), lat: z.string().optional(), lng: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportStops).values({ tenantId: tenant.id, routeId: req.params.id, name: req.body.name, orderNo: req.body.orderNo ?? 0, lat: req.body.lat, lng: req.body.lng }).returning();
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
  validate({ body: z.object({ registration: z.string(), capacity: z.number().optional(), routeId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportVehicles).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/drivers", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(transportDrivers).where(eq(transportDrivers.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/drivers", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ name: z.string(), phone: z.string().optional(), licenseNo: z.string().optional(), vehicleId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportDrivers).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/vehicles/:id/gps", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ lat: z.string(), lng: z.string(), speedKph: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(vehicleGpsPings).values({ tenantId: tenant.id, vehicleId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/vehicles/:id/gps/latest", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.select().from(vehicleGpsPings).where(and(eq(vehicleGpsPings.vehicleId, req.params.id), eq(vehicleGpsPings.tenantId, tenant.id))).orderBy(desc(vehicleGpsPings.recordedAt)).limit(1);
    res.json({ success: true, data: row ?? null });
  } catch (e) { next(e); }
});

router.get("/gps/live", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const vehicles = await db.select().from(transportVehicles).where(eq(transportVehicles.tenantId, tenant.id));
    const live = [];
    for (const v of vehicles) {
      const [ping] = await db.select().from(vehicleGpsPings).where(and(eq(vehicleGpsPings.vehicleId, v.id), eq(vehicleGpsPings.tenantId, tenant.id))).orderBy(desc(vehicleGpsPings.recordedAt)).limit(1);
      if (ping) live.push({ vehicle: v, ping });
    }
    res.json({ success: true, data: live });
  } catch (e) { next(e); }
});

router.post("/fuel", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ vehicleId: z.string().uuid(), liters: z.string(), costMinor: z.number().optional(), odometerKm: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportFuelLogs).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/fuel", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(transportFuelLogs).where(eq(transportFuelLogs.tenantId, tenant.id)).orderBy(desc(transportFuelLogs.loggedAt)) });
  } catch (e) { next(e); }
});

router.post("/maintenance", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ vehicleId: z.string().uuid(), description: z.string(), costMinor: z.number().optional(), serviceDate: z.string(), nextDueDate: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(vehicleMaintenanceLogs).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/maintenance", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(vehicleMaintenanceLogs).where(eq(vehicleMaintenanceLogs.tenantId, tenant.id)).orderBy(desc(vehicleMaintenanceLogs.serviceDate)) });
  } catch (e) { next(e); }
});

router.get("/assignments", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(routeAssignments).where(eq(routeAssignments.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

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

router.post("/alerts", ...guard, requirePermission("transport.manage"),
  validate({ body: z.object({ routeId: z.string().uuid().optional(), studentId: z.string().uuid().optional(), alertType: z.string(), message: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(transportAlerts).values({ tenantId: tenant.id, ...req.body, sentAt: new Date() }).returning();
      res.status(201).json({ success: true, data: row, note: "Alert logged; connect SMS/push provider for delivery" });
    } catch (e) { next(e); }
  }
);

router.get("/map-data", ...guard, requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const routeId = req.query.routeId as string | undefined;
    const stops = routeId
      ? await db.select().from(transportStops).where(and(eq(transportStops.tenantId, tenant.id), eq(transportStops.routeId, routeId)))
      : await db.select().from(transportStops).where(eq(transportStops.tenantId, tenant.id));
    const liveRes = await db.select().from(vehicleGpsPings).where(eq(vehicleGpsPings.tenantId, tenant.id)).orderBy(desc(vehicleGpsPings.recordedAt)).limit(50);
    res.json({ success: true, data: { stops, pings: liveRes } });
  } catch (e) { next(e); }
});

export default router;
