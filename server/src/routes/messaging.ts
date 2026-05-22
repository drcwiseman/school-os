import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { announcements, messageTemplates, campaigns, deliveryLogs, internalMessages, pushSubscriptions } from "../db/schema";
import { sendViaIntegration } from "../services/integration-runtime";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { safeList } from "../lib/safe-route";
import { enqueueJob } from "../services/queue";
import { requireTenantFeature } from "../middleware/require-feature";
import { promoteScheduledAnnouncements } from "../services/announcements";
import { broadcastAnnouncement } from "../services/tenant-messaging";

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

router.get("/dashboard", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const data = {
      announcements: 0,
      published: 0,
      templates: 0,
      campaigns: 0,
      draftCampaigns: 0,
      deliveryLogs7d: 0,
      unreadNotifications: 0,
    };
    try {
      const [a] = await db.select({
        total: sql<number>`count(*)`,
        published: sql<number>`count(*) filter (where ${announcements.published} = true)`,
      }).from(announcements).where(eq(announcements.tenantId, tenant.id));
      data.announcements = Number(a?.total ?? 0);
      data.published = Number(a?.published ?? 0);
    } catch { /* ignore */ }
    try {
      const [t] = await db.select({ n: sql<number>`count(*)` }).from(messageTemplates).where(eq(messageTemplates.tenantId, tenant.id));
      data.templates = Number(t?.n ?? 0);
    } catch { /* ignore */ }
    try {
      const [c] = await db.select({
        total: sql<number>`count(*)`,
        draft: sql<number>`count(*) filter (where ${campaigns.status} = 'draft')`,
      }).from(campaigns).where(eq(campaigns.tenantId, tenant.id));
      data.campaigns = Number(c?.total ?? 0);
      data.draftCampaigns = Number(c?.draft ?? 0);
    } catch { /* ignore */ }
    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const [l] = await db.select({ n: sql<number>`count(*)` }).from(deliveryLogs).where(and(
        eq(deliveryLogs.tenantId, tenant.id),
        sql`${deliveryLogs.createdAt} >= ${since}`,
      ));
      data.deliveryLogs7d = Number(l?.n ?? 0);
    } catch { /* ignore */ }
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get("/templates", ...guard, requirePermission("messaging.view"), safeList("message-templates", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(messageTemplates).where(eq(messageTemplates.tenantId, tenant.id)).orderBy(asc(messageTemplates.name));
}));

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

router.get("/announcements", ...guard, requirePermission("messaging.view"), safeList("announcements", [], async (req) => {
  const tenant = (req as any).tenant;
  await promoteScheduledAnnouncements(tenant.id);
  return db.select().from(announcements).where(eq(announcements.tenantId, tenant.id)).orderBy(desc(announcements.createdAt));
}));

router.post("/announcements", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    title: z.string(),
    body: z.string(),
    audience: z.enum(["all", "parents", "staff", "students"]).default("all"),
    notifyChannels: z.array(z.enum(["sms", "email", "in_app"])).optional(),
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
        notifyChannels: req.body.notifyChannels ?? [],
        createdBy: user.id,
      }).returning();
      if (pub.published && req.body.notifyChannels?.length) {
        await broadcastAnnouncement(tenant.id, row, req.body.notifyChannels);
      }
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/announcements/:id", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    published: z.boolean().optional(),
    audience: z.enum(["all", "parents", "staff", "students"]).optional(),
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

router.patch("/templates/:id", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ name: z.string().optional(), channel: z.string().optional(), subject: z.string().optional(), body: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(messageTemplates).set(req.body).where(and(
        eq(messageTemplates.id, req.params.id),
        eq(messageTemplates.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Template not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/templates/:id", ...guard, requirePermission("messaging.send"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(messageTemplates).where(and(
      eq(messageTemplates.id, req.params.id),
      eq(messageTemplates.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Template not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/campaigns", ...guard, requirePermission("messaging.view"), safeList("campaigns", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(campaigns).where(eq(campaigns.tenantId, tenant.id)).orderBy(desc(campaigns.createdAt));
}));

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

router.patch("/campaigns/:id", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    name: z.string().optional(),
    channel: z.enum(["sms", "email", "whatsapp"]).optional(),
    templateId: z.string().uuid().nullable().optional(),
    audience: z.string().optional(),
    audienceFilter: z.record(z.string()).optional(),
    status: z.enum(["draft", "queued", "sent", "cancelled"]).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const updates: Record<string, unknown> = { ...req.body };
      if (req.body.templateId === null) updates.templateId = null;
      const [row] = await db.update(campaigns).set(updates).where(and(
        eq(campaigns.id, req.params.id),
        eq(campaigns.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Campaign not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/campaigns/:id", ...guard, requirePermission("messaging.send"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [existing] = await db.select().from(campaigns).where(and(
      eq(campaigns.id, req.params.id),
      eq(campaigns.tenantId, tenant.id),
    )).limit(1);
    if (!existing) throw new NotFoundError("Campaign not found");
    if (existing.status === "sent") {
      return res.status(400).json({ success: false, message: "Cannot delete a sent campaign" });
    }
    const [row] = await db.delete(campaigns).where(eq(campaigns.id, req.params.id)).returning();
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post("/campaigns/:id/send", ...guard, requirePermission("messaging.send"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [c] = await db.select().from(campaigns).where(and(
      eq(campaigns.id, req.params.id),
      eq(campaigns.tenantId, tenant.id),
    )).limit(1);
    if (!c) throw new NotFoundError("Campaign not found");
    await db.update(campaigns).set({ status: "queued" }).where(eq(campaigns.id, c.id));
    const job = await enqueueJob(tenant.id, "campaign.send", { campaignId: req.params.id });
    res.json({ success: true, data: { jobId: job.id, message: "Campaign queued for delivery" } });
  } catch (e) { next(e); }
});

router.get("/internal", ...guard, requirePermission("messaging.view"), safeList("internal-messages", [], async (req) => {
  const tenant = (req as any).tenant;
  const user = (req as any).user;
  return db.select().from(internalMessages)
    .where(and(eq(internalMessages.tenantId, tenant.id), sql`(${internalMessages.toUserId} = ${user.id} OR ${internalMessages.toUserId} IS NULL OR ${internalMessages.fromUserId} = ${user.id})`))
    .orderBy(desc(internalMessages.createdAt))
    .limit(100);
}));

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

router.get("/delivery-logs", ...guard, requirePermission("messaging.view"), safeList("delivery-logs", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(deliveryLogs).where(eq(deliveryLogs.tenantId, tenant.id)).orderBy(desc(deliveryLogs.createdAt)).limit(200);
}));

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
