import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  tenants, tenantSettings, users, roles, rolePermissions, permissions,
  plans, tenantPlans, platformAdmins, students, jobs, payments, staff, userRoles,
} from "../db/schema";
import { eq, sql, isNull } from "drizzle-orm";
import { SUPPORTED_CURRENCIES, CURRENCY_CODES, defaultCurrencyForCountry, DEFAULT_COUNTRY, DEFAULT_CURRENCY } from "../lib/currencies";
import { getExchangeRates, convertMinor } from "../services/currency-exchange";
import { getPlatformDefaults, setPlatformDefaults, getPlatformMarketing, setPlatformMarketing } from "../services/platform-settings";
import { INTEGRATIONS_CATALOG } from "../lib/integrations-catalog";
import { getPlansWithRegionalPricing } from "../services/plan-pricing";
import {
  createPlan,
  updatePlan,
  deletePlan,
  getPlanByCode,
  upsertRegionalPrice,
  deleteRegionalPrice,
  normalizePlanCode,
  getPlanFeatureCatalog,
} from "../services/platform-plans";
import {
  listPlatformSubscriptions,
  assignTenantPlan,
  updateTenantSubscription,
  removeTenantPlan,
} from "../services/platform-subscriptions";
import { getPlatformRevenueLedger } from "../services/platform-revenue-ledger";
import { getPlatformInvoicesLedger } from "../services/platform-invoices";
import { getPlatformTransactionsLedger } from "../services/platform-transactions";
import {
  getPlatformPayoutsLedger,
  createPlatformPayout,
  updatePlatformPayoutStatus,
  type PayoutStatus,
} from "../services/platform-payouts";
import {
  listPlatformAdmins,
  createPlatformAdmin,
  updatePlatformAdmin,
  deletePlatformAdmin,
  resetPlatformAdminPassword,
  isPlatformRole,
  getRoleMeta,
} from "../services/platform-admins";
import {
  getPlatformRolesOverview,
  patchPlatformRolePermissions,
  restorePlatformRoleDefaults,
} from "../services/platform-roles";
import {
  setTenantFeature,
  listFeatureCatalog,
  getTenantFeaturesDetailed,
  setTenantFeaturesBulk,
  enableDefaultFeaturesForTenant,
} from "../services/tenant-features";
import { hashPassword } from "../middleware/auth";
import {
  createPlatformSession, requirePlatformAuth, verifyPassword,
  revokePlatformSession, clearPlatformSessionCookie,
} from "../middleware/platform-auth";
import { platformSessionCookieOptions } from "../lib/platform-cookie";
import { validate } from "../utils/validate";
import { NotFoundError, ConflictError, UnauthorizedError, BadRequestError } from "../middleware/error";
import { requirePlatformPermission } from "../lib/platform-permissions";
import { createAuditLog } from "../services/audit";
import { platformAdminAuthColumns, platformAdminPublic } from "../db/platform-admin-columns";
import {
  setCustomDomain, verifyCustomDomain, getDomainInstructions,
} from "../services/domain-verify";
import {
  createPlatformAuditLog,
  logPlatformAction,
  listGlobalAuditFeed,
  getPlatformAuditHub,
  getPlatformAuditEventDetail,
} from "../services/platform-audit";
import {
  getPlatformSystemLogsHub,
  getPlatformJobLogDetail,
  getPlatformDeliveryLogDetail,
} from "../services/platform-system-logs";
import {
  getPlatformQueueHub,
  getPlatformQueueJobDetail,
  retryPlatformJob,
  triggerQueueProcessing,
} from "../services/platform-queue";
import {
  listPlatformMedia,
  createPlatformMedia,
  updatePlatformMedia,
  deletePlatformMedia,
  getPlatformMediaById,
  servePlatformMediaFile,
} from "../services/platform-media";
import {
  getPlatformEmailHub,
  getPlatformSmtpPublic,
  setPlatformSmtp,
  updatePlatformEmailTemplate,
  previewPlatformEmailTemplate,
  sendPlatformSmtpTest,
  verifyPlatformSmtpConnection,
  sendPlatformEmailWithTemplate,
  getPlatformEmailTemplate,
} from "../services/platform-email-settings";
import { listPlatformEmailLogs } from "../services/platform-email-log";
import {
  getPlatformIntegrationsHub,
  getPlatformIntegrationConfig,
  updatePlatformIntegrationConfig,
  testPlatformIntegrationConnection,
} from "../services/platform-integrations-settings";
import {
  getPlatformBackupHub,
  setBackupPolicy,
  createBackupSnapshot,
  deleteBackupSnapshot,
  resolveBackupFilePath,
  restoreBackupSnapshot,
} from "../services/platform-backup";
import {
  getPlatformGeneralSettings,
  setPlatformGeneralSettings,
} from "../services/platform-general-settings";
import {
  listPlatformEmailCampaigns,
  createPlatformEmailCampaign,
  updatePlatformEmailCampaign,
  sendPlatformEmailCampaignNow,
} from "../services/platform-email-campaigns";
import { searchPlatform } from "../services/platform-search";
import { getPlatformNotificationsHub } from "../services/platform-notifications";
import { getPlatformFeatureFlagsHub, bulkSetFeatureForSchools } from "../services/platform-feature-flags-hub";
import {
  getPlatformApiSettings,
  createPlatformApiKey,
  deletePlatformApiKey,
  upsertOutboundWebhook,
} from "../services/platform-api-settings";
import {
  getPlatformSupportHub,
  createPlatformSupportTicket,
  updatePlatformSupportTicket,
  addPlatformSupportTicketMessage,
  getPlatformSupportTicketDetail,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
} from "../services/platform-support";
import {
  createImpersonationToken,
  listImpersonationTargets,
  resolveImpersonationUser,
} from "../services/impersonation";
import {
  getTenantAddonsDetailed, activateTenantAddon, deactivateTenantAddon, listAddonCatalog,
} from "../services/tenant-addons";
import {
  getTenantUsage, generateBillingLines, getBillingLines, currentBillingCycle,
} from "../services/usage-billing";
import { listPlatformTenants } from "../services/platform-tenants-list";
import { slugifySchoolName, uniqueTenantSlug } from "../lib/slug";

const router = Router();

const createTenantSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  name: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  planCode: z.string().optional(),
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
});

