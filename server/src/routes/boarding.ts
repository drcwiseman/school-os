import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  boardingHouses, boardingRooms, boardingAllocations, welfareNotes,
  hostelVisitors, hostelAttendance, hostelMeals, hostelDisciplinary, boardingRoomHistory,
} from "../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/houses", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(boardingHouses).where(eq(boardingHouses.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/houses", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ name: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(boardingHouses).values({ tenantId: tenant.id, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/rooms", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(boardingRooms).where(eq(boardingRooms.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.get("/occupancy", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rooms = await db.select().from(boardingRooms).where(eq(boardingRooms.tenantId, tenant.id));
    const active = await db.select().from(boardingAllocations).where(and(eq(boardingAllocations.tenantId, tenant.id), isNull(boardingAllocations.toDate)));
    const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
    res.json({ success: true, data: { rooms: rooms.length, capacity, occupied: active.length, pct: capacity ? Math.round((active.length / capacity) * 100) : 0 } });
  } catch (e) { next(e); }
});

router.post("/rooms", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ houseId: z.string().uuid(), name: z.string(), capacity: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(boardingRooms).values({ tenantId: tenant.id, houseId: req.body.houseId, name: req.body.name, capacity: req.body.capacity ?? 4 }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/allocations", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(boardingAllocations).where(eq(boardingAllocations.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/allocations", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ roomId: z.string().uuid(), studentId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [existing] = await db.select().from(boardingAllocations).where(and(
        eq(boardingAllocations.tenantId, tenant.id),
        eq(boardingAllocations.studentId, req.body.studentId),
        isNull(boardingAllocations.toDate),
      )).limit(1);
      if (existing) {
        await db.update(boardingAllocations).set({ toDate: new Date() }).where(eq(boardingAllocations.id, existing.id));
        await db.insert(boardingRoomHistory).values({
          tenantId: tenant.id,
          studentId: req.body.studentId,
          fromRoomId: existing.roomId,
          toRoomId: req.body.roomId,
          changedBy: user.id,
        });
      }
      const [row] = await db.insert(boardingAllocations).values({ tenantId: tenant.id, roomId: req.body.roomId, studentId: req.body.studentId }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/welfare-notes", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(welfareNotes).where(eq(welfareNotes.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/welfare-notes", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), note: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(welfareNotes).values({ tenantId: tenant.id, studentId: req.body.studentId, note: req.body.note, createdBy: user.id }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/visitors", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(hostelVisitors).where(eq(hostelVisitors.tenantId, tenant.id)).orderBy(desc(hostelVisitors.checkIn)) });
  } catch (e) { next(e); }
});

router.post("/visitors", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ visitorName: z.string(), studentId: z.string().uuid().optional(), purpose: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(hostelVisitors).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/visitors/:id/checkout", ...guard, requirePermission("boarding.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.update(hostelVisitors).set({ checkOut: new Date() }).where(and(eq(hostelVisitors.id, req.params.id), eq(hostelVisitors.tenantId, tenant.id))).returning();
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/attendance", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(hostelAttendance).where(eq(hostelAttendance.tenantId, tenant.id)).orderBy(desc(hostelAttendance.date)) });
  } catch (e) { next(e); }
});

router.post("/attendance", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), date: z.string(), status: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(hostelAttendance).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/meals", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(hostelMeals).where(eq(hostelMeals.tenantId, tenant.id)).orderBy(desc(hostelMeals.date)) });
  } catch (e) { next(e); }
});

router.post("/meals", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ date: z.string(), mealType: z.string(), menuJson: z.record(z.unknown()).optional(), attendanceCount: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(hostelMeals).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/disciplinary", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(hostelDisciplinary).where(eq(hostelDisciplinary.tenantId, tenant.id)).orderBy(desc(hostelDisciplinary.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/disciplinary", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), incident: z.string(), actionTaken: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(hostelDisciplinary).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/room-history", ...guard, requirePermission("boarding.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const studentId = req.query.studentId as string | undefined;
    const where = studentId
      ? and(eq(boardingRoomHistory.tenantId, tenant.id), eq(boardingRoomHistory.studentId, studentId))
      : eq(boardingRoomHistory.tenantId, tenant.id);
    res.json({ success: true, data: await db.select().from(boardingRoomHistory).where(where).orderBy(desc(boardingRoomHistory.changedAt)) });
  } catch (e) { next(e); }
});

export default router;
