import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { announcements, messageTemplates, campaigns, deliveryLogs, internalMessages, pushSubscriptions } from "../db/schema";
import { sendViaIntegration } from "../services/integration-runtime";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { enqueueJob } from "../services/queue";
import { requireTenantFeature } from "../middleware/require-feature";
import { promoteScheduledAnnouncements } from "../services/announcements";

const router = Router();

function resolvePublishFields(published?: boolean, publishAtRaw?: string | null) {
  const publishAt = publishAtRaw ? new Date(publishAtRaw) : null;
  if (publishAt && publishAt.getTime() > Date.now()) {
    return { published: false, publishAt };
  }
  if (published === true || (publishAt && publishAt.getTime() <= Date.now())) {
    return { published: true, publishAt: publishAt ?? null };
  }
  return { published: false, publishAt };
}
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
    await promoteScheduledAnnouncements(tenant.id);
    res.json({ success: true, data: await db.select().from(announcements).where(eq(announcements.tenantId, tenant.id)).orderBy(desc(announcements.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/announcements", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    title: z.string(),
    body: z.string(),
    audience: z.enum(["all", "parents", "staff"]).default("all"),
    published: z.boolean().optional(),
    publishAt: z.string().nullable().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const pub = resolvePublishFields(req.body.published, req.body.publishAt);
      const [row] = await db.insert(announcements).values({
        tenantId: tenant.id,
        title: req.body.title,
        body: req.body.body,
        audience: req.body.audience,
        published: pub.published,
        publishAt: pub.publishAt,
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/announcements/:id", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    published: z.boolean().optional(),
    audience: z.enum(["all", "parents", "staff"]).optional(),
    publishAt: z.string().nullable().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const updates: Record<string, unknown> = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.body !== undefined) updates.body = req.body.body;
      if (req.body.audience !== undefined) updates.audience = req.body.audience;
      if (req.body.published !== undefined || req.body.publishAt !== undefined) {
        const pub = resolvePublishFields(req.body.published, req.body.publishAt);
        updates.published = pub.published;
        updates.publishAt = pub.publishAt;
      }
      const [row] = await db.update(announcements).set(updates).where(and(
        eq(announcements.id, req.params.id),
        eq(announcements.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Announcement not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.delete("/announcements/:id", ...guard, requirePermission("messaging.send"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(announcements).where(and(
      eq(announcements.id, req.params.id),
      eq(announcements.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Announcement not found");
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/campaigns", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(campaigns).where(eq(campaigns.tenantId, tenant.id)).orderBy(desc(campaigns.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/campaigns", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    name: z.string(),
    channel: z.enum(["sms", "email", "whatsapp"]).default("sms"),
    templateId: z.string().uuid().optional(),
    audience: z.string().default("parents"),
    audienceFilter: z.record(z.string()).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(campaigns).values({
        tenantId: tenant.id, name: req.body.name, channel: req.body.channel, templateId: req.body.templateId,
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

router.get("/internal", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const rows = await db.select().from(internalMessages)
      .where(and(eq(internalMessages.tenantId, tenant.id), sql`(${internalMessages.toUserId} = ${user.id} OR ${internalMessages.toUserId} IS NULL OR ${internalMessages.fromUserId} = ${user.id})`))
      .orderBy(desc(internalMessages.createdAt))
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/internal", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ toUserId: z.string().uuid().optional(), body: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(internalMessages).values({
        tenantId: tenant.id, fromUserId: user.id, toUserId: req.body.toUserId, body: req.body.body,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/whatsapp/test", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ phone: z.string(), message: z.string() }) }),
  async (req, res, next) => {
    try {
      const result = await sendViaIntegration("whatsapp_business", { to: req.body.phone, body: req.body.message, channel: "whatsapp" });
      res.json({ success: result.success, data: result });
    } catch (e) { next(e); }
  }
);

router.get("/delivery-logs", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(deliveryLogs).where(eq(deliveryLogs.tenantId, tenant.id)).orderBy(desc(deliveryLogs.createdAt)).limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/push/subscribe", ...guard,
  validate({ body: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(pushSubscriptions).values({
        tenantId: tenant.id,
        userId: user.id,
        endpoint: req.body.endpoint,
        keysJson: req.body.keys,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default router;