router.post("/auth/login", validate({ body: z.object({ email: z.string().email(), password: z.string() }) }), async (req, res, next) => {
  try {
    const [admin] = await db.select(platformAdminAuthColumns).from(platformAdmins).where(eq(platformAdmins.email, req.body.email)).limit(1);
    if (!admin) throw new UnauthorizedError("Invalid credentials");
    const valid = await verifyPassword(req.body.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");
    const session = await createPlatformSession(admin.id);
    res.cookie("platform_session_token", session.token, platformSessionCookieOptions());
    await logPlatformAction(admin.id, "platform.auth.login", {
      entityType: "platform_admin",
      entityId: admin.id,
      ip: req.ip,
    });
    res.json({ success: true, admin: platformAdminPublic(admin) });
  } catch (err) { next(err); }
});

router.get("/auth/me", requirePlatformAuth, async (req, res, next) => {
  try {
    const admin = (req as any).platformAdmin;
    res.json({ success: true, admin: platformAdminPublic(admin) });
  } catch (err) { next(err); }
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.platform_session_token as string | undefined;
  await revokePlatformSession(token);
  clearPlatformSessionCookie(res);
  res.json({ success: true });
});

router.patch("/auth/profile", requirePlatformAuth,
  validate({ body: z.object({ name: z.string().min(1).max(120) }) }),
  async (req, res, next) => {
    try {
      const admin = (req as any).platformAdmin;
      const [updated] = await db.update(platformAdmins)
        .set({ name: req.body.name })
        .where(eq(platformAdmins.id, admin.id))
        .returning(platformAdminAuthColumns);
      res.json({ success: true, admin: platformAdminPublic(updated) });
    } catch (err) { next(err); }
  },
);

router.patch("/auth/password", requirePlatformAuth,
  validate({ body: z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }) }),
  async (req, res, next) => {
    try {
      const admin = (req as any).platformAdmin;
      const valid = await verifyPassword(req.body.currentPassword, admin.passwordHash);
      if (!valid) throw new UnauthorizedError("Current password is incorrect");
      const passwordHash = await hashPassword(req.body.newPassword);
      await db.update(platformAdmins).set({ passwordHash }).where(eq(platformAdmins.id, admin.id));
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

router.get("/currencies", requirePlatformAuth, async (_req, res) => {
  res.json({ success: true, data: SUPPORTED_CURRENCIES });
});

router.get("/exchange-rates", requirePlatformAuth, async (req, res, next) => {
  try {
    const base = String(req.query.base ?? "USD").toUpperCase();
    if (!CURRENCY_CODES.has(base)) return res.status(400).json({ success: false, message: "Unsupported base currency" });
    const rates = await getExchangeRates(base);
    res.json({ success: true, data: { base, rates, provider: "frankfurter.app" } });
  } catch (err) { next(err); }
});

router.get("/settings", requirePlatformAuth, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformDefaults() });
  } catch (err) { next(err); }
});

router.patch("/settings", requirePlatformAuth, requirePlatformPermission("stats.read"),
  validate({ body: z.object({ displayCurrency: z.string().length(3) }) }),
  async (req, res, next) => {
    try {
      const code = req.body.displayCurrency.toUpperCase();
      if (!CURRENCY_CODES.has(code)) return res.status(400).json({ success: false, message: "Unsupported currency" });
      res.json({ success: true, data: await setPlatformDefaults({ displayCurrency: code }) });
    } catch (err) { next(err); }
  },
);

router.get("/stats", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    const defaults = await getPlatformDefaults();
    const displayCurrency = defaults.displayCurrency;

    const [tenantsCount] = await db.select({ count: sql<number>`count(*)` }).from(tenants);
    const [activeTenants] = await db.select({ count: sql<number>`count(*)` }).from(tenants).where(eq(tenants.status, "active"));
    const [suspendedTenants] = await db.select({ count: sql<number>`count(*)` }).from(tenants).where(eq(tenants.status, "suspended"));
    const [trialTenants] = await db.select({ count: sql<number>`count(*)` }).from(tenants).where(eq(tenants.status, "trial"));
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(isNull(users.deletedAt));
    const [staffCount] = await db.select({ count: sql<number>`count(*)` }).from(staff).where(isNull(staff.deletedAt));
    const [studentsCount] = await db.select({ count: sql<number>`count(*)` }).from(students);
    const [jobsCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    const [failedJobsCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "failed"));
    const [pendingJobs] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "pending"));
    const [runningJobs] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "running"));

    const revenueRows = await db.execute<{ tenant_id: string; currency: string; total: string }>(sql`
      SELECT p.tenant_id, COALESCE(ts.currency, 'USD') AS currency, SUM(p.amount)::text AS total
      FROM payments p
      LEFT JOIN tenant_settings ts ON ts.tenant_id = p.tenant_id
      WHERE p.deleted_at IS NULL
      GROUP BY p.tenant_id, ts.currency
    `);

    let totalRevenueMinor = 0;
    for (const row of revenueRows.rows) {
      const amt = Number(row.total ?? 0);
      const cur = (row.currency ?? DEFAULT_CURRENCY).toUpperCase();
      totalRevenueMinor += await convertMinor(amt, cur, displayCurrency);
    }

    const ledger = await getPlatformRevenueLedger();

    res.json({
      success: true,
      data: {
        totalTenants: Number(tenantsCount?.count ?? 0),
        activeTenants: Number(activeTenants?.count ?? 0),
        suspendedTenants: Number(suspendedTenants?.count ?? 0),
        trialTenants: Number(trialTenants?.count ?? 0),
        totalUsers: Number(usersCount?.count ?? 0),
        totalStaff: Number(staffCount?.count ?? 0),
        totalStudents: Number(studentsCount?.count ?? 0),
        totalJobs: Number(jobsCount?.count ?? 0),
        failedJobs: Number(failedJobsCount?.count ?? 0),
        pendingJobs: Number(pendingJobs?.count ?? 0),
        runningJobs: Number(runningJobs?.count ?? 0),
        totalRevenue: totalRevenueMinor,
        feeVolumeTotal: ledger.summary.feeVolumeTotal,
        feeVolume30d: ledger.summary.feeVolume30d,
        mrr: ledger.summary.saasMrr,
        saasArr: ledger.summary.saasArr,
        saasLifetimeTotal: ledger.summary.saasLifetimeTotal,
        displayCurrency,
        fxProvider: "frankfurter.app",
      },
    });
  } catch (err) { next(err); }
});

router.get("/notifications", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformNotificationsHub() });
  } catch (err) { next(err); }
});

router.get("/settings/feature-flags", requirePlatformAuth, requirePlatformPermission("plans.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformFeatureFlagsHub() });
  } catch (err) { next(err); }
});

router.post("/settings/feature-flags/bulk", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      featureCode: z.string().min(1),
      enabled: z.boolean(),
      tenantIds: z.array(z.string().uuid()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await bulkSetFeatureForSchools(req.body.featureCode, req.body.enabled, req.body.tenantIds);
      await logPlatformAction(admin?.id, "feature.bulk_update", {
        entityType: "feature",
        entityId: req.body.featureCode,
        after: data,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/settings/api", requirePlatformAuth, requirePlatformPermission("plans.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformApiSettings() });
  } catch (err) { next(err); }
});

router.post("/settings/api/keys", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({ body: z.object({ name: z.string().min(1).max(100) }) }),
  async (req, res, next) => {
    try {
      const data = await createPlatformApiKey(req.body.name);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.delete("/settings/api/keys/:id", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    await deletePlatformApiKey(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/settings/api/webhooks", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      id: z.string().uuid().optional(),
      url: z.string().url(),
      events: z.array(z.string()).min(1),
      enabled: z.boolean(),
    }),
  }),
  async (req, res, next) => {
    try {
      const data = await upsertOutboundWebhook(req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/search", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = req.query.limit != null ? Number(req.query.limit) : 20;
    res.json({ success: true, data: await searchPlatform(q, limit) });
  } catch (err) { next(err); }
});

router.get("/integrations/catalog", requirePlatformAuth, requirePlatformPermission("plans.read"), (_req, res) => {
  res.json({ success: true, data: INTEGRATIONS_CATALOG });
});

router.get("/settings/marketing", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformMarketing() });
  } catch (err) { next(err); }
});

