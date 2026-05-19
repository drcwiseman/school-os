import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  tenants, tenantSettings, users, roles, rolePermissions, permissions,
  plans, tenantPlans, platformAdmins, students, jobs, payments,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { SUPPORTED_CURRENCIES, CURRENCY_CODES, defaultCurrencyForCountry } from "../lib/currencies";
import { getExchangeRates, convertMinor } from "../services/currency-exchange";
import { getPlatformDefaults, setPlatformDefaults } from "../services/platform-settings";
import { getPlansWithRegionalPricing } from "../services/plan-pricing";
import {
  setTenantFeature,
  listFeatureCatalog,
  getTenantFeaturesDetailed,
  setTenantFeaturesBulk,
  enableDefaultFeaturesForTenant,
} from "../services/tenant-features";
import { hashPassword } from "../middleware/auth";
import { createPlatformSession, requirePlatformAuth, verifyPassword } from "../middleware/platform-auth";
import { validate } from "../utils/validate";
import { NotFoundError, ConflictError, UnauthorizedError } from "../middleware/error";
import { requirePlatformPermission } from "../lib/platform-permissions";
import { createAuditLog } from "../services/audit";
import { platformAdminAuthColumns, platformAdminPublic } from "../db/platform-admin-columns";

const router = Router();

const createTenantSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
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
    res.cookie("platform_session_token", session.token, {
      httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
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

router.post("/auth/logout", requirePlatformAuth, async (req, res) => {
  res.clearCookie("platform_session_token");
  res.json({ success: true });
});

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
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
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
      const cur = (row.currency ?? "USD").toUpperCase();
      totalRevenueMinor += await convertMinor(amt, cur, displayCurrency);
    }

    const mrrMinor = Math.round(totalRevenueMinor / 12);

    res.json({
      success: true,
      data: {
        totalTenants: Number(tenantsCount?.count ?? 0),
        activeTenants: Number(activeTenants?.count ?? 0),
        suspendedTenants: Number(suspendedTenants?.count ?? 0),
        totalUsers: Number(usersCount?.count ?? 0),
        totalStudents: Number(studentsCount?.count ?? 0),
        totalJobs: Number(jobsCount?.count ?? 0),
        failedJobs: Number(failedJobsCount?.count ?? 0),
        pendingJobs: Number(pendingJobs?.count ?? 0),
        runningJobs: Number(runningJobs?.count ?? 0),
        totalRevenue: totalRevenueMinor,
        mrr: mrrMinor,
        displayCurrency,
        fxProvider: "frankfurter.app",
      },
    });
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

router.get("/plans", requirePlatformAuth, requirePlatformPermission("plans.read"), async (req, res, next) => {
  try {
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const currency = typeof req.query.currency === "string" ? req.query.currency : undefined;
    res.json({ success: true, data: await getPlansWithRegionalPricing(country, currency) });
  } catch (err) { next(err); }
});

router.post("/tenants", requirePlatformAuth, requirePlatformPermission("tenants.provision"), validate({ body: createTenantSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, name, adminEmail, adminPassword, adminFirstName, adminLastName, planCode, country, currency } = req.body;

    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existing) throw new ConflictError("School slug already taken");

    const [tenant] = await db.insert(tenants).values({ slug, name, status: "active" }).returning();
    const cc = (country ?? "").toUpperCase();
    const cur = (currency?.toUpperCase() ?? (cc ? defaultCurrencyForCountry(cc) : "USD"));
    await db.insert(tenantSettings).values({ tenantId: tenant.id, country: cc, currency: cur });
    await enableDefaultFeaturesForTenant(tenant.id);

    if (planCode) {
      const [plan] = await db.select().from(plans).where(eq(plans.code, planCode)).limit(1);
      if (plan) await db.insert(tenantPlans).values({ tenantId: tenant.id, planId: plan.id });
    }

    const [adminRole] = await db.insert(roles).values({ tenantId: tenant.id, name: "Tenant Admin", isSystem: true }).returning();
    const allPerms = await db.select().from(permissions);
    if (allPerms.length > 0) {
      await db.insert(rolePermissions).values(allPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })));
    }

    const passwordHash = await hashPassword(adminPassword);
    const [adminUser] = await db.insert(users).values({
      tenantId: tenant.id, email: adminEmail, passwordHash,
      firstName: adminFirstName, lastName: adminLastName, status: "active",
    }).returning();

    res.status(201).json({
      success: true,
      data: { tenant, adminUser: { id: adminUser.id, email: adminUser.email } },
    });
  } catch (err) { next(err); }
});

router.get("/tenants", requirePlatformAuth, requirePlatformPermission("tenants.read"), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
        createdAt: tenants.createdAt,
        country: tenantSettings.country,
        currency: tenantSettings.currency,
        planCode: plans.code,
        planName: plans.name,
        studentCount: sql<number>`(SELECT count(*)::int FROM students s WHERE s.tenant_id = ${tenants.id})`,
        userCount: sql<number>`(SELECT count(*)::int FROM users u WHERE u.tenant_id = ${tenants.id} AND u.deleted_at IS NULL)`,
      })
      .from(tenants)
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
      .leftJoin(tenantPlans, eq(tenantPlans.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, tenantPlans.planId));
    res.json({ success: true, data: rows });
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
    res.json({ success: true, data: { tenant, settings, plan: tp?.plan ?? null } });
  } catch (err) { next(err); }
});

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

router.patch("/tenants/:slug/status", requirePlatformAuth, requirePlatformPermission("tenants.suspend"),
  validate({ body: z.object({ status: z.enum(["active", "suspended", "trial"]) }) }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const [updated] = await db.update(tenants).set({ status: req.body.status, updatedAt: new Date() }).where(eq(tenants.id, tenant.id)).returning();
      await createAuditLog({
        tenantId: tenant.id,
        action: "tenant.status.update",
        entityType: "tenant",
        entityId: tenant.id,
        before: tenant,
        after: updated,
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
      res.json({ success: true, data: plan });
    } catch (err) { next(err); }
  }
);

export default router;
