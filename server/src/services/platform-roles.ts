import { listPlatformAdmins } from "./platform-admins";
import {
  getPlatformRolesMeta,
  PLATFORM_PERMISSION_CATALOG,
  PLATFORM_ROLES,
  type PlatformRole,
} from "../lib/platform-permissions";

export async function getPlatformRolesOverview() {
  const admins = await listPlatformAdmins();
  const rolesMeta = getPlatformRolesMeta();

  const usersByRole: Record<PlatformRole, typeof admins> = {
    super_admin: [],
    support: [],
    billing: [],
  };

  for (const a of admins) {
    const role = (PLATFORM_ROLES as readonly string[]).includes(a.role) ? a.role as PlatformRole : "support";
    usersByRole[role].push(a);
  }

  return {
    roles: rolesMeta,
    catalog: PLATFORM_PERMISSION_CATALOG,
    usersByRole,
    totals: {
      admins: admins.length,
      permissions: PLATFORM_PERMISSION_CATALOG.length,
    },
  };
}
