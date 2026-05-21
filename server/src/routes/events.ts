import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { schoolEvents } from "../db/schema";
import { eq, and, desc, gte, lte, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(schoolEvents)
      .where(eq(schoolEvents.tenantId, tenant.id))
      .orderBy(desc(schoolEvents.startsAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/upcoming", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const now = new Date();
    const in60 = new Date(now);
    in60.setDate(in60.getDate() + 60);
    const rows = await db.select().from(schoolEvents).where(and(
      eq(schoolEvents.tenantId, tenant.id),
      eq(schoolEvents.published, true),
      gte(schoolEvents.startsAt, now),
      lte(schoolEvents.startsAt, in60),
    )).orderBy(schoolEvents.startsAt).limit(20);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/", ...guard, requirePermission("messaging.manage"),
  validate({
    body: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      eventType: z.enum(["academic", "cultural", "sports", "other"]).default("academic"),
      venue: z.string().optional(),
      startsAt: z.string(),
      endsAt: z.string().optional(),
      audience: z.enum(["all", "parents", "staff", "students"]).default("all"),
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

router.patch("/:id", ...guard, requirePermission("messaging.manage"),
  validate({
    body: z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      eventType: z.enum(["academic", "cultural", "sports", "other"]).optional(),
      venue: z.string().optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional().nullable(),
      audience: z.enum(["all", "parents", "staff", "students"]).optional(),
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
      if (!row) throw new NotFoundError("Event not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/:id", ...guard, requirePermission("messaging.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(schoolEvents).where(and(eq(schoolEvents.id, req.params.id), eq(schoolEvents.tenantId, tenant.id)));
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
