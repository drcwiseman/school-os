import crypto from "crypto";
import { db } from "../db";
import { platformImpersonationTokens, users, userRoles, roles } from "../db/schema";
import { userAuthColumns } from "../lib/user-columns";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createSession } from "../middleware/auth";

export type ImpersonationTargetUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
};

export type ImpersonationTargetRow = ImpersonationTargetUser & {
  roleNames: string[];
};

/** All active ERP users with roles (for platform impersonation picker). */
export async function listImpersonationTargets(tenantId: string): Promise<{
  users: ImpersonationTargetRow[];
  roles: string[];
}> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      status: users.status,
      roleName: roles.name,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)))
    .orderBy(users.firstName, users.lastName);

  const byId = new Map<string, ImpersonationTargetRow>();
  for (const row of rows) {
    let entry = byId.get(row.id);
    if (!entry) {
      entry = {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        status: row.status,
        roleNames: [],
      };
      byId.set(row.id, entry);
    }
    if (row.roleName && !entry.roleNames.includes(row.roleName)) {
      entry.roleNames.push(row.roleName);
    }
  }

  const activeUsers = [...byId.values()].filter((u) => u.status === "active");
  const roleSet = new Set<string>();
  for (const u of activeUsers) {
    for (const r of u.roleNames) roleSet.add(r);
  }
  const roleNames = [...roleSet].sort((a, b) => a.localeCompare(b));
  return { users: activeUsers, roles: roleNames };
}

/** Resolve which user to impersonate (explicit user, first match for role, or default admin). */
export async function resolveImpersonationUser(
  tenantId: string,
  opts: { userId?: string; roleName?: string },
): Promise<ImpersonationTargetUser> {
  if (opts.userId) {
    const [user] = await db
      .select(userAuthColumns)
      .from(users)
      .where(
        and(eq(users.id, opts.userId), eq(users.tenantId, tenantId), isNull(users.deletedAt)),
      )
      .limit(1);
    if (!user || user.status !== "active") {
      throw new Error("User not found or inactive");
    }
    return user;
  }

  if (opts.roleName?.trim()) {
    const roleFilter = opts.roleName.trim();
    const rows = await db
      .select(userAuthColumns)
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.tenantId, tenantId),
          isNull(users.deletedAt),
          eq(users.status, "active"),
          eq(roles.name, roleFilter),
        ),
      )
      .orderBy(users.email);
    if (!rows.length) {
      throw new Error(`No active user with role "${roleFilter}"`);
    }
    return rows[0];
  }

  const fallback = await findImpersonationTargetUser(tenantId);
  if (!fallback) throw new Error("No school user found — add an admin when creating the school");
  return fallback;
}

export async function findImpersonationTargetUser(tenantId: string) {
  const allUsers = await db
    .select({ ...userAuthColumns, roleName: roles.name })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)));

  const activeRows = allUsers.filter((r) => r.status === "active");
  if (!activeRows.length) return null;

  const admin = activeRows.find(
    (r) => r.roleName && /school administrator|tenant admin|administrator/i.test(r.roleName),
  );
  const pick = admin ?? activeRows[0];
  if (!pick) return null;

  const { roleName: _r, ...user } = pick;
  return user;
}

export async function createImpersonationToken(opts: {
  tenantId: string;
  targetUserId: string;
  platformAdminId: string;
  readOnly?: boolean;
}) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
  const [row] = await db
    .insert(platformImpersonationTokens)
    .values({
      token,
      tenantId: opts.tenantId,
      targetUserId: opts.targetUserId,
      platformAdminId: opts.platformAdminId,
      readOnly: opts.readOnly === true,
      expiresAt,
    })
    .returning();
  return row;
}

export async function exchangeImpersonationToken(
  token: string,
  expectedTenantId: string,
  ip?: string,
  ua?: string,
) {
  const [row] = await db
    .select()
    .from(platformImpersonationTokens)
    .where(
      and(
        eq(platformImpersonationTokens.token, token),
        gt(platformImpersonationTokens.expiresAt, new Date()),
        isNull(platformImpersonationTokens.usedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.tenantId !== expectedTenantId) return null;

  const [user] = await db
    .select(userAuthColumns)
    .from(users)
    .where(
      and(
        eq(users.id, row.targetUserId),
        eq(users.tenantId, row.tenantId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!user || user.status !== "active") return null;

  await db
    .update(platformImpersonationTokens)
    .set({ usedAt: new Date() })
    .where(eq(platformImpersonationTokens.id, row.id));

  const session = await createSession(row.targetUserId, row.tenantId, ip, ua, {
    impersonation: true,
    readOnly: row.readOnly,
    platformAdminId: row.platformAdminId,
  });

  return { session, user, readOnly: row.readOnly, tenantId: row.tenantId };
}
