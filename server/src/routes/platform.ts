import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  tenants, tenantSettings, users, roles, rolePermissions, permissions,
  plans, tenantPlans, platformAdmins, students, jobs, payments,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../middleware/auth";
import { createPlatformSession, requirePlatformAuth, verifyPassword } from "../middleware/platform-auth";
import { validate } from "../utils/validate";
import { NotFoundError, ConflictError, UnauthorizedError } from "../middleware/error";

const router = Router();

const createTenantSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  planCode: z.string().optional(),
});

router.post("/auth/login", validate({ body: z.object({ email: z.string().email(), password: z.string() }) }), async (req, res, next) => {
  try {
    const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, req.body.email)).limit(1);
    if (!admin) throw new UnauthorizedError("Invalid credentials");
    const valid = await verifyPassword(req.body.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");
    const session = await createPlatformSession(admin.id);
    res.cookie("platform_session_token", session.token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) { next(err); }
});

router.get("/auth/me", requirePlatformAuth, async (req, res, next) => {
  try {
    const admin = (req as any).platformAdmin;
    res.json({ success: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) { next(err); }
});

router.post("/auth/logout", requirePlatformAuth, async (req, res) => {
  res.clearCookie("platform_session_token");
  res.json({ success: true });
});

router.get("/stats", requirePlatformAuth, async (_req, res, next) => {
  try {
    const [tenantsCount] = await db.select({ count: sql<number>`count(*)` }).from(tenants);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [studentsCount] = await db.select({ count: sql<number>`count(*)` }).from(students);
    const [jobsCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    const [failedJobsCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.status, "failed"));
    const [paymentsSum] = await db.select({ sum: sql<number>`sum(amount)` }).from(payments);

    res.json({
      success: true,
      data: {
        totalTenants: Number(tenantsCount?.count ?? 0),
        totalUsers: Number(usersCount?.count ?? 0),
        totalStudents: Number(studentsCount?.count ?? 0),
        totalJobs: Number(jobsCount?.count ?? 0),
        failedJobs: Number(failedJobsCount?.count ?? 0),
        totalRevenue: Number(paymentsSum?.sum ?? 0),
      }
    });
  } catch (err) { next(err); }
});

router.get("/plans", requirePlatformAuth, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await db.select().from(plans) });
  } catch (err) { next(err); }
});

router.post("/tenants", requirePlatformAuth, validate({ body: createTenantSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, name, adminEmail, adminPassword, adminFirstName, adminLastName, planCode } = req.body;

    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existing) throw new ConflictError("School slug already taken");

    const [tenant] = await db.insert(tenants).values({ slug, name, status: "active" }).returning();
    await db.insert(tenantSettings).values({ tenantId: tenant.id });

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

router.get("/tenants", requirePlatformAuth, async (_req, res, next) => {
  try {
    const rows = await db.select({
      id: tenants.id, slug: tenants.slug, name: tenants.name, status: tenants.status, createdAt: tenants.createdAt,
    }).from(tenants);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get("/tenants/:slug", requirePlatformAuth, async (req, res, next) => {
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

router.patch("/tenants/:slug/feature-flags", requirePlatformAuth,
  validate({ body: z.object({ flags: z.record(z.boolean()) }) }),
  async (req, res, next) => {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, req.params.slug)).limit(1);
      if (!tenant) throw new NotFoundError("Tenant not found");
      const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      const merged = { ...(settings?.featureFlagsJson ?? {}), ...req.body.flags };
      await db.update(tenantSettings).set({ featureFlagsJson: merged }).where(eq(tenantSettings.tenantId, tenant.id));
      res.json({ success: true, data: merged });
    } catch (err) { next(err); }
  }
);

router.patch("/tenants/:slug/plan", requirePlatformAuth,
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
