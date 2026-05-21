import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { staffHostelBlocks, staffHostelRooms, staffHostelAllocations, staff } from "../db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

export const staffHostelRouter = Router();
staffHostelRouter.use(requireAuth, requireTenantMatch);

staffHostelRouter.get("/dashboard", requirePermission("staff_hostel.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rooms = await db.select().from(staffHostelRooms).where(eq(staffHostelRooms.tenantId, tenant.id));
    const active = await db.select().from(staffHostelAllocations).where(and(
      eq(staffHostelAllocations.tenantId, tenant.id),
      isNull(staffHostelAllocations.toDate),
    ));
    const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
    res.json({
      success: true,
      data: {
        rooms: rooms.length,
        capacity,
        occupied: active.length,
        pct: capacity ? Math.round((active.length / capacity) * 100) : 0,
      },
    });
  } catch (e) { next(e); }
});

staffHostelRouter.get("/blocks", requirePermission("staff_hostel.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(staffHostelBlocks).where(eq(staffHostelBlocks.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

staffHostelRouter.post("/blocks", requirePermission("staff_hostel.manage"),
  validate({ body: z.object({ name: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(staffHostelBlocks).values({ tenantId: tenant.id, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

staffHostelRouter.get("/rooms", requirePermission("staff_hostel.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      room: staffHostelRooms,
      block: staffHostelBlocks,
      occupied: sql<number>`(
        select count(*)::int from staff_hostel_allocations a
        where a.room_id = ${staffHostelRooms.id} and a.tenant_id = ${tenant.id} and a.to_date is null
      )`,
    }).from(staffHostelRooms)
      .innerJoin(staffHostelBlocks, eq(staffHostelRooms.blockId, staffHostelBlocks.id))
      .where(eq(staffHostelRooms.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

staffHostelRouter.post("/setup-block", requirePermission("staff_hostel.manage"),
  validate({
    body: z.object({
      blockName: z.string(),
      rooms: z.array(z.object({ name: z.string(), capacity: z.number().optional() })).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [block] = await db.insert(staffHostelBlocks).values({ tenantId: tenant.id, name: req.body.blockName }).returning();
      const created = [];
      for (const r of req.body.rooms) {
        const [room] = await db.insert(staffHostelRooms).values({
          tenantId: tenant.id, blockId: block.id, name: r.name, capacity: r.capacity ?? 2,
        }).returning();
        created.push(room);
      }
      res.status(201).json({ success: true, data: { block, rooms: created } });
    } catch (e) { next(e); }
  },
);

staffHostelRouter.get("/allocations", requirePermission("staff_hostel.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      allocation: staffHostelAllocations,
      room: staffHostelRooms,
      block: staffHostelBlocks,
      staffMember: { firstName: staff.firstName, lastName: staff.lastName, employeeNo: staff.employeeNo, department: staff.department },
    }).from(staffHostelAllocations)
      .innerJoin(staffHostelRooms, eq(staffHostelAllocations.roomId, staffHostelRooms.id))
      .innerJoin(staffHostelBlocks, eq(staffHostelRooms.blockId, staffHostelBlocks.id))
      .innerJoin(staff, eq(staffHostelAllocations.staffId, staff.id))
      .where(and(eq(staffHostelAllocations.tenantId, tenant.id), isNull(staffHostelAllocations.toDate)))
      .orderBy(desc(staffHostelAllocations.fromDate));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

staffHostelRouter.post("/allocations", requirePermission("staff_hostel.manage"),
  validate({ body: z.object({ roomId: z.string().uuid(), staffId: z.string().uuid(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(staffHostelAllocations).where(and(
        eq(staffHostelAllocations.tenantId, tenant.id),
        eq(staffHostelAllocations.staffId, req.body.staffId),
        isNull(staffHostelAllocations.toDate),
      )).limit(1);
      if (existing) {
        await db.update(staffHostelAllocations).set({ toDate: new Date() }).where(eq(staffHostelAllocations.id, existing.id));
      }
      const [row] = await db.insert(staffHostelAllocations).values({
        tenantId: tenant.id,
        roomId: req.body.roomId,
        staffId: req.body.staffId,
        notes: req.body.notes ?? null,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

staffHostelRouter.post("/allocations/:id/vacate", requirePermission("staff_hostel.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.update(staffHostelAllocations).set({ toDate: new Date() }).where(and(
      eq(staffHostelAllocations.id, req.params.id),
      eq(staffHostelAllocations.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Allocation not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

export default staffHostelRouter;
