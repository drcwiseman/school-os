import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  roles, permissions, rolePermissions, userRoles, users,
  academicYears, terms, classes, streams, students, studentClassHistory,
  announcements, tenantSettings, tenantCampuses, invoices,
} from "../db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { BadRequestError, NotFoundError } from "../middleware/error";
import { getSetupWizardStatus } from "../services/setup-wizard";
import { RBAC_PRESETS } from "../services/rbac-presets";
import { createAuditLog } from "../services/audit";
import { isTenantFeatureEnabled } from "../services/tenant-features";
import { seedDemoDataForTenant } from "../services/tenant-demo-seed";

export const adminEnhancementsRouter = Router();
adminEnhancementsRouter.use(requireAuth, requireTenantMatch);

const APPEARANCE_PRESETS = [
  { id: "indigo", label: "Indigo", accent: "#6366f1", mode: "dark" as const },
  { id: "emerald", label: "Emerald", accent: "#10b981", mode: "dark" as const },
  { id: "amber", label: "Amber", accent: "#f59e0b", mode: "dark" as const },
  { id: "rose", label: "Rose", accent: "#f43f5e", mode: "dark" as const },
  { id: "light-indigo", label: "Light Indigo", accent: "#4f46e5", mode: "light" as const },
  { id: "light-slate", label: "Light Slate", accent: "#475569", mode: "light" as const },
];

adminEnhancementsRouter.get("/portal-logins", requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listSchoolPortalLogins } = await import("../services/school-portal-logins");
    const data = await listSchoolPortalLogins(tenant.id, tenant.slug);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.get("/overview", requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [userCount] = await db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.tenantId, tenant.id), isNull(users.deletedAt)));
    const [roleCount] = await db.select({ n: sql<number>`count(*)` }).from(roles).where(eq(roles.tenantId, tenant.id));
    const [classCount] = await db.select({ n: sql<number>`count(*)` }).from(classes).where(eq(classes.tenantId, tenant.id));
    const [publishedAnn] = await db.select({ n: sql<number>`count(*)` }).from(announcements).where(and(eq(announcements.tenantId, tenant.id), eq(announcements.published, true)));
    const wizard = await getSetupWizardStatus(tenant.id);
    const multiCampus = await isTenantFeatureEnabled(tenant.id, "multi_campus");
    let campuses = 0;
    if (multiCampus) {
      const [c] = await db.select({ n: sql<number>`count(*)` }).from(tenantCampuses).where(eq(tenantCampuses.tenantId, tenant.id));
      campuses = Number(c?.n ?? 0);
    }
    res.json({
      success: true,
      data: {
        users: Number(userCount?.n ?? 0),
        roles: Number(roleCount?.n ?? 0),
        classes: Number(classCount?.n ?? 0),
        publishedAnnouncements: Number(publishedAnn?.n ?? 0),
        setupPercent: wizard.percentComplete,
        multiCampusEnabled: multiCampus,
        campuses,
      },
    });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.get("/rbac-presets", requirePermission("rbac.manage.roles"), async (_req, res) => {
  res.json({ success: true, data: RBAC_PRESETS });
});

