import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../middleware/error";

/** Platform operator capabilities — separate from tenant RBAC. */
export const PLATFORM_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*", "tenants.provision"],
  support: [
    "tenants.read",
    "tenants.features",
    "stats.read",
    "plans.read",
  ],
  billing: [
    "tenants.read",
    "plans.read",
    "plans.assign",
    "stats.read",
  ],
};

export function platformAdminHasPermission(role: string, permission: string): boolean {
  const perms = PLATFORM_ROLE_PERMISSIONS[role] ?? PLATFORM_ROLE_PERMISSIONS.support;
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}

export function requirePlatformPermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const admin = (req as any).platformAdmin as { role?: string } | undefined;
    const role = admin?.role ?? "super_admin";
    if (!platformAdminHasPermission(role, permission)) {
      return next(new ForbiddenError(`Platform permission denied: ${permission}`));
    }
    next();
  };
}