router.patch("/settings/marketing", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      siteName: z.string().optional(),
      siteUrl: z.string().url().optional(),
      defaultTitle: z.string().optional(),
      defaultDescription: z.string().optional(),
      defaultKeywords: z.string().optional(),
      orgLogoUrl: z.string().optional(),
      orgLogoAlt: z.string().max(200).optional(),
      ogImage: z.string().optional(),
      ogImageAlt: z.string().max(200).optional(),
      gaMeasurementId: z.string().optional(),
      gtmContainerId: z.string().optional(),
      plausibleDomain: z.string().optional(),
      twitterHandle: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await setPlatformMarketing(req.body) });
    } catch (err) { next(err); }
  },
);

router.get("/settings/email", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformEmailHub() });
  } catch (err) { next(err); }
});

router.patch("/settings/email/smtp", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      secure: z.boolean().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      fromEmail: z.string().email().optional(),
      fromName: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await setPlatformSmtp(req.body);
      await logPlatformAction(admin?.id, "email.smtp.update", { entityType: "platform_settings", entityId: "smtp" });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.post("/settings/email/smtp/verify", requirePlatformAuth, requirePlatformPermission("plans.write"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await verifyPlatformSmtpConnection() });
  } catch (err) { next(err); }
});

router.post("/settings/email/smtp/test", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      testEmail: z.string().email(),
      host: z.string().min(1).optional(),
      port: z.number().int().optional(),
      secure: z.boolean().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      fromEmail: z.string().email().optional(),
      fromName: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const { testEmail, ...smtpPatch } = req.body;
      const smtpPublic = await getPlatformSmtpPublic();
      const useOverride = Boolean(smtpPatch.host && smtpPatch.fromEmail);
      let overridePassword = smtpPatch.password;
      if (useOverride && !overridePassword && smtpPublic?.passwordConfigured) {
        const { getPlatformSmtpConfig } = await import("../services/platform-smtp-config");
        overridePassword = (await getPlatformSmtpConfig())?.password;
      }
      const override = useOverride
        ? {
            host: smtpPatch.host!,
            port: smtpPatch.port ?? 587,
            secure: smtpPatch.secure ?? false,
            user: smtpPatch.user,
            password: overridePassword,
            fromEmail: smtpPatch.fromEmail!,
            fromName: smtpPatch.fromName ?? smtpPublic?.fromName ?? "SchoolOS Platform",
          }
        : undefined;
      const data = await sendPlatformSmtpTest(testEmail, override);
      await logPlatformAction(admin?.id, "email.smtp.test", { entityType: "platform_email", entityId: testEmail });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/settings/email/templates/:code", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const tpl = await getPlatformEmailTemplate(req.params.code);
    if (!tpl) return next(new NotFoundError("Template not found"));
    res.json({ success: true, data: tpl });
  } catch (err) { next(err); }
});

router.patch("/settings/email/templates/:code", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      subject: z.string().min(1).optional(),
      bodyHtml: z.string().min(1).optional(),
      bodyText: z.string().optional(),
      enabled: z.boolean().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await updatePlatformEmailTemplate(req.params.code, req.body);
      await logPlatformAction(admin?.id, "email.template.update", {
        entityType: "platform_email_template",
        entityId: req.params.code,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/settings/email/templates/:code/preview", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    res.json({ success: true, data: await previewPlatformEmailTemplate(req.params.code) });
  } catch (err) { next(err); }
});

router.post("/settings/email/templates/:code/send-test", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({ body: z.object({ to: z.string().email() }) }),
  async (req, res, next) => {
    try {
      const marketing = await getPlatformMarketing();
      const { platformLoginPath } = await import("../lib/app-origin");
      const vars: Record<string, string> = {
        siteName: marketing.siteName,
        name: "Test Recipient",
        loginUrl: await platformLoginPath(),
        email: req.body.to,
        password: "••••••••",
        newPassword: "••••••••",
        roleLabel: "Support",
        sentAt: new Date().toLocaleString(),
      };
      await sendPlatformEmailWithTemplate({ to: req.body.to, templateCode: req.params.code, vars });
      res.json({ success: true, message: "Test email sent" });
    } catch (err) { next(err); }
  },
);

router.get("/settings/email/logs", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const limit = req.query.limit != null ? Number(req.query.limit) : 100;
    res.json({ success: true, data: await listPlatformEmailLogs({ status, limit }) });
  } catch (err) { next(err); }
});

router.get("/settings/integrations", requirePlatformAuth, requirePlatformPermission("plans.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformIntegrationsHub() });
  } catch (err) { next(err); }
});

