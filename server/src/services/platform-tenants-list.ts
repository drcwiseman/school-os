import { db } from "../db";
import { tenants, tenantSettings, tenantPlans, plans, users, roles, userRoles } from "../db/schema";
import { eq, asc, sql, inArray, and, isNull } from "drizzle-orm";

export type PlatformTenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  subdomain: string | null;
  customDomain: string | null;
  domainVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  planCode: string | null;
  planName: string | null;
  studentCount: number;
  staffCount: number;
  erpUserCount: number;
  adminEmail: string | null;
};

async function safeCountStudents(tenantId: string): Promise<number> {
  try {
    const r = await db.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM students WHERE tenant_id = ${tenantId}
    `);
    return Number(r.rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

async function safeCountStaff(tenantId: string): Promise<number> {
  try {
    const r = await db.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM staff WHERE tenant_id = ${tenantId}
    `);
    return Number(r.rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

async function safeCountUsers(tenantId: string): Promise<number> {
  try {
    const r = await db.execute<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM users WHERE tenant_id = ${tenantId}
    `);
    return Number(r.rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

async function loadAdminEmails(tenantIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (tenantIds.length === 0) return map;

  try {
    const rows = await db
      .select({ tenantId: users.tenantId, email: users.email, createdAt: users.createdAt })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(
        inArray(users.tenantId, tenantIds),
        eq(roles.name, "School Administrator"),
        isNull(users.deletedAt),
      ))
      .orderBy(users.createdAt);

    for (const row of rows) {
      if (!map.has(row.tenantId)) map.set(row.tenantId, row.email);
    }
    return map;
  } catch {
    /* deleted_at or join missing — fall back to first user per tenant */
  }

  try {
    const rows = await db
      .select({ tenantId: users.tenantId, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(inArray(users.tenantId, tenantIds))
      .orderBy(users.createdAt);
    for (const row of rows) {
      if (!map.has(row.tenantId)) map.set(row.tenantId, row.email);
    }
  } catch {
    /* ignore */
  }

  return map;
}

async function loadTenantBase() {
  try {
    return await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
        subdomain: tenants.subdomain,
        customDomain: tenants.customDomain,
        domainVerified: tenants.domainVerified,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        country: tenantSettings.country,
        currency: tenantSettings.currency,
        timezone: tenantSettings.timezone,
        planCode: plans.code,
        planName: plans.name,
      })
      .from(tenants)
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
      .leftJoin(tenantPlans, eq(tenantPlans.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, tenantPlans.planId))
      .orderBy(asc(tenants.name));
  } catch {
    return await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
        country: tenantSettings.country,
        currency: tenantSettings.currency,
        timezone: tenantSettings.timezone,
        planCode: plans.code,
        planName: plans.name,
      })
      .from(tenants)
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
      .leftJoin(tenantPlans, eq(tenantPlans.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, tenantPlans.planId))
      .orderBy(asc(tenants.name))
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          subdomain: null as string | null,
          customDomain: null as string | null,
          domainVerified: false,
        })),
      );
  }
}

/** List schools for platform console — resilient on partial VPS schema. */
export async function listPlatformTenants(): Promise<PlatformTenantRow[]> {
  const base = await loadTenantBase();

  const ids = base.map((r) => r.id);
  const adminEmails = await loadAdminEmails(ids);

  const enriched = await Promise.all(
    base.map(async (row) => {
      const [studentCount, staffCount, erpUserCount] = await Promise.all([
        safeCountStudents(row.id),
        safeCountStaff(row.id),
        safeCountUsers(row.id),
      ]);
      return {
        ...row,
        subdomain: row.subdomain ?? null,
        customDomain: row.customDomain ?? null,
        domainVerified: row.domainVerified ?? false,
        studentCount,
        staffCount,
        erpUserCount,
        adminEmail: adminEmails.get(row.id) ?? null,
      };
    }),
  );

  return enriched;
}
