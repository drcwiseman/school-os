import crypto from "crypto";
import { db } from "../db";
import { platformImpersonationTokens, users, userRoles, roles } from "../db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createSession } from "../middleware/auth";

export async function findImpersonationTargetUser(tenantId: string) {
  const admins = await db
    .select({ user: users })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(users.tenantId, tenantId), eq(roles.name, "School Administrator")))
    .limit(1);
  if (admins[0]) return admins[0].user;

  const [any] = await db.select().from(users).where(eq(users.tenantId, tenantId)).limit(1);
  return any ?? null;
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
      readOnly: opts.readOnly !== false,
      expiresAt,
    })
    .returning();
  return row;
}

export async function exchangeImpersonationToken(token: string, ip?: string, ua?: string) {
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

  await db
    .update(platformImpersonationTokens)
    .set({ usedAt: new Date() })
    .where(eq(platformImpersonationTokens.id, row.id));

  const session = await createSession(row.targetUserId, row.tenantId, ip, ua, {
    impersonation: true,
    readOnly: row.readOnly,
    platformAdminId: row.platformAdminId,
  });

  return { session, readOnly: row.readOnly, tenantId: row.tenantId };
}
