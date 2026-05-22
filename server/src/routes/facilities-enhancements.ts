import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  facilityRooms, facilityRoomBookings, schoolEvents, rooms, boardingRooms, boardingAllocations,
  libraryBooks, libraryLoans, transportRoutes, routeAssignments,
} from "../db/schema";
import { eq, and, desc, sql, isNull, gte, lte, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const ACTIVITY_TYPES = ["co_curricular", "extracurricular", "club", "sports", "cultural"] as const;

export const facilitiesEnhancementsRouter = Router();
facilitiesEnhancementsRouter.use(requireAuth, requireTenantMatch);

facilitiesEnhancementsRouter.get("/overview", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const out: Record<string, unknown> = {};
    try {
      const [lib] = await db.select({ active: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null)` })
        .from(libraryLoans).where(eq(libraryLoans.tenantId, tenant.id));
      const [books] = await db.select({ n: sql<number>`count(*)` }).from(libraryBooks).where(eq(libraryBooks.tenantId, tenant.id));
      out.library = { books: Number(books?.n ?? 0), activeLoans: Number(lib?.active ?? 0) };
    } catch { out.library = null; }
    try {
      const [tr] = await db.select({ n: sql<number>`count(*)` }).from(transportRoutes).where(eq(transportRoutes.tenantId, tenant.id));
      const [ra] = await db.select({ n: sql<number>`count(*)` }).from(routeAssignments).where(eq(routeAssignments.tenantId, tenant.id));
      out.transport = { routes: Number(tr?.n ?? 0), assignments: Number(ra?.n ?? 0) };
    } catch { out.transport = null; }
    try {
      const rooms = await db.select().from(boardingRooms).where(eq(boardingRooms.tenantId, tenant.id));
      const active = await db.select().from(boardingAllocations).where(and(
        eq(boardingAllocations.tenantId, tenant.id),
        isNull(boardingAllocations.toDate),
      ));
      const cap = rooms.reduce((s, r) => s + r.capacity, 0);
      out.hostel = { rooms: rooms.length, occupied: active.length, capacity: cap };
    } catch { out.hostel = null; }
    try {
      const now = new Date();
      const in30 = new Date(now);
      in30.setDate(in30.getDate() + 30);
      const [ev] = await db.select({ n: sql<number>`count(*)` }).from(schoolEvents).where(and(
        eq(schoolEvents.tenantId, tenant.id),
        inArray(schoolEvents.eventType, [...ACTIVITY_TYPES]),
        gte(schoolEvents.startsAt, now),
        lte(schoolEvents.startsAt, in30),
      ));
      out.upcomingActivities = Number(ev?.n ?? 0);
    } catch { out.upcomingActivities = 0; }
    try {
      const [fr] = await db.select({ n: sql<number>`count(*)` }).from(facilityRooms).where(eq(facilityRooms.tenantId, tenant.id));
      out.campusRooms = Number(fr?.n ?? 0);
    } catch { out.campusRooms = 0; }
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.get("/rooms", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const out: { campus: unknown[]; academic: unknown[]; hostel: unknown[] } = {
      campus: [],
      academic: [],
      hostel: [],
    };
    try {
      out.campus = await db.select().from(facilityRooms).where(eq(facilityRooms.tenantId, tenant.id)).orderBy(facilityRooms.name);
    } catch { /* facility_rooms may be missing until schema patch */ }
    try {
      out.academic = await db.select().from(rooms).where(eq(rooms.tenantId, tenant.id)).orderBy(rooms.name);
    } catch { /* ignore */ }
    try {
      const hostel = await db.select({
        room: boardingRooms,
        occupied: sql<number>`(
          select count(*)::int from boarding_allocations ba
          where ba.room_id = ${boardingRooms.id} and ba.tenant_id = ${tenant.id} and ba.to_date is null
        )`,
      }).from(boardingRooms).where(eq(boardingRooms.tenantId, tenant.id));
      out.hostel = hostel.map((h) => ({ ...h.room, occupied: Number(h.occupied ?? 0), source: "hostel" }));
    } catch { /* ignore */ }
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.post("/rooms", requirePermission("library.manage"),
  validate({
    body: z.object({
      name: z.string(),
      roomType: z.string().optional(),
      building: z.string().optional(),
      floor: z.string().optional(),
      capacity: z.number().optional(),
      status: z.enum(["available", "occupied", "maintenance"]).optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(facilityRooms).values({
        tenantId: tenant.id,
        name: req.body.name,
        roomType: req.body.roomType ?? "general",
        building: req.body.building ?? null,
        floor: req.body.floor ?? null,
        capacity: req.body.capacity ?? null,
        status: req.body.status ?? "available",
        notes: req.body.notes ?? null,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

facilitiesEnhancementsRouter.patch("/rooms/:id", requirePermission("library.manage"),
  validate({
    body: z.object({
      name: z.string().optional(),
      status: z.enum(["available", "occupied", "maintenance"]).optional(),
      capacity: z.number().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(facilityRooms).set(req.body).where(and(
        eq(facilityRooms.id, req.params.id),
        eq(facilityRooms.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Room not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

facilitiesEnhancementsRouter.get("/rooms/bookings", requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      booking: facilityRoomBookings,
      room: { name: facilityRooms.name, building: facilityRooms.building },
    }).from(facilityRoomBookings)
      .innerJoin(facilityRooms, eq(facilityRoomBookings.roomId, facilityRooms.id))
      .where(eq(facilityRoomBookings.tenantId, tenant.id))
      .orderBy(desc(facilityRoomBookings.startsAt))
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.post("/rooms/bookings", requirePermission("library.manage"),
  validate({
    body: z.object({
      roomId: z.string().uuid(),
      title: z.string(),
      startsAt: z.string(),
      endsAt: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(facilityRoomBookings).values({
        tenantId: tenant.id,
        roomId: req.body.roomId,
        title: req.body.title,
        bookedBy: user.id,
        startsAt: new Date(req.body.startsAt),
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

facilitiesEnhancementsRouter.get("/activities", requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(schoolEvents).where(and(
      eq(schoolEvents.tenantId, tenant.id),
      inArray(schoolEvents.eventType, [...ACTIVITY_TYPES]),
    )).orderBy(desc(schoolEvents.startsAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.post("/activities", requirePermission("messaging.manage"),
  validate({
    body: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      eventType: z.enum(ACTIVITY_TYPES).default("co_curricular"),
      venue: z.string().optional(),
      startsAt: z.string(),
      endsAt: z.string().optional(),
      audience: z.enum(["all", "parents", "staff", "students"]).default("students"),
      published: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(schoolEvents).values({
        tenantId: tenant.id,
        title: req.body.title,
        description: req.body.description ?? null,
        eventType: req.body.eventType,
        venue: req.body.venue ?? null,
        startsAt: new Date(req.body.startsAt),
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
        audience: req.body.audience,
        published: req.body.published ?? true,
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

facilitiesEnhancementsRouter.delete("/rooms/:id", requirePermission("library.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(facilityRoomBookings).where(and(
      eq(facilityRoomBookings.roomId, req.params.id),
      eq(facilityRoomBookings.tenantId, tenant.id),
    ));
    const [row] = await db.delete(facilityRooms).where(and(
      eq(facilityRooms.id, req.params.id),
      eq(facilityRooms.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Room not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.delete("/rooms/bookings/:id", requirePermission("library.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(facilityRoomBookings).where(and(
      eq(facilityRoomBookings.id, req.params.id),
      eq(facilityRoomBookings.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Booking not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.delete("/activities/:id", requirePermission("messaging.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(schoolEvents).where(and(
      eq(schoolEvents.id, req.params.id),
      eq(schoolEvents.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Activity not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

facilitiesEnhancementsRouter.patch("/activities/:id", requirePermission("messaging.manage"),
  validate({
    body: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      eventType: z.enum(ACTIVITY_TYPES).optional(),
      venue: z.string().optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional().nullable(),
      published: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.startsAt) patch.startsAt = new Date(patch.startsAt as string);
      if (patch.endsAt === null) patch.endsAt = null;
      else if (patch.endsAt) patch.endsAt = new Date(patch.endsAt as string);
      const [row] = await db.update(schoolEvents).set(patch).where(and(
        eq(schoolEvents.id, req.params.id),
        eq(schoolEvents.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Activity not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);
