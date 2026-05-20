import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { roles, tenants, userRoles, users } from "../db/schema";
import { hashPassword } from "../middleware/auth";
import { schoolLoginPath } from "../lib/app-origin";
import { findImpersonationTargetUser } from "./impersonation";

export type SchoolErpUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roleName: string | null;
  isPrimaryAdmin: boolean;
};

export async function listSchoolErpUsers(tenantId: string): Promise<SchoolErpUserRow[]> {
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
    .orderBy(users.createdAt);

  const primary = await findImpersonationTargetUser(tenantId);
  const primaryId = primary?.id;

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    status: r.status,
    roleName: r.roleName,
    isPrimaryAdmin: r.id === primaryId,
  }));
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

export async function resetSchoolAdministratorPassword(tenantSlug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) throw new Error("School not found");

  const target = await findImpersonationTargetUser(tenant.id);
  if (!target) throw new Error("No ERP user found for this school — create a school administrator first");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, target.id));

  const loginUrl = await schoolLoginPath(tenant.slug);

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    schoolName: tenant.name,
    userId: target.id,
    email: target.email,
    loginUrl,
    temporaryPassword,
  };
}
