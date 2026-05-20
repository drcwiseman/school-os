import { db } from "../db";
import { platformAdmins, platformSessions } from "../db/schema";
import { eq, sql, gt, desc, and } from "drizzle-orm";
import { NotFoundError, BadRequestError, ForbiddenError } from "../middleware/error";
import { hashPassword } from "../middleware/auth";
import { platformAdminPublic } from "../db/platform-admin-columns";
import { PLATFORM_ROLE_PERMISSIONS } from "../lib/platform-permissions";

export const PLATFORM_ROLES = ["super_admin", "support", "billing"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export function isPlatformRole(v: string): v is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(v);
}

export type PlatformAdminRow = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  createdAt: string;
  activeSessions: number;
};

export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  const rows = await db
    .select({
      id: platformAdmins.id,
      email: platformAdmins.email,
      name: platformAdmins.name,
      role: platformAdmins.role,
      createdAt: platformAdmins.createdAt,
    })
    .from(platformAdmins)
    .orderBy(desc(platformAdmins.createdAt));

  const sessionRows = await db
    .select({
      adminId: platformSessions.adminId,
      count: sql<number>`count(*)::int`,
    })
    .from(platformSessions)
    .where(gt(platformSessions.expiresAt, new Date()))
    .groupBy(platformSessions.adminId);

  const sessionMap = new Map(sessionRows.map((s) => [s.adminId, Number(s.count ?? 0)]));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: (isPlatformRole(r.role) ? r.role : "support") as PlatformRole,
    createdAt: r.createdAt.toISOString(),
    activeSessions: sessionMap.get(r.id) ?? 0,
  }));
}

export async function createPlatformAdmin(opts: {
  email: string;
  name: string;
  password: string;
  role: PlatformRole;
}) {
  const email = opts.email.trim().toLowerCase();
  const [existing] = await db.select({ id: platformAdmins.id }).from(platformAdmins)
    .where(eq(platformAdmins.email, email)).limit(1);
  if (existing) throw new BadRequestError("An admin with this email already exists");

  const passwordHash = await hashPassword(opts.password);
  const [row] = await db.insert(platformAdmins).values({
    email,
    name: opts.name.trim(),
    passwordHash,
    role: opts.role,
  }).returning({
    id: platformAdmins.id,
    email: platformAdmins.email,
    name: platformAdmins.name,
    role: platformAdmins.role,
    createdAt: platformAdmins.createdAt,
  });

  return {
    ...platformAdminPublic(row),
    createdAt: row.createdAt.toISOString(),
    activeSessions: 0,
  };
}

export async function updatePlatformAdmin(
  adminId: string,
  patch: { name?: string; role?: PlatformRole },
  actorId: string,
) {
  const [existing] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, adminId)).limit(1);
  if (!existing) throw new NotFoundError("Admin not found");

  if (patch.role && existing.role === "super_admin" && patch.role !== "super_admin") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(platformAdmins)
      .where(eq(platformAdmins.role, "super_admin"));
    if (Number(count) <= 1) {
      throw new BadRequestError("Cannot demote the last super admin");
    }
  }

  const [row] = await db.update(platformAdmins).set({
    name: patch.name?.trim() ?? existing.name,
    role: patch.role ?? existing.role,
  }).where(eq(platformAdmins.id, adminId)).returning({
    id: platformAdmins.id,
    email: platformAdmins.email,
    name: platformAdmins.name,
    role: platformAdmins.role,
    createdAt: platformAdmins.createdAt,
  });

  if (patch.role && adminId === actorId && patch.role !== existing.role) {
    // actor may need re-login; allowed
  }

  const [sess] = await db.select({ count: sql<number>`count(*)::int` })
    .from(platformSessions)
    .where(and(eq(platformSessions.adminId, adminId), gt(platformSessions.expiresAt, new Date())));

  return {
    ...platformAdminPublic(row),
    createdAt: row.createdAt.toISOString(),
    activeSessions: Number(sess?.count ?? 0),
  };
}

export async function resetPlatformAdminPassword(adminId: string, newPassword: string) {
  const [existing] = await db.select({ id: platformAdmins.id }).from(platformAdmins)
    .where(eq(platformAdmins.id, adminId)).limit(1);
  if (!existing) throw new NotFoundError("Admin not found");

  const passwordHash = await hashPassword(newPassword);
  await db.update(platformAdmins).set({ passwordHash }).where(eq(platformAdmins.id, adminId));
  await db.delete(platformSessions).where(eq(platformSessions.adminId, adminId));
  return { success: true };
}

export async function deletePlatformAdmin(adminId: string, actorId: string) {
  if (adminId === actorId) throw new ForbiddenError("You cannot delete your own account");

  const [existing] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, adminId)).limit(1);
  if (!existing) throw new NotFoundError("Admin not found");

  if (existing.role === "super_admin") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(platformAdmins)
      .where(eq(platformAdmins.role, "super_admin"));
    if (Number(count) <= 1) throw new BadRequestError("Cannot delete the last super admin");
  }

  await db.delete(platformSessions).where(eq(platformSessions.adminId, adminId));
  await db.delete(platformAdmins).where(eq(platformAdmins.id, adminId));
  return { success: true };
}

export function getRoleMeta() {
  return PLATFORM_ROLES.map((role) => ({
    role,
    permissions: PLATFORM_ROLE_PERMISSIONS[role] ?? [],
  }));
}
