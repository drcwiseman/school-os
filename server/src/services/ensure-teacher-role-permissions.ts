import { db } from "../db";
import { permissions, roles, rolePermissions, tenants } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { TEACHER_ROLE_PERMISSION_CODES } from "../lib/teacher-permissions";

/** Idempotent: ensure academics.teach exists and Teacher role has full teacher preset on all tenants. */
export async function ensureTeacherRolePermissions() {
  for (const code of TEACHER_ROLE_PERMISSION_CODES) {
    const module = code.split(".")[0];
    await db
      .insert(permissions)
      .values({ code, module, description: `Auto: ${code}` })
      .onConflictDoNothing({ target: [permissions.code] });
  }

  const permRows = await db
    .select()
    .from(permissions)
    .where(inArray(permissions.code, [...TEACHER_ROLE_PERMISSION_CODES]));
  const permByCode = new Map(permRows.map((p) => [p.code, p.id]));

  const tenantRows = await db.select({ id: tenants.id }).from(tenants);
  for (const tenant of tenantRows) {
    const [teacherRole] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenant.id), eq(roles.name, "Teacher")))
      .limit(1);
    if (!teacherRole) continue;

    for (const code of TEACHER_ROLE_PERMISSION_CODES) {
      const permissionId = permByCode.get(code);
      if (!permissionId) continue;
      await db
        .insert(rolePermissions)
        .values({ roleId: teacherRole.id, permissionId })
        .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });
    }
  }
}
