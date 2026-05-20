import crypto from "crypto";
import { db } from "../db";
import { platformImpersonationTokens, users, userRoles, roles } from "../db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createSession } from "../middleware/auth";

export async function findImpersonationTargetUser(tenantId: string) {
  const allUsers = await db
    .select({ user: users, roleName: roles.name })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)));

  const activeRows = allUsers.filter((r) => r.user.status === "active");
  if (!activeRows.length) return null;

  const admin = activeRows.find(
    (r) => r.roleName && /school administrator|tenant admin|administrator/i.test(r.roleName),
  );
  if (admin) return admin.user;

  return activeRows[0]?.user ?? null;
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
    .select()
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
