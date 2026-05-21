import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  transportRoutes, transportStops, transportVehicles, transportDrivers,
  routeAssignments, students,
} from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

export const transportEnhancementsRouter = Router();
transportEnhancementsRouter.use(requireAuth, requireTenantMatch);

transportEnhancementsRouter.get("/dashboard", requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [routes] = await db.select({ n: sql<number>`count(*)` }).from(transportRoutes).where(eq(transportRoutes.tenantId, tenant.id));
    const [vehicles] = await db.select({ n: sql<number>`count(*)` }).from(transportVehicles).where(eq(transportVehicles.tenantId, tenant.id));
    const [drivers] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${transportDrivers.status} = 'active')`,
    }).from(transportDrivers).where(eq(transportDrivers.tenantId, tenant.id));
    const [assignments] = await db.select({ n: sql<number>`count(*)` }).from(routeAssignments).where(eq(routeAssignments.tenantId, tenant.id));
    const [unassigned] = await db.select({ n: sql<number>`count(*)` }).from(transportVehicles)
      .where(and(eq(transportVehicles.tenantId, tenant.id), sql`${transportVehicles.routeId} is null`));
    res.json({
      success: true,
      data: {
        routes: Number(routes?.n ?? 0),
        vehicles: Number(vehicles?.n ?? 0),
        drivers: drivers,
        studentAssignments: Number(assignments?.n ?? 0),
        vehiclesWithoutRoute: Number(unassigned?.n ?? 0),
      },
    });
  } catch (e) { next(e); }
});

transportEnhancementsRouter.get("/assignments/enriched", requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      assignment: routeAssignments,
      route: { name: transportRoutes.name },
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
      stop: { name: transportStops.name },
    }).from(routeAssignments)
      .innerJoin(transportRoutes, eq(routeAssignments.routeId, transportRoutes.id))
      .innerJoin(students, eq(routeAssignments.studentId, students.id))
      .leftJoin(transportStops, eq(routeAssignments.stopId, transportStops.id))
      .where(eq(routeAssignments.tenantId, tenant.id))
      .orderBy(desc(routeAssignments.id));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

transportEnhancementsRouter.get("/fleet-overview", requirePermission("transport.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const vehicles = await db.select({
      vehicle: transportVehicles,
      route: { name: transportRoutes.name },
      driver: transportDrivers,
    }).from(transportVehicles)
      .leftJoin(transportRoutes, eq(transportVehicles.routeId, transportRoutes.id))
      .leftJoin(transportDrivers, eq(transportDrivers.vehicleId, transportVehicles.id))
      .where(eq(transportVehicles.tenantId, tenant.id));
    res.json({ success: true, data: vehicles });
  } catch (e) { next(e); }
});

transportEnhancementsRouter.patch("/vehicles/:id", requirePermission("transport.manage"),
  validate({ body: z.object({ routeId: z.string().uuid().nullable().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(transportVehicles).set({ routeId: req.body.routeId ?? null }).where(and(
        eq(transportVehicles.id, req.params.id),
        eq(transportVehicles.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Vehicle not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

transportEnhancementsRouter.patch("/drivers/:id/vehicle", requirePermission("transport.manage"),
  validate({ body: z.object({ vehicleId: z.string().uuid().nullable() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const vehicleId = req.body.vehicleId;
      if (vehicleId) {
        await db.update(transportDrivers).set({ vehicleId: null }).where(and(
          eq(transportDrivers.tenantId, tenant.id),
          eq(transportDrivers.vehicleId, vehicleId),
        ));
      }
      const [row] = await db.update(transportDrivers).set({ vehicleId }).where(and(
        eq(transportDrivers.id, req.params.id),
        eq(transportDrivers.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Driver not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

transportEnhancementsRouter.post("/routes-with-stops", requirePermission("transport.manage"),
  validate({
    body: z.object({
      name: z.string(),
      stops: z.array(z.object({ name: z.string(), orderNo: z.number().optional() })).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [route] = await db.insert(transportRoutes).values({ tenantId: tenant.id, name: req.body.name }).returning();
      const stops = req.body.stops ?? [];
      for (let i = 0; i < stops.length; i++) {
        await db.insert(transportStops).values({
          tenantId: tenant.id,
          routeId: route.id,
          name: stops[i].name,
          orderNo: stops[i].orderNo ?? i,
        });
      }
      res.status(201).json({ success: true, data: route });
    } catch (e) { next(e); }
  },
);
