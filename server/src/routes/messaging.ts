import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { announcements, messageTemplates, campaigns, deliveryLogs } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { enqueueJob } from "../services/queue";
import { requireTenantFeature } from "../middleware/require-feature";

const router = Router();
const guard = [requireAuth, requireTenantMatch, requireTenantFeature("messaging_enabled")];

router.get("/templates", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(messageTemplates).where(eq(messageTemplates.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/templates", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ name: z.string(), channel: z.string().default("sms"), subject: z.string().optional(), body: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(messageTemplates).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/announcements", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(announcements).where(eq(announcements.tenantId, tenant.id)).orderBy(desc(announcements.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/announcements", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ title: z.string(), body: z.string(), audience: z.string().default("all") }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(announcements).values({ tenantId: tenant.id, ...req.body, createdBy: user.id }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/campaigns", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(campaigns).where(eq(campaigns.tenantId, tenant.id)).orderBy(desc(campaigns.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/campaigns", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ name: z.string(), templateId: z.string().uuid().optional(), audience: z.string().default("parents"), audienceFilter: z.record(z.string()).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(campaigns).values({
        tenantId: tenant.id, name: req.body.name, templateId: req.body.templateId,
        audience: req.body.audience, audienceFilter: req.body.audienceFilter ?? {},
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/campaigns/:id/send", ...guard, requirePermission("messaging.send"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const job = await enqueueJob(tenant.id, "campaign.send", { campaignId: req.params.id });
    res.json({ success: true, data: { jobId: job.id, message: "Campaign queued for delivery" } });
  } catch (e) { next(e); }
});

router.get("/delivery-logs", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(deliveryLogs).where(eq(deliveryLogs.tenantId, tenant.id)).orderBy(desc(deliveryLogs.createdAt)).limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

export default router;
