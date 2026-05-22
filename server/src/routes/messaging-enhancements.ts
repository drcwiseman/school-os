import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { announcements, systemNotifications, deliveryLogs } from "../db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { requireTenantFeature } from "../middleware/require-feature";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { safeList } from "../lib/safe-route";
import { broadcastAnnouncement, resolveMessageRecipients, sendTenantMessage } from "../services/tenant-messaging";
import type { MessageAudience } from "../services/tenant-messaging";

const router = Router();
const guard = [requireAuth, requireTenantMatch, requireTenantFeature("messaging_enabled")];

router.get("/notifications", ...guard, requirePermission("messaging.view"), safeList("system-notifications", [], async (req) => {
  const tenant = (req as any).tenant;
  const user = (req as any).user;
  return db.select().from(systemNotifications).where(and(
    eq(systemNotifications.tenantId, tenant.id),
    sql`(${systemNotifications.userId} = ${user.id} OR ${systemNotifications.userId} IS NULL)`,
  )).orderBy(desc(systemNotifications.createdAt)).limit(50);
}));

router.patch("/notifications/:id/read", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    await db.update(systemNotifications).set({ readAt: new Date() }).where(and(
      eq(systemNotifications.id, req.params.id),
      eq(systemNotifications.tenantId, tenant.id),
      sql`(${systemNotifications.userId} = ${user.id} OR ${systemNotifications.userId} IS NULL)`,
    ));
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.patch("/notifications/read-all", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    await db.update(systemNotifications).set({ readAt: new Date() }).where(and(
      eq(systemNotifications.tenantId, tenant.id),
      isNull(systemNotifications.readAt),
      sql`(${systemNotifications.userId} = ${user.id} OR ${systemNotifications.userId} IS NULL)`,
    ));
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post("/sms/send", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    to: z.string().optional(),
    body: z.string().min(1),
    audience: z.enum(["parents", "staff", "students", "parents_of_class"]).optional(),
    classId: z.string().uuid().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      let sent = 0;
      let failed = 0;

      if (req.body.to) {
        const r = await sendTenantMessage(tenant.id, { to: req.body.to, body: req.body.body, channel: "sms" });
        return res.json({ success: true, data: { sent: r.success ? 1 : 0, failed: r.success ? 0 : 1 } });
      }

      const audience = (req.body.audience ?? "parents") as MessageAudience;
      const recipients = await resolveMessageRecipients(tenant.id, audience, { classId: req.body.classId });
      for (const rec of recipients.filter((r) => r.channel === "sms")) {
        const r = await sendTenantMessage(tenant.id, { to: rec.to, body: req.body.body, channel: "sms" });
        if (r.success) sent++;
        else failed++;
      }
      res.json({ success: true, data: { sent, failed } });
    } catch (e) { next(e); }
  },
);

router.post("/email/send", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    to: z.string().email().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
    audience: z.enum(["parents", "staff", "students", "parents_of_class"]).optional(),
    classId: z.string().uuid().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      let sent = 0;
      let failed = 0;

      if (req.body.to) {
        const r = await sendTenantMessage(tenant.id, {
          to: req.body.to, subject: req.body.subject, body: req.body.body, channel: "email",
        });
        return res.json({ success: true, data: { sent: r.success ? 1 : 0, failed: r.success ? 0 : 1 } });
      }

      const audience = (req.body.audience ?? "parents") as MessageAudience;
      const recipients = await resolveMessageRecipients(tenant.id, audience, { classId: req.body.classId });
      for (const rec of recipients.filter((r) => r.channel === "email")) {
        const r = await sendTenantMessage(tenant.id, {
          to: rec.to, subject: req.body.subject, body: req.body.body, channel: "email",
        });
        if (r.success) sent++;
        else failed++;
      }
      res.json({ success: true, data: { sent, failed } });
    } catch (e) { next(e); }
  },
);

router.post("/announcements/:id/broadcast", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({
    channels: z.array(z.enum(["sms", "email", "in_app"])).min(1),
    classId: z.string().uuid().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [ann] = await db.select().from(announcements).where(and(
        eq(announcements.id, req.params.id), eq(announcements.tenantId, tenant.id),
      )).limit(1);
      if (!ann) throw new NotFoundError("Announcement not found");
      const result = await broadcastAnnouncement(
        tenant.id,
        { id: ann.id, title: ann.title, body: ann.body, audience: ann.audience },
        req.body.channels,
        req.body.classId ? { classId: req.body.classId } : undefined,
      );
      await db.update(announcements).set({ notifyChannels: req.body.channels }).where(eq(announcements.id, ann.id));
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },
);

router.get("/stats", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const rows = await db.select({
      channel: deliveryLogs.channel,
      status: deliveryLogs.status,
      count: sql<number>`count(*)::int`,
    }).from(deliveryLogs)
      .where(and(eq(deliveryLogs.tenantId, tenant.id), sql`${deliveryLogs.createdAt} >= ${since}`))
      .groupBy(deliveryLogs.channel, deliveryLogs.status);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

export default router;