router.get("/settings/integrations/:code", requirePlatformAuth, requirePlatformPermission("plans.read"), async (req, res, next) => {
  try {
    const data = await getPlatformIntegrationConfig(req.params.code);
    if (!data) return next(new NotFoundError("Integration not found"));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch("/settings/integrations/:code", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      enabled: z.boolean().optional(),
      credentials: z.record(z.string()).optional(),
      notes: z.string().max(2000).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await updatePlatformIntegrationConfig(req.params.code, req.body);
      await logPlatformAction(admin?.id, "integration.update", {
        entityType: "platform_integration",
        entityId: req.params.code,
        after: { enabled: data.enabled, configured: data.configured },
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.post("/settings/integrations/:code/test", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    const data = await testPlatformIntegrationConnection(req.params.code);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get("/settings/backup", requirePlatformAuth, requirePlatformPermission("plans.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformBackupHub() });
  } catch (err) { next(err); }
});

router.patch("/settings/backup/policy", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      scheduleEnabled: z.boolean().optional(),
      scheduleFrequency: z.enum(["daily", "weekly"]).optional(),
      scheduleHourUtc: z.number().int().min(0).max(23).optional(),
      retentionDays: z.number().int().min(1).max(365).optional(),
      includeDatabase: z.boolean().optional(),
      includeUploads: z.boolean().optional(),
      notifyEmail: z.string().email().optional().or(z.literal("")),
      offsiteEnabled: z.boolean().optional(),
      s3Bucket: z.string().max(200).optional(),
      s3Region: z.string().max(80).optional(),
      s3Prefix: z.string().max(200).optional(),
      s3Endpoint: z.string().max(300).optional(),
      s3AccessKeyId: z.string().max(200).optional(),
      s3SecretAccessKey: z.string().max(200).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await setBackupPolicy(req.body);
      await logPlatformAction(admin?.id, "backup.policy.update", { entityType: "platform_settings", entityId: "backup" });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.post("/settings/backup/run", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      label: z.string().max(200).optional(),
      includeDatabase: z.boolean().optional(),
      includeUploads: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await createBackupSnapshot({
        createdBy: admin?.id,
        label: req.body.label,
        includeDatabase: req.body.includeDatabase,
        includeUploads: req.body.includeUploads,
        trigger: "manual",
      });
      await logPlatformAction(admin?.id, "backup.create", { entityType: "platform_backup", entityId: data.id });
      res.status(202).json({ success: true, data, message: "Backup queued — refresh when status is completed" });
    } catch (err) { next(err); }
  },
);

router.delete("/settings/backup/snapshots/:id", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
    await deleteBackupSnapshot(req.params.id);
    await logPlatformAction(admin?.id, "backup.delete", { entityType: "platform_backup", entityId: req.params.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get("/settings/backup/snapshots/:id/download", requirePlatformAuth, requirePlatformPermission("plans.read"), async (req, res, next) => {
  try {
    const { path: filePath, fileName } = await resolveBackupFilePath(req.params.id);
    res.download(filePath, fileName);
  } catch (err) { next(err); }
});

router.post("/settings/backup/snapshots/:id/restore", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({ body: z.object({ confirmPhrase: z.string() }) }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await restoreBackupSnapshot(req.params.id, req.body.confirmPhrase);
      await logPlatformAction(admin?.id, "backup.restore", { entityType: "platform_backup", entityId: req.params.id });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/settings/general", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformGeneralSettings() });
  } catch (err) { next(err); }
});

router.patch("/settings/general", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      platformName: z.string().max(120).optional(),
      supportEmail: z.string().email().optional().or(z.literal("")),
      supportPhone: z.string().max(40).optional(),
      timezone: z.string().max(80).optional(),
      defaultLocale: z.string().max(20).optional(),
      maintenanceMode: z.boolean().optional(),
      maintenanceMessage: z.string().max(500).optional(),
      privacyPolicyUrl: z.string().max(500).optional(),
      termsUrl: z.string().max(500).optional(),
      incidentBanner: z.string().max(300).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await setPlatformGeneralSettings(req.body);
      await logPlatformAction(admin?.id, "general.settings.update", { entityType: "platform_settings", entityId: "general" });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/settings/email/campaigns", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listPlatformEmailCampaigns() });
  } catch (err) { next(err); }
});

router.post("/settings/email/campaigns", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      name: z.string().min(1).max(200),
      subject: z.string().min(1).max(300),
      bodyHtml: z.string().min(1),
      bodyText: z.string().optional(),
      audience: z.enum(["operators", "custom"]),
      recipientEmails: z.array(z.string().email()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await createPlatformEmailCampaign({
        ...req.body,
        createdBy: admin?.id,
      });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.patch("/settings/email/campaigns/:id", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      name: z.string().min(1).max(200).optional(),
      subject: z.string().min(1).max(300).optional(),
      bodyHtml: z.string().min(1).optional(),
      bodyText: z.string().optional(),
      audience: z.enum(["operators", "custom"]).optional(),
      recipientEmails: z.array(z.string().email()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const data = await updatePlatformEmailCampaign(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.post("/settings/email/campaigns/:id/send", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    const data = await sendPlatformEmailCampaignNow(req.params.id);
    res.status(202).json({ success: true, data, message: "Campaign queued for delivery" });
  } catch (err) { next(err); }
});

router.get("/media", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const type = req.query.type === "images" || req.query.type === "documents" ? req.query.type : "all";
    const data = await listPlatformMedia({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      type,
      limit: req.query.limit != null ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/media", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      fileName: z.string().min(1),
      contentBase64: z.string().min(1),
      mimeType: z.string().optional(),
      altText: z.string().max(300).optional(),
      title: z.string().max(200).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const data = await createPlatformMedia(admin?.id, req.body);
      await logPlatformAction(admin?.id, "media.upload", {
        entityType: "platform_media",
        entityId: data.id,
        after: { fileName: data.fileName },
        ip: req.ip,
      });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/media/:id/file", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const file = await servePlatformMediaFile(req.params.id);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(file.absPath);
  } catch (err) { next(err); }
});

router.get("/media/:id", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformMediaById(req.params.id) });
  } catch (err) { next(err); }
});

router.patch("/media/:id", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      altText: z.string().max(300).nullable().optional(),
      title: z.string().max(200).nullable().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await updatePlatformMedia(req.params.id, req.body) });
    } catch (err) { next(err); }
  },
);

router.delete("/media/:id", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
    await deletePlatformMedia(req.params.id);
    await logPlatformAction(admin?.id, "media.delete", {
      entityType: "platform_media",
      entityId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

router.get("/features", requirePlatformAuth, requirePlatformPermission("tenants.features"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listFeatureCatalog() });
  } catch (err) { next(err); }
});

router.get("/tenants/:slug/features", requirePlatformAuth, requirePlatformPermission("tenants.features"), async (req, res, next) => {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
    if (!tenant) throw new NotFoundError("Tenant not found");
    res.json({ success: true, data: await getTenantFeaturesDetailed(tenant.id) });
  } catch (err) { next(err); }
});

router.patch("/tenants/:slug/features", requirePlatformAuth, requirePlatformPermission("tenants.features"),
  validate({ body: z.object({ features: z.array(z.object({ code: z.string(), enabled: z.boolean() })) }) }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const merged = await setTenantFeaturesBulk(tenant.id, req.body.features);
      res.json({ success: true, data: merged });
    } catch (err) { next(err); }
  },
);

router.get("/revenue/ledger", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformRevenueLedger() });
  } catch (err) { next(err); }
});

router.get("/invoices", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformInvoicesLedger() });
  } catch (err) { next(err); }
});

router.get("/transactions", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformTransactionsLedger() });
  } catch (err) { next(err); }
});

router.get("/payouts", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformPayoutsLedger() });
  } catch (err) { next(err); }
});

