import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../middleware/error";
import {
  loadEffectiveRolePermissions,
  roleHasPermissionAsync,
} from "../services/platform-role-settings";

export {
  PLATFORM_ROLES,
  type PlatformRole,
  isPlatformRole,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_DESCRIPTIONS,
  PLATFORM_PERMISSION_CATALOG,
  DEFAULT_ROLE_PERMISSIONS,
  type PlatformPermissionDef,
} from "./platform-permission-defaults";

import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_DESCRIPTIONS,
  PLATFORM_PERMISSION_CATALOG,
  DEFAULT_ROLE_PERMISSIONS,
  type PlatformRole,
} from "./platform-permission-defaults";

/** @deprecated Use roleHasPermissionAsync */
export function roleHasPermission(role: string, permission: string): boolean {
  const perms = DEFAULT_ROLE_PERMISSIONS[role as PlatformRole] ?? DEFAULT_ROLE_PERMISSIONS.support;
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}

export async function platformAdminHasPermission(role: string, permission: string): Promise<boolean> {
  return roleHasPermissionAsync(role, permission);
}

export async function permissionsForRole(role: PlatformRole) {
  const map = await loadEffectiveRolePermissions();
  const codes = map[role];
  if (codes.includes("*")) return [...PLATFORM_PERMISSION_CATALOG];
  const set = new Set(codes);
  return PLATFORM_PERMISSION_CATALOG.filter((p) => set.has(p.code));
}

export async function getPlatformRolesMeta() {
  const map = await loadEffectiveRolePermissions();
  return PLATFORM_ROLES.map((role) => {
    const codes = map[role];
    const hasFullAccess = codes.includes("*");
    const effective = hasFullAccess
      ? PLATFORM_PERMISSION_CATALOG.map((p) => p.code)
      : codes.filter((c) => c !== "*");
    return {
      role,
      label: PLATFORM_ROLE_LABELS[role],
      description: PLATFORM_ROLE_DESCRIPTIONS[role],
      permissions: effective,
      permissionCount: effective.length,
      hasFullAccess,
      editable: role !== "super_admin",
    };
  });
}

export function requirePlatformPermission(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const admin = (req as Request & { platformAdmin?: { role?: string } }).platformAdmin;
      const role = admin?.role ?? "super_admin";
      const ok = await roleHasPermissionAsync(role, permission);
      if (!ok) {
        return next(new ForbiddenError(`Platform permission denied: ${permission}`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