adminEnhancementsRouter.get("/roles/:roleId/permissions", requirePermission("rbac.manage.roles"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [role] = await db.select().from(roles).where(and(eq(roles.id, req.params.roleId), eq(roles.tenantId, tenant.id))).limit(1);
    if (!role) throw new NotFoundError("Role not found");
    const rows = await db.select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    res.json({ success: true, data: rows.map((r) => r.permissionId) });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.post("/roles/:roleId/apply-preset", requirePermission("rbac.manage.permissions"),
  validate({ body: z.object({ preset: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const preset = RBAC_PRESETS[req.body.preset];
      if (!preset) return res.status(400).json({ success: false, message: "Unknown preset" });
      const [role] = await db.select().from(roles).where(and(eq(roles.id, req.params.roleId), eq(roles.tenantId, tenant.id))).limit(1);
      if (!role) throw new NotFoundError("Role not found");

      const allPerms = await db.select().from(permissions);
      let permissionIds: string[];
      if (preset.codes.includes("*")) {
        permissionIds = allPerms.map((p) => p.id);
      } else {
        const codes = new Set(preset.codes);
        permissionIds = allPerms.filter((p) => codes.has(p.code)).map((p) => p.id);
      }

      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      if (permissionIds.length) {
        await db.insert(rolePermissions).values(permissionIds.map((pid) => ({ roleId: role.id, permissionId: pid })));
      }
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "role.preset.apply",
        entityType: "role", entityId: role.id, after: { preset: req.body.preset, count: permissionIds.length }, ip: req.ip,
      });
      res.json({ success: true, data: { applied: permissionIds.length } });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.get("/users-with-roles", requirePermission("settings.users.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const userRows = await db.select({
      id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, status: users.status,
    }).from(users).where(and(eq(users.tenantId, tenant.id), isNull(users.deletedAt))).orderBy(desc(users.createdAt));

    const ur = await db.select({ userId: userRoles.userId, roleId: userRoles.roleId, roleName: roles.name })
      .from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.tenantId, tenant.id));

    const byUser = Object.fromEntries(userRows.map((u) => [u.id, { ...u, roles: [] as { id: string; name: string }[] }]));
    for (const r of ur) {
      if (byUser[r.userId]) byUser[r.userId].roles.push({ id: r.roleId, name: r.roleName });
    }
    res.json({ success: true, data: Object.values(byUser) });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.get("/setup-wizard", requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await getSetupWizardStatus(tenant.id) });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.post("/setup-wizard/complete", requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.update(tenantSettings).set({
      setupWizardJson: { completedAt: new Date().toISOString() },
      updatedAt: new Date(),
    }).where(eq(tenantSettings.tenantId, tenant.id));
    res.json({ success: true, data: await getSetupWizardStatus(tenant.id) });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.post("/setup-wizard/school-profile", requirePermission("settings.manage"),
  validate({ body: z.object({ schoolName: z.string(), country: z.string().length(2).optional(), timezone: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [s] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      const branding = { ...(s?.brandingJson as object ?? {}), name: req.body.schoolName, logoText: req.body.schoolName };
      await db.update(tenantSettings).set({
        brandingJson: branding,
        country: req.body.country ?? s?.country,
        timezone: req.body.timezone ?? s?.timezone,
        updatedAt: new Date(),
      }).where(eq(tenantSettings.tenantId, tenant.id));
      res.json({ success: true, data: await getSetupWizardStatus(tenant.id) });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.get("/academics-structure", requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const years = await db.select().from(academicYears).where(eq(academicYears.tenantId, tenant.id)).orderBy(desc(academicYears.startDate));
    const termRows = await db.select().from(terms).where(eq(terms.tenantId, tenant.id));
    const classRows = await db.select().from(classes).where(eq(classes.tenantId, tenant.id)).orderBy(classes.level);
    const streamRows = await db.select().from(streams).where(eq(streams.tenantId, tenant.id));
    const structure = classRows.map((c) => ({
      ...c,
      sections: streamRows.filter((s) => s.classId === c.id),
      enrollmentCount: 0,
    }));
    for (const cls of structure) {
      const [n] = await db.select({ count: sql<number>`count(*)` }).from(studentClassHistory)
        .where(and(eq(studentClassHistory.classId, cls.id), eq(studentClassHistory.tenantId, tenant.id), isNull(studentClassHistory.toDate)));
      cls.enrollmentCount = Number(n?.count ?? 0);
    }
    res.json({ success: true, data: { years, terms: termRows, classes: structure } });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.post("/sessions/transition", requirePermission("academics.manage"),
  validate({
    body: z.object({
      newYearName: z.string(),
      newYearStart: z.string(),
      newYearEnd: z.string(),
      termName: z.string().optional(),
      termStart: z.string().optional(),
      termEnd: z.string().optional(),
      closePreviousYear: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      if (req.body.closePreviousYear) {
        await db.update(academicYears).set({ isCurrent: false }).where(eq(academicYears.tenantId, tenant.id));
        await db.update(terms).set({ isCurrent: false }).where(eq(terms.tenantId, tenant.id));
      }
      const [year] = await db.insert(academicYears).values({
        tenantId: tenant.id,
        name: req.body.newYearName,
        startDate: new Date(req.body.newYearStart),
        endDate: new Date(req.body.newYearEnd),
        isCurrent: true,
      }).returning();
      let term = null;
      if (req.body.termName && req.body.termStart && req.body.termEnd) {
        [term] = await db.insert(terms).values({
          tenantId: tenant.id,
          academicYearId: year.id,
          name: req.body.termName,
          startDate: new Date(req.body.termStart),
          endDate: new Date(req.body.termEnd),
          isCurrent: true,
        }).returning();
      }
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "session.transition",
        entityType: "academic_year", entityId: year.id, after: { year, term }, ip: req.ip,
      });
      res.status(201).json({ success: true, data: { year, term } });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.get("/noticeboard", requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(announcements).where(eq(announcements.tenantId, tenant.id)).orderBy(desc(announcements.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.post("/noticeboard", requirePermission("messaging.send"),
  validate({
    body: z.object({
      title: z.string(),
      body: z.string(),
      audience: z.enum(["all", "students", "parents", "staff"]).default("all"),
      published: z.boolean().optional(),
      publishAt: z.string().nullable().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(announcements).values({
        tenantId: tenant.id,
        title: req.body.title,
        body: req.body.body,
        audience: req.body.audience,
        published: req.body.published ?? true,
        publishAt: req.body.publishAt ? new Date(req.body.publishAt) : null,
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.delete("/noticeboard/:id", requirePermission("messaging.send"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(announcements).where(and(
      eq(announcements.id, req.params.id), eq(announcements.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Announcement not found");
    res.json({ success: true });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.patch("/noticeboard/:id", requirePermission("messaging.send"),
  validate({
    body: z.object({
      published: z.boolean().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      audience: z.enum(["all", "students", "parents", "staff"]).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(announcements).set(req.body).where(and(
        eq(announcements.id, req.params.id), eq(announcements.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Announcement not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.get("/appearance-presets", requirePermission("settings.view"), async (_req, res) => {
  res.json({ success: true, data: APPEARANCE_PRESETS });
});

adminEnhancementsRouter.post("/appearance", requirePermission("settings.manage"),
  validate({ body: z.object({ presetId: z.string().optional(), mode: z.enum(["light", "dark"]).optional(), accent: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const preset = APPEARANCE_PRESETS.find((p) => p.id === req.body.presetId);
      const themeJson = {
        mode: req.body.mode ?? preset?.mode ?? "dark",
        accent: req.body.accent ?? preset?.accent ?? "#6366f1",
        presetId: req.body.presetId ?? preset?.id,
      };
      const ext: Record<string, unknown> = {};
      if (preset?.accent) ext.primaryColor = preset.accent;
      const [before] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      const mergedExt = { ...(before?.brandingExtendedJson as object ?? {}), ...ext };
      const [row] = await db.update(tenantSettings).set({
        themeJson,
        brandingExtendedJson: mergedExt,
        updatedAt: new Date(),
      }).where(eq(tenantSettings.tenantId, tenant.id)).returning();
      res.json({ success: true, data: { themeJson: row?.themeJson, brandingExtendedJson: row?.brandingExtendedJson } });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.get("/multi-school", requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const enabled = await isTenantFeatureEnabled(tenant.id, "multi_campus");
    if (!enabled) {
      return res.json({ success: true, data: { enabled: false, campuses: [], consolidated: [] } });
    }
    const campuses = await db.select().from(tenantCampuses).where(eq(tenantCampuses.tenantId, tenant.id));
    const consolidated = [];
    for (const c of campuses) {
      const [stu] = await db.select({ count: sql<number>`count(*)` }).from(students).where(and(eq(students.tenantId, tenant.id), eq(students.campusId, c.id), isNull(students.deletedAt)));
      const [inv] = await db.select({
        total: sql<number>`coalesce(sum(${invoices.totalAmount}),0)`,
        paid: sql<number>`coalesce(sum(${invoices.paidAmount}),0)`,
      }).from(invoices).where(and(eq(invoices.tenantId, tenant.id), eq(invoices.campusId, c.id), isNull(invoices.deletedAt)));
      consolidated.push({
        campus: c,
        students: Number(stu?.count ?? 0),
        invoiced: Number(inv?.total ?? 0),
        collected: Number(inv?.paid ?? 0),
      });
    }
    res.json({ success: true, data: { enabled: true, campuses, consolidated } });
  } catch (e) { next(e); }
});

adminEnhancementsRouter.post("/data-reset", requirePermission("settings.manage"),
  validate({ body: z.object({ confirm: z.literal("RESET") }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const { resetTenantOperationalData } = await import("../services/tenant-data-reset");
      const result = await resetTenantOperationalData(tenant.id);
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "tenant.data_reset",
        entityType: "tenant", entityId: tenant.id, after: result, ip: req.ip,
      });
      res.json({ success: true, data: result, message: "Operational data cleared. Users, roles, and settings kept." });
    } catch (e) { next(e); }
  },
);

adminEnhancementsRouter.post("/demo-seed", requirePermission("settings.manage"),
  validate({ body: z.object({ full: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const body = req.body ?? {};
      const result = await seedDemoDataForTenant(tenant.id, { full: Boolean(body.full) });
      try {
        await createAuditLog({
          tenantId: tenant.id, actorUserId: user.id, action: "tenant.demo_seed",
          entityType: "tenant", entityId: tenant.id,
          after: { message: result.message, stats: result.stats, createdCount: result.created.length },
          ip: req.ip,
        });
      } catch (auditErr) {
        console.error("[demo-seed] audit log failed:", auditErr);
      }
      res.json({ success: true, data: result });
    } catch (e) {
      console.error("[demo-seed]", e);
      const msg = e instanceof Error ? e.message : "Demo seed failed";
      next(new BadRequestError(msg));
    }
  },
);

export default adminEnhancementsRouter;
