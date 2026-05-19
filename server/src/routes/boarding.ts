import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { boardingHouses, boardingRooms, boardingAllocations, welfareNotes } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

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

router.post("/houses/:id/rooms", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ name: z.string(), capacity: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(boardingRooms).values({ tenantId: tenant.id, houseId: req.params.id, name: req.body.name, capacity: req.body.capacity ?? 4 }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/allocations", ...guard, requirePermission("boarding.manage"),
  validate({ body: z.object({ roomId: z.string().uuid(), studentId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
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

export default router;
