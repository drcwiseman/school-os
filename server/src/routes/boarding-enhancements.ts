import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  boardingHouses, boardingRooms, boardingAllocations, students,
} from "../db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";

export const boardingEnhancementsRouter = Router();
boardingEnhancementsRouter.use(requireAuth, requireTenantMatch);

boardingEnhancementsRouter.get("/dashboard", requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rooms = await db.select().from(boardingRooms).where(eq(boardingRooms.tenantId, tenant.id));
    const active = await db.select().from(boardingAllocations).where(and(
      eq(boardingAllocations.tenantId, tenant.id),
      isNull(boardingAllocations.toDate),
    ));
    const [houses] = await db.select({ n: sql<number>`count(*)` }).from(boardingHouses).where(eq(boardingHouses.tenantId, tenant.id));
    const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
    res.json({
      success: true,
      data: {
        houses: Number(houses?.n ?? 0),
        rooms: rooms.length,
        capacity,
        occupied: active.length,
        pct: capacity ? Math.round((active.length / capacity) * 100) : 0,
        vacancies: Math.max(0, capacity - active.length),
      },
    });
  } catch (e) { next(e); }
});

boardingEnhancementsRouter.get("/allocations/enriched", requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      allocation: boardingAllocations,
      room: boardingRooms,
      house: boardingHouses,
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
    }).from(boardingAllocations)
      .innerJoin(boardingRooms, eq(boardingAllocations.roomId, boardingRooms.id))
      .innerJoin(boardingHouses, eq(boardingRooms.houseId, boardingHouses.id))
      .innerJoin(students, eq(boardingAllocations.studentId, students.id))
      .where(and(eq(boardingAllocations.tenantId, tenant.id), isNull(boardingAllocations.toDate)))
      .orderBy(desc(boardingAllocations.fromDate));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

boardingEnhancementsRouter.get("/rooms/grid", requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rooms = await db.select({
      room: boardingRooms,
      house: boardingHouses,
    }).from(boardingRooms)
      .innerJoin(boardingHouses, eq(boardingRooms.houseId, boardingHouses.id))
      .where(eq(boardingRooms.tenantId, tenant.id));
    const active = await db.select().from(boardingAllocations).where(and(
      eq(boardingAllocations.tenantId, tenant.id),
      isNull(boardingAllocations.toDate),
    ));
    const byRoom = new Map<string, number>();
    for (const a of active) byRoom.set(a.roomId, (byRoom.get(a.roomId) ?? 0) + 1);
    res.json({
      success: true,
      data: rooms.map((r) => ({
        ...r,
        occupied: byRoom.get(r.room.id) ?? 0,
        vacancy: Math.max(0, r.room.capacity - (byRoom.get(r.room.id) ?? 0)),
      })),
    });
  } catch (e) { next(e); }
});

boardingEnhancementsRouter.post("/setup-house", requirePermission("boarding.manage"),
  validate({
    body: z.object({
      houseName: z.string(),
      rooms: z.array(z.object({ name: z.string(), capacity: z.number().optional() })).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [house] = await db.insert(boardingHouses).values({ tenantId: tenant.id, name: req.body.houseName }).returning();
      const created = [];
      for (const r of req.body.rooms) {
        const [room] = await db.insert(boardingRooms).values({
          tenantId: tenant.id,
          houseId: house.id,
          name: r.name,
          capacity: r.capacity ?? 4,
        }).returning();
        created.push(room);
      }
      res.status(201).json({ success: true, data: { house, rooms: created } });
    } catch (e) { next(e); }
  },
);
