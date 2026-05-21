import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../db";
import {
  users, sessions, tenantSettings, auditLogs, students, staff,
  tenantApiKeys, tenantWebhookEndpoints,
} from "../db/schema";
import { eq, and, desc, isNull, sql, gt } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { generateTotpSecret, verifyTotp, totpProvisioningUri } from "../utils/totp";
import { createAuditLog } from "../services/audit";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/sessions", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const rows = await db.select({
      id: sessions.id,
      userId: sessions.userId,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
    }).from(sessions)
      .where(and(eq(sessions.tenantId, tenant.id), eq(sessions.userId, user.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/sessions/all", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(sessions).where(eq(sessions.tenantId, tenant.id)).orderBy(desc(sessions.createdAt)).limit(100);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/sessions/:id/revoke", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, req.params.id), eq(sessions.tenantId, tenant.id))).returning();
    if (!row) throw new NotFoundError("Session not found");
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post("/mfa/setup", ...guard, async (req, res, next) => {
  try {
    const user = (req as any).user;
    const tenant = (req as any).tenant;
    const secret = generateTotpSecret();
    await db.update(users).set({ mfaSecret: secret }).where(eq(users.id, user.id));
    res.json({
      success: true,
      data: {
        secret,
        uri: totpProvisioningUri(user.email, tenant.name, secret),
      },
    });
  } catch (e) { next(e); }
});

router.post("/mfa/enable", ...guard,
  validate({ body: z.object({ token: z.string().length(6) }) }),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (!u?.mfaSecret || !verifyTotp(u.mfaSecret, req.body.token)) {
        return res.status(400).json({ success: false, message: "Invalid code" });
      }
      await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, user.id));
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

router.get("/settings", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [s] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    res.json({ success: true, data: s?.securityJson ?? {} });
  } catch (e) { next(e); }
});

router.put("/settings", ...guard, requirePermission("settings.manage"),
  validate({ body: z.object({ ipAllowlist: z.array(z.string()).optional(), mfaRequired: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      await db.update(tenantSettings).set({ securityJson: req.body }).where(eq(tenantSettings.tenantId, tenant.id));
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

router.get("/activity", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenant.id)).orderBy(desc(auditLogs.createdAt)).limit(100);
    const byAction = await db.select({ action: auditLogs.action, count: sql<number>`count(*)` })
      .from(auditLogs).where(eq(auditLogs.tenantId, tenant.id)).groupBy(auditLogs.action).limit(20);
    res.json({ success: true, data: { recent: rows, byAction } });
  } catch (e) { next(e); }
});

router.get("/compliance-export", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    const studentRows = await db.select().from(students).where(and(eq(students.tenantId, tenant.id), isNull(students.deletedAt))).limit(5000);
    const staffRows = await db.select().from(staff).where(eq(staff.tenantId, tenant.id)).limit(2000);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenant.id)).orderBy(desc(auditLogs.createdAt)).limit(5000);
    res.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        settings: settings ?? null,
        counts: { students: studentRows.length, staff: staffRows.length, auditLogs: logs.length },
        students: studentRows,
        staff: staffRows,
        auditLogs: logs,
      },
    });
  } catch (e) { next(e); }
});

router.get("/api-keys", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      id: tenantApiKeys.id,
      name: tenantApiKeys.name,
      keyPrefix: tenantApiKeys.keyPrefix,
      scopesJson: tenantApiKeys.scopesJson,
      lastUsedAt: tenantApiKeys.lastUsedAt,
      createdAt: tenantApiKeys.createdAt,
    }).from(tenantApiKeys).where(eq(tenantApiKeys.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/api-keys", ...guard, requirePermission("settings.manage"),
  validate({ body: z.object({ name: z.string(), scopes: z.array(z.string()).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const raw = `sk_${crypto.randomBytes(24).toString("hex")}`;
      const prefix = raw.slice(0, 12);
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      const [row] = await db.insert(tenantApiKeys).values({
        tenantId: tenant.id,
        name: req.body.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopesJson: req.body.scopes ?? ["read"],
      }).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: (req as any).user.id, action: "api_key.create", entityType: "api_key", entityId: row.id, after: { name: row.name }, ip: req.ip });
      res.status(201).json({ success: true, data: { ...row, key: raw } });
    } catch (e) { next(e); }
  },
);

router.get("/webhooks", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(tenantWebhookEndpoints).where(eq(tenantWebhookEndpoints.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/webhooks", ...guard, requirePermission("settings.manage"),
  validate({ body: z.object({ url: z.string().url(), events: z.array(z.string()).optional(), secret: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(tenantWebhookEndpoints).values({
        tenantId: tenant.id,
        url: req.body.url,
        eventsJson: req.body.events ?? ["invoice.paid"],
        secret: req.body.secret ?? crypto.randomBytes(16).toString("hex"),
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default router;