router.post("/payouts", requirePlatformAuth, requirePlatformPermission("stats.read"),
  validate({
    body: z.object({
      tenantSlug: z.string().min(1),
      amount: z.number().int().positive(),
      reference: z.string().optional(),
      note: z.string().optional(),
      status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const row = await createPlatformPayout({
        tenantSlug: req.body.tenantSlug,
        amount: req.body.amount,
        reference: req.body.reference,
        note: req.body.note,
        status: req.body.status as PayoutStatus | undefined,
        createdById: admin?.id,
      });
      await logPlatformAction(admin?.id, "platform.payout.create", {
        tenantId: row.tenantId,
        entityType: "platform_payout",
        entityId: row.id,
        after: { amount: row.amount, status: row.status, reference: row.reference },
        ip: req.ip,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

router.patch("/payouts/:id", requirePlatformAuth, requirePlatformPermission("stats.read"),
  validate({ body: z.object({ status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]) }) }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const row = await updatePlatformPayoutStatus(req.params.id, req.body.status as PayoutStatus);
      await logPlatformAction(admin?.id, "platform.payout.status", {
        tenantId: row.tenantId,
        entityType: "platform_payout",
        entityId: row.id,
        after: { status: row.status },
        ip: req.ip,
      });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

router.get("/roles", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const actor = (req as Request & { platformAdmin?: { role?: string } }).platformAdmin;
    res.json({ success: true, data: await getPlatformRolesOverview(actor?.role ?? "super_admin") });
  } catch (err) { next(err); }
});

router.patch("/roles/:role", requirePlatformAuth, requirePlatformPermission("roles.manage"),
  validate({ body: z.object({ permissions: z.array(z.string()) }) }),
  async (req, res, next) => {
    try {
      await patchPlatformRolePermissions(req.params.role, req.body.permissions);
      const actor = (req as Request & { platformAdmin?: { role?: string } }).platformAdmin;
      res.json({ success: true, data: await getPlatformRolesOverview(actor?.role ?? "super_admin") });
    } catch (err) { next(err); }
  },
);

router.post("/roles/:role/reset", requirePlatformAuth, requirePlatformPermission("roles.manage"), async (req, res, next) => {
  try {
    await restorePlatformRoleDefaults(req.params.role);
    const actor = (req as Request & { platformAdmin?: { role?: string } }).platformAdmin;
    res.json({ success: true, data: await getPlatformRolesOverview(actor?.role ?? "super_admin") });
  } catch (err) { next(err); }
});

router.get("/users", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: { admins: await listPlatformAdmins(), roles: await getRoleMeta() },
    });
  } catch (err) { next(err); }
});

router.post("/users", requirePlatformAuth, requirePlatformPermission("tenants.provision"),
  validate({
    body: z.object({
      email: z.string().email(),
      name: z.string().min(1).max(120),
      password: z.string().min(8),
      role: z.enum(["super_admin", "support", "billing"]),
    }),
  }),
  async (req, res, next) => {
    try {
      const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
      const admin = await createPlatformAdmin(req.body);
      await logPlatformAction(actor.id, "platform.user.create", {
        entityType: "platform_admin",
        entityId: admin.id,
        after: { email: admin.email, role: admin.role },
        ip: req.ip,
      });
      res.status(201).json({ success: true, data: admin });
    } catch (err) { next(err); }
  },
);

router.patch("/users/:id", requirePlatformAuth, requirePlatformPermission("tenants.provision"),
  validate({
    body: z.object({
      name: z.string().min(1).max(120).optional(),
      role: z.enum(["super_admin", "support", "billing"]).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
      const role = req.body.role && isPlatformRole(req.body.role) ? req.body.role : undefined;
      const admin = await updatePlatformAdmin(req.params.id, { name: req.body.name, role }, actor.id);
      await logPlatformAction(actor.id, "platform.user.update", {
        entityType: "platform_admin",
        entityId: admin.id,
        after: { email: admin.email, role: admin.role },
        ip: req.ip,
      });
      res.json({ success: true, data: admin });
    } catch (err) { next(err); }
  },
);

router.post("/users/:id/reset-password", requirePlatformAuth, requirePlatformPermission("tenants.provision"),
  validate({ body: z.object({ newPassword: z.string().min(8) }) }),
  async (req, res, next) => {
    try {
      const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
      await resetPlatformAdminPassword(req.params.id, req.body.newPassword);
      await logPlatformAction(actor.id, "platform.user.reset_password", {
        entityType: "platform_admin",
        entityId: req.params.id,
        ip: req.ip,
      });
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

router.delete("/users/:id", requirePlatformAuth, requirePlatformPermission("tenants.provision"), async (req, res, next) => {
  try {
    const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
    await deletePlatformAdmin(req.params.id, actor.id);
    await logPlatformAction(actor.id, "platform.user.delete", {
      entityType: "platform_admin",
      entityId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get("/subscriptions", requirePlatformAuth, requirePlatformPermission("plans.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listPlatformSubscriptions() });
  } catch (err) { next(err); }
});

router.post("/subscriptions", requirePlatformAuth, requirePlatformPermission("plans.assign"),
  validate({
    body: z.object({
      tenantSlug: z.string().min(1),
      planCode: z.string().min(1),
      startedAt: z.string().datetime().optional(),
      billingInterval: z.enum(["monthly", "quarterly", "yearly", "lifetime"]).optional(),
      oneTimeAmount: z.number().int().min(0).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { tenant, plan, billingInterval } = await assignTenantPlan(req.body.tenantSlug, {
        planCode: req.body.planCode,
        startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
        billingInterval: req.body.billingInterval,
        oneTimeAmount: req.body.oneTimeAmount,
      });
      res.status(201).json({
        success: true,
        data: { tenantSlug: tenant.slug, planCode: plan.code, planName: plan.name, billingInterval },
      });
    } catch (err) { next(err); }
  },
);

router.patch("/subscriptions/:slug", requirePlatformAuth, requirePlatformPermission("plans.assign"),
  validate({
    body: z.object({
      planCode: z.string().min(1).optional(),
      startedAt: z.string().datetime().optional(),
      billingInterval: z.enum(["monthly", "quarterly", "yearly", "lifetime"]).optional(),
      oneTimeAmount: z.number().int().min(0).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      await updateTenantSubscription(req.params.slug, {
        planCode: req.body.planCode,
        startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
        billingInterval: req.body.billingInterval,
        oneTimeAmount: req.body.oneTimeAmount,
      });
      res.json({ success: true, data: await listPlatformSubscriptions() });
    } catch (err) { next(err); }
  },
);

router.delete("/subscriptions/:slug", requirePlatformAuth, requirePlatformPermission("plans.assign"), async (req, res, next) => {
  try {
    await removeTenantPlan(req.params.slug);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get("/plans", requirePlatformAuth, requirePlatformPermission("plans.read"), async (req, res, next) => {
  try {
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const currency = typeof req.query.currency === "string" ? req.query.currency : undefined;
    res.json({ success: true, data: await getPlansWithRegionalPricing(country, currency) });
  } catch (err) { next(err); }
});

router.get("/plans/meta/features", requirePlatformAuth, requirePlatformPermission("plans.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getPlanFeatureCatalog() });
  } catch (err) { next(err); }
});

router.get("/plans/:code", requirePlatformAuth, requirePlatformPermission("plans.read"), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getPlanByCode(req.params.code) });
  } catch (err) { next(err); }
});

router.post("/plans", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      code: z.string().min(2).max(50),
      name: z.string().min(1).max(120),
      priceMonthly: z.number().int().min(0),
      featuresJson: z.record(z.boolean()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const plan = await createPlan({
        code: normalizePlanCode(req.body.code),
        name: req.body.name,
        priceMonthly: req.body.priceMonthly,
        featuresJson: req.body.featuresJson,
      });
      res.status(201).json({ success: true, data: plan });
    } catch (err) { next(err); }
  },
);

router.patch("/plans/:code", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      name: z.string().min(1).max(120).optional(),
      priceMonthly: z.number().int().min(0).optional(),
      featuresJson: z.record(z.boolean()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const plan = await updatePlan(req.params.code, req.body);
      res.json({ success: true, data: plan });
    } catch (err) { next(err); }
  },
);

router.delete("/plans/:code", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    await deletePlan(req.params.code);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/plans/:code/regional-prices", requirePlatformAuth, requirePlatformPermission("plans.write"),
  validate({
    body: z.object({
      countryCode: z.string().min(1).max(8),
      currency: z.string().length(3),
      priceMonthly: z.number().int().min(0),
    }),
  }),
  async (req, res, next) => {
    try {
      const row = await upsertRegionalPrice(req.params.code, req.body);
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

router.delete("/plans/:code/regional-prices/:id", requirePlatformAuth, requirePlatformPermission("plans.write"), async (req, res, next) => {
  try {
    await deleteRegionalPrice(req.params.code, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/tenants", requirePlatformAuth, requirePlatformPermission("tenants.provision"), validate({ body: createTenantSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, adminEmail, adminPassword, adminFirstName, adminLastName, planCode, country, currency } = req.body;
    const slug = req.body.slug?.trim()
      ? slugifySchoolName(req.body.slug)
      : await uniqueTenantSlug(name);

    let tenant: typeof tenants.$inferSelect;
    try {
      [tenant] = await db.insert(tenants).values({
        slug,
        name,
        status: "active",
        subdomain: slug,
        domainVerified: false,
        sslConfig: { status: "pending_dns_configuration", challengeType: "http-01" },
      }).returning();
    } catch {
      [tenant] = await db.insert(tenants).values({ slug, name, status: "active" }).returning();
    }

    const cc = ((country ?? "").trim() || DEFAULT_COUNTRY).toUpperCase();
    const cur = (currency?.toUpperCase() ?? defaultCurrencyForCountry(cc));
    await db.insert(tenantSettings).values({ tenantId: tenant.id, country: cc, currency: cur });
    await enableDefaultFeaturesForTenant(tenant.id);

    try {
      const currentCycle = new Date().toISOString().slice(0, 7);
      const { tenantBillingUsage } = await import("../db/schema");
      await db.insert(tenantBillingUsage).values([
        { tenantId: tenant.id, metric: "sms_volume", quantityUsed: 0, billingCycle: currentCycle },
        { tenantId: tenant.id, metric: "ai_credits", quantityUsed: 0, billingCycle: currentCycle },
        { tenantId: tenant.id, metric: "storage_bytes", quantityUsed: 0, billingCycle: currentCycle },
      ]);
    } catch (seedErr) {
      console.warn("[platform] tenant billing usage seed skipped:", seedErr);
    }

    if (planCode) {
      const [plan] = await db.select().from(plans).where(eq(plans.code, planCode)).limit(1);
      if (plan) await db.insert(tenantPlans).values({ tenantId: tenant.id, planId: plan.id });
    }

    const [adminRole] = await db.insert(roles).values({ tenantId: tenant.id, name: "School Administrator", isSystem: true }).returning();
    const allPerms = await db.select().from(permissions);
    if (allPerms.length > 0) {
      await db.insert(rolePermissions).values(allPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })));
    }

    const passwordHash = await hashPassword(adminPassword);
    const [adminUser] = await db.insert(users).values({
      tenantId: tenant.id, email: adminEmail, passwordHash,
      firstName: adminFirstName, lastName: adminLastName, status: "active",
    }).returning();
    await db.insert(userRoles).values({ userId: adminUser.id, roleId: adminRole.id, tenantId: tenant.id });

    const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
    await logPlatformAction(actor?.id, "tenant.create", {
      tenantId: tenant.id,
      entityType: "tenant",
      entityId: tenant.id,
      after: { slug: tenant.slug, name: tenant.name, planCode: planCode ?? null },
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: { tenant, adminUser: { id: adminUser.id, email: adminUser.email } },
    });
  } catch (err) { next(err); }
});

router.get("/tenants", requirePlatformAuth, requirePlatformPermission("tenants.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listPlatformTenants() });
  } catch (err) { next(err); }
});

router.patch("/tenants/:slug/settings", requirePlatformAuth, requirePlatformPermission("tenants.read"),
  validate({
    body: z.object({
      country: z.string().length(2).optional(),
      currency: z.string().length(3).optional(),
      timezone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.country !== undefined) patch.country = req.body.country.toUpperCase();
      if (req.body.currency !== undefined) {
        const c = req.body.currency.toUpperCase();
        if (!CURRENCY_CODES.has(c)) return res.status(400).json({ success: false, message: "Unsupported currency" });
        patch.currency = c;
      }
      if (req.body.timezone !== undefined) patch.timezone = req.body.timezone;
      const [updated] = await db.update(tenantSettings).set(patch).where(eq(tenantSettings.tenantId, tenant.id)).returning();
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },
);

router.get("/tenants/:slug", requirePlatformAuth, requirePlatformPermission("tenants.read"), async (req, res, next) => {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
    if (!tenant) throw new NotFoundError("Tenant not found");
    const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    const [tp] = await db.select({ plan: plans }).from(tenantPlans)
      .innerJoin(plans, eq(tenantPlans.planId, plans.id))
      .where(eq(tenantPlans.tenantId, tenant.id)).limit(1);
    const cycle = currentBillingCycle();
    const listRow = (await listPlatformTenants()).find((t) => t.id === tenant.id);
    const features = await getTenantFeaturesDetailed(tenant.id);
    res.json({
      success: true,
      data: {
        tenant,
        settings,
        plan: tp?.plan ?? null,
        domain: await getDomainInstructions(tenant),
        addons: await getTenantAddonsDetailed(tenant.id),
        features,
        usage: await getTenantUsage(tenant.id, cycle),
        billingLines: await getBillingLines(tenant.id, cycle),
        billingCycle: cycle,
        stats: listRow
          ? {
              studentCount: listRow.studentCount,
              staffCount: listRow.staffCount,
              erpUserCount: listRow.erpUserCount,
              adminEmail: listRow.adminEmail,
            }
          : { studentCount: 0, staffCount: 0, erpUserCount: 0, adminEmail: null },
      },
    });
  } catch (err) { next(err); }
});

router.patch("/tenants/:slug/domain", requirePlatformAuth, requirePlatformPermission("tenants.provision"),
  validate({ body: z.object({ customDomain: z.string().min(3) }) }),
  async (req, res, next) => {
    try {
      const admin = (req as any).platformAdmin;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const updated = await setCustomDomain(tenant.id, req.body.customDomain);
      await createPlatformAuditLog({
        platformAdminId: admin.id,
        tenantId: tenant.id,
        action: "tenant.domain.set",
        entityType: "tenant",
        entityId: tenant.id,
        after: updated,
        ip: req.ip,
      });
      res.json({ success: true, data: await getDomainInstructions(updated!) });
    } catch (err) { next(err); }
  },
);

router.post("/tenants/:slug/domain/verify", requirePlatformAuth, requirePlatformPermission("tenants.provision"),
  async (req, res, next) => {
    try {
      const admin = (req as any).platformAdmin;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      if (!tenant.customDomain) throw new NotFoundError("Set a custom domain first");
      const { verifyDomainDns } = await import("../services/dns-verification");
      const dns = await verifyDomainDns(tenant.id, tenant.customDomain);
      const [updated] = await db.select().from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
      if (!dns.verified) {
        return res.status(400).json({
          success: false,
          message: dns.error ?? "DNS not pointing to SchoolOS yet. Add CNAME or A record, then try again.",
          data: { dns, domain: updated ? await getDomainInstructions(updated) : null },
        });
      }
      await createPlatformAuditLog({
        platformAdminId: admin.id,
        tenantId: tenant.id,
        action: "tenant.domain.verified",
        entityType: "tenant",
        entityId: tenant.id,
        ip: req.ip,
      });
      res.json({ success: true, data: await getDomainInstructions(updated!) });
    } catch (err) { next(err); }
  },
);

router.get("/tenants/:slug/logins", requirePlatformAuth, requirePlatformPermission("tenants.read"), async (req, res, next) => {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
    if (!tenant) throw new NotFoundError("Tenant not found");
    const { listSchoolErpUsers } = await import("../services/platform-school-logins");
    const { schoolLoginPath } = await import("../lib/app-origin");
    const users = await listSchoolErpUsers(tenant.id);
    const { listSchoolPortalLogins } = await import("../services/school-portal-logins");
    const portal = await listSchoolPortalLogins(tenant.id, tenant.slug);
    res.json({
      success: true,
      data: {
        slug: tenant.slug,
        schoolName: tenant.name,
        loginUrl: await schoolLoginPath(tenant.slug),
        parentPortalUrl: portal.portalUrl,
        studentPortalUrl: portal.portalUrl,
        portal,
        users,
      },
    });
  } catch (err) { next(err); }
});

router.post("/tenants/:slug/reset-admin-password", requirePlatformAuth, requirePlatformPermission("tenants.provision"),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      const { resetSchoolAdministratorPassword } = await import("../services/platform-school-logins");
      const data = await resetSchoolAdministratorPassword(req.params.slug);
      await logPlatformAction(admin?.id, "tenant.admin.reset_password", {
        entityType: "user",
        entityId: data.userId,
        tenantId: data.tenantId,
        ip: req.ip,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/tenants/:slug/impersonation-targets", requirePlatformAuth, requirePlatformPermission("tenants.read"),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const data = await listImpersonationTargets(tenant.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.post("/tenants/:slug/impersonate", requirePlatformAuth, requirePlatformPermission("tenants.read"),
  validate({
    body: z.object({
      readOnly: z.boolean().optional(),
      userId: z.string().uuid().optional(),
      staffId: z.string().uuid().optional(),
      roleName: z.string().min(1).optional(),
      provisionStaffLogin: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as any).platformAdmin;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      let target;
      try {
        target = await resolveImpersonationUser(tenant.id, {
          userId: req.body?.userId,
          staffId: req.body?.staffId,
          roleName: req.body?.roleName,
          provisionStaffLogin: req.body?.provisionStaffLogin === true,
        });
      } catch (e) {
        throw new BadRequestError(e instanceof Error ? e.message : "Invalid impersonation target");
      }
      const readOnly = req.body?.readOnly === true;
      const row = await createImpersonationToken({
        tenantId: tenant.id,
        targetUserId: target.id,
        platformAdminId: admin.id,
        readOnly,
      });
      await logPlatformAction(admin.id, "tenant.impersonate", {
        tenantId: tenant.id,
        entityType: "user",
        entityId: target.id,
        after: { email: target.email, readOnly },
        ip: req.ip,
      });
      const { resolveClientOrigin } = await import("../lib/app-origin");
      const base = await resolveClientOrigin();
      const path = `/s/${tenant.slug}/impersonate?token=${row.token}`;
      res.json({
        success: true,
        data: {
          url: base ? `${base}${path}` : path,
          expiresAt: row.expiresAt,
          readOnly: row.readOnly,
          user: {
            id: target.id,
            email: target.email,
            firstName: target.firstName,
            lastName: target.lastName,
          },
        },
      });
    } catch (err) { next(err); }
  },
);

router.get("/audit", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const source = req.query.source === "school" || req.query.source === "platform"
      ? req.query.source
      : "all";
    const days = req.query.days != null ? Number(req.query.days) : undefined;
    const data = await getPlatformAuditHub({
      source,
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      days: Number.isFinite(days) && days! > 0 ? days : undefined,
      limit: req.query.limit != null ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get("/audit/:source/:id", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const source = req.params.source;
    if (source !== "school" && source !== "platform") {
      res.status(400).json({ success: false, message: "Invalid source" });
      return;
    }
    const detail = await getPlatformAuditEventDetail(source, req.params.id);
    if (!detail) throw new NotFoundError("Audit event not found");
    res.json({ success: true, data: detail });
  } catch (err) { next(err); }
});

router.get("/audit-logs", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    res.json({ success: true, data: await listGlobalAuditFeed(limit) });
  } catch (err) { next(err); }
});

router.get("/logs", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const source = req.query.source === "job" || req.query.source === "delivery"
      ? req.query.source
      : "all";
    const days = req.query.days != null ? Number(req.query.days) : undefined;
    const data = await getPlatformSystemLogsHub({
      source,
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      days: Number.isFinite(days) && days! > 0 ? days : undefined,
      limit: req.query.limit != null ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get("/logs/job/:id", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const detail = await getPlatformJobLogDetail(req.params.id);
    if (!detail) throw new NotFoundError("Job log not found");
    res.json({ success: true, data: detail });
  } catch (err) { next(err); }
});

router.get("/logs/delivery/:id", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const detail = await getPlatformDeliveryLogDetail(req.params.id);
    if (!detail) throw new NotFoundError("Delivery log not found");
    res.json({ success: true, data: detail });
  } catch (err) { next(err); }
});

router.get("/queue", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const days = req.query.days != null ? Number(req.query.days) : undefined;
    const data = await getPlatformQueueHub({
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      type: typeof req.query.type === "string" ? req.query.type : undefined,
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : undefined,
      days: Number.isFinite(days) && days! > 0 ? days : undefined,
      limit: req.query.limit != null ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/queue/process", requirePlatformAuth, requirePlatformPermission("stats.read"), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await triggerQueueProcessing() });
  } catch (err) { next(err); }
});

router.get("/queue/:id", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformQueueJobDetail(req.params.id) });
  } catch (err) { next(err); }
});

router.post("/queue/:id/retry", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
    const data = await retryPlatformJob(req.params.id);
    await logPlatformAction(admin?.id, "queue.job.retry", {
      tenantId: data.tenantId,
      entityType: "job",
      entityId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get("/support", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const data = await getPlatformSupportHub({
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : undefined,
      assignedAdminId: typeof req.query.assigned === "string" ? req.query.assigned : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get("/support/:id", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    res.json({ success: true, data: await getPlatformSupportTicketDetail(req.params.id) });
  } catch (err) { next(err); }
});

router.post("/support", requirePlatformAuth, requirePlatformPermission("stats.read"),
  validate({
    body: z.object({
      tenantId: z.string().uuid().optional().nullable(),
      subject: z.string().min(3).max(200),
      description: z.string().min(1).max(8000),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      category: z.enum(TICKET_CATEGORIES).optional(),
      requesterName: z.string().max(120).optional(),
      requesterEmail: z.string().email().optional(),
      assignedAdminId: z.string().uuid().optional().nullable(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
      const data = await createPlatformSupportTicket(admin.id, req.body);
      await logPlatformAction(admin.id, "support.ticket.create", {
        tenantId: req.body.tenantId ?? undefined,
        entityType: "support_ticket",
        entityId: data.ticket.id,
        after: { subject: req.body.subject, priority: req.body.priority ?? "normal" },
        ip: req.ip,
      });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.patch("/support/:id", requirePlatformAuth, requirePlatformPermission("stats.read"),
  validate({
    body: z.object({
      status: z.enum(TICKET_STATUSES).optional(),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      category: z.enum(TICKET_CATEGORIES).optional(),
      assignedAdminId: z.string().uuid().nullable().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
      const data = await updatePlatformSupportTicket(req.params.id, req.body);
      await logPlatformAction(admin.id, "support.ticket.update", {
        tenantId: data.ticket.tenantId,
        entityType: "support_ticket",
        entityId: req.params.id,
        after: req.body,
        ip: req.ip,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.post("/support/:id/messages", requirePlatformAuth, requirePlatformPermission("stats.read"),
  validate({
    body: z.object({
      message: z.string().min(1).max(8000),
      isInternal: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const admin = (req as Request & { platformAdmin?: { id: string } }).platformAdmin!;
      const data = await addPlatformSupportTicketMessage(req.params.id, admin.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

router.get("/addons", requirePlatformAuth, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listAddonCatalog() });
  } catch (err) { next(err); }
});

router.get("/tenants/:slug/addons", requirePlatformAuth, requirePlatformPermission("tenants.features"), async (req, res, next) => {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
    if (!tenant) throw new NotFoundError("Tenant not found");
    res.json({ success: true, data: await getTenantAddonsDetailed(tenant.id) });
  } catch (err) { next(err); }
});

router.post("/tenants/:slug/addons", requirePlatformAuth, requirePlatformPermission("tenants.features"),
  validate({ body: z.object({ code: z.string(), active: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const admin = (req as any).platformAdmin;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      if (req.body.active) {
        await activateTenantAddon(tenant.id, req.body.code);
      } else {
        await deactivateTenantAddon(tenant.id, req.body.code);
      }
      await createPlatformAuditLog({
        platformAdminId: admin.id,
        tenantId: tenant.id,
        action: req.body.active ? "tenant.addon.activate" : "tenant.addon.deactivate",
        entityType: "addon",
        entityId: req.body.code,
        ip: req.ip,
      });
      res.json({ success: true, data: await getTenantAddonsDetailed(tenant.id) });
    } catch (err) { next(err); }
  },
);

router.get("/tenants/:slug/usage", requirePlatformAuth, requirePlatformPermission("stats.read"), async (req, res, next) => {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
    if (!tenant) throw new NotFoundError("Tenant not found");
    const cycle = String(req.query.cycle ?? currentBillingCycle());
    res.json({
      success: true,
      data: {
        cycle,
        usage: await getTenantUsage(tenant.id, cycle),
        lines: await getBillingLines(tenant.id, cycle),
      },
    });
  } catch (err) { next(err); }
});

router.post("/tenants/:slug/usage/generate-lines", requirePlatformAuth, requirePlatformPermission("stats.read"),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const cycle = String(req.body?.cycle ?? currentBillingCycle());
      const lines = await generateBillingLines(tenant.id, cycle);
      res.json({ success: true, data: { cycle, lines } });
    } catch (err) { next(err); }
  },
);

router.patch("/tenants/:slug/feature-flags", requirePlatformAuth, requirePlatformPermission("tenants.features"),
  validate({ body: z.object({ flags: z.record(z.boolean()) }) }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      const merged = { ...(settings?.featureFlagsJson ?? {}), ...req.body.flags };
      await db.update(tenantSettings).set({ featureFlagsJson: merged, updatedAt: new Date() }).where(eq(tenantSettings.tenantId, tenant.id));
      for (const [code, enabled] of Object.entries(req.body.flags)) {
        await setTenantFeature(tenant.id, code, Boolean(enabled));
      }
      res.json({ success: true, data: merged });
    } catch (err) { next(err); }
  }
);

router.patch("/tenants/:slug", requirePlatformAuth, requirePlatformPermission("tenants.read"),
  validate({
    body: z.object({
      name: z.string().min(1).max(200).optional(),
      status: z.enum(["active", "trial", "suspended"]).optional(),
      planCode: z.string().optional(),
      country: z.string().length(2).optional(),
      currency: z.string().length(3).optional(),
      timezone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");

      if (req.body.name) {
        await db.update(tenants).set({ name: req.body.name, updatedAt: new Date() }).where(eq(tenants.id, tenant.id));
      }
      if (req.body.status) {
        await db.update(tenants).set({ status: req.body.status, updatedAt: new Date() }).where(eq(tenants.id, tenant.id));
      }
      if (req.body.planCode) {
        const [plan] = await db.select().from(plans).where(eq(plans.code, req.body.planCode)).limit(1);
        if (!plan) throw new NotFoundError("Plan not found");
        await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id));
        await db.insert(tenantPlans).values({ tenantId: tenant.id, planId: plan.id });
      }
      const settingsPatch: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.country !== undefined) settingsPatch.country = req.body.country.toUpperCase();
      if (req.body.currency !== undefined) {
        const c = req.body.currency.toUpperCase();
        if (!CURRENCY_CODES.has(c)) return res.status(400).json({ success: false, message: "Unsupported currency" });
        settingsPatch.currency = c;
      }
      if (req.body.timezone !== undefined) settingsPatch.timezone = req.body.timezone;
      if (Object.keys(settingsPatch).length > 1) {
        await db.update(tenantSettings).set(settingsPatch).where(eq(tenantSettings.tenantId, tenant.id));
      }

      const [updated] = await db.select().from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },
);

router.patch("/tenants/:slug/status", requirePlatformAuth, requirePlatformPermission("tenants.suspend"),
  validate({ body: z.object({ status: z.enum(["active", "suspended", "trial"]) }) }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const [updated] = await db.update(tenants).set({ status: req.body.status, updatedAt: new Date() }).where(eq(tenants.id, tenant.id)).returning();
      const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      await createAuditLog({
        tenantId: tenant.id,
        action: "tenant.status.update",
        entityType: "tenant",
        entityId: tenant.id,
        before: tenant,
        after: updated,
        ip: req.ip,
      });
      await logPlatformAction(actor?.id, "tenant.status.update", {
        tenantId: tenant.id,
        entityType: "tenant",
        entityId: tenant.id,
        before: { status: tenant.status },
        after: { status: updated.status },
        ip: req.ip,
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },
);

router.patch("/tenants/:slug/plan", requirePlatformAuth, requirePlatformPermission("plans.assign"),
  validate({ body: z.object({ planCode: z.string() }) }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const [plan] = await db.select().from(plans).where(eq(plans.code, req.body.planCode)).limit(1);
      if (!plan) throw new NotFoundError("Plan not found");
      await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id));
      await db.insert(tenantPlans).values({ tenantId: tenant.id, planId: plan.id });
      const actor = (req as Request & { platformAdmin?: { id: string } }).platformAdmin;
      await logPlatformAction(actor?.id, "tenant.plan.assign", {
        tenantId: tenant.id,
        entityType: "plan",
        entityId: plan.id,
        after: { planCode: plan.code, planName: plan.name },
        ip: req.ip,
      });
      res.json({ success: true, data: plan });
    } catch (err) { next(err); }
  }
);

export default router;
