import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userRoles, rolePermissions, permissions } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ForbiddenError, UnauthorizedError } from "./error";

/** Cache user permissions per request to avoid repeated DB hits */
async function getUserPermissions(userId: string, tenantId: string): Promise<string[]> {
  const roleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.tenantId, tenantId)));

  if (roleRows.length === 0) return [];

  const roleIds = roleRows.map((r) => r.roleId);
  const permRows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(rolePermissions.roleId, roleIds));

  return permRows.map((p) => p.code);
}

export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) return next(new UnauthorizedError("Authentication required"));

      if (!(req as any)._permissions) {
        (req as any)._permissions = await getUserPermissions(user.id, user.tenantId);
      }

      const perms: string[] = (req as any)._permissions;
      if (!perms.includes(permissionCode)) {
        return next(new ForbiddenError(`Permission denied: '${permissionCode}' required`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Pass if the user has any one of the listed permissions. */
export function requireAnyPermission(...permissionCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) return next(new UnauthorizedError("Authentication required"));

      if (!(req as any)._permissions) {
        (req as any)._permissions = await getUserPermissions(user.id, user.tenantId);
      }

      const perms: string[] = (req as any)._permissions;
      if (!permissionCodes.some((code) => perms.includes(code))) {
        return next(new ForbiddenError(`Permission denied: one of [${permissionCodes.join(", ")}] required`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export { getUserPermissions };
