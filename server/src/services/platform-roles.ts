import { listPlatformAdmins } from "./platform-admins";
import { getPlatformRolesMeta } from "../lib/platform-permissions";
import {
  PLATFORM_PERMISSION_CATALOG,
  PLATFORM_ROLES,
  type PlatformRole,
  isPlatformRole,
} from "../lib/platform-permission-defaults";
import {
  loadEffectiveRolePermissions,
  updateRolePermissions,
  resetRolePermissions,
} from "./platform-role-settings";

export async function getPlatformRolesOverview(actorRole: string) {
  const admins = await listPlatformAdmins();
  const rolesMeta = await getPlatformRolesMeta();
  const effective = await loadEffectiveRolePermissions();

  const usersByRole: Record<PlatformRole, typeof admins> = {
    super_admin: [],
    support: [],
    billing: [],
  };

  for (const a of admins) {
    const role = isPlatformRole(a.role) ? a.role : "support";
    usersByRole[role].push(a);
  }

  const perms = await loadEffectiveRolePermissions();
  const actorCodes = isPlatformRole(actorRole) ? perms[actorRole] : [];
  const canManageRoles = actorCodes.includes("*") || actorCodes.includes("roles.manage");

  return {
    roles: rolesMeta,
    catalog: PLATFORM_PERMISSION_CATALOG,
    effectivePermissions: effective,
    usersByRole,
    canManageRoles,
    totals: {
      admins: admins.length,
      permissions: PLATFORM_PERMISSION_CATALOG.length,
    },
  };
}

export async function patchPlatformRolePermissions(role: string, permissions: string[]) {
  if (!isPlatformRole(role)) throw new Error("Invalid role");
  const normalized = await updateRolePermissions(role, permissions);
  return getPlatformRolesMeta();
}

export async function restorePlatformRoleDefaults(role: string) {
  if (!isPlatformRole(role)) throw new Error("Invalid role");
  await resetRolePermissions(role);
  return getPlatformRolesMeta();
}
