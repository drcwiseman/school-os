import { eq } from "drizzle-orm";
import { db } from "../db";
import { platformSettings } from "../db/schema";
import { BadRequestError } from "../middleware/error";
import {
  PLATFORM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PLATFORM_PERMISSION_CATALOG,
  type PlatformRole,
  isPlatformRole,
} from "../lib/platform-permission-defaults";

const SETTINGS_KEY = "role_permissions";

const CATALOG_CODES = new Set(PLATFORM_PERMISSION_CATALOG.map((p) => p.code));

let cache: Record<PlatformRole, string[]> | null = null;

function normalizeList(codes: string[], role: PlatformRole): string[] {
  const unique = [...new Set(codes.filter((c) => CATALOG_CODES.has(c) || c === "*"))];
  if (role === "super_admin") {
    if (!unique.includes("*")) unique.unshift("*");
    return unique;
  }
  return unique.filter((c) => c !== "*");
}

export async function loadEffectiveRolePermissions(): Promise<Record<PlatformRole, string[]>> {
  if (cache) return cache;

  const merged = { ...DEFAULT_ROLE_PERMISSIONS } as Record<PlatformRole, string[]>;

  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
    const stored = (row?.value ?? {}) as Partial<Record<string, string[]>>;
    for (const role of PLATFORM_ROLES) {
      const custom = stored[role];
      if (Array.isArray(custom) && custom.length > 0) {
        merged[role] = normalizeList(custom, role);
      }
    }
  } catch {
    // use defaults
  }

  cache = merged;
  return merged;
}

export function invalidateRolePermissionsCache() {
  cache = null;
}

export async function warmRolePermissionsCache() {
  await loadEffectiveRolePermissions();
}

export async function getRolePermissionCodes(role: string): Promise<string[]> {
  const map = await loadEffectiveRolePermissions();
  if (isPlatformRole(role)) return map[role];
  return map.support;
}

export async function roleHasPermissionAsync(role: string, permission: string): Promise<boolean> {
  const perms = await getRolePermissionCodes(role);
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}

export async function updateRolePermissions(role: PlatformRole, permissions: string[]) {
  if (!isPlatformRole(role)) throw new BadRequestError("Invalid role");

  const normalized = normalizeList(permissions, role);

  if (role === "super_admin" && !normalized.includes("*")) {
    throw new BadRequestError("Super Admin must keep full access (*)");
  }

  if (role !== "super_admin" && normalized.length === 0) {
    throw new BadRequestError("Select at least one permission for this role");
  }

  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
  const stored = { ...((row?.value ?? {}) as Record<string, string[]>) };
  stored[role] = normalized;

  await db
    .insert(platformSettings)
    .values({ key: SETTINGS_KEY, value: stored, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: stored, updatedAt: new Date() },
    });

  invalidateRolePermissionsCache();
  return normalized;
}

export async function resetRolePermissions(role: PlatformRole) {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
  const stored = { ...((row?.value ?? {}) as Record<string, string[]>) };
  delete stored[role];

  if (Object.keys(stored).length === 0) {
    await db.delete(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY));
  } else {
    await db
      .insert(platformSettings)
      .values({ key: SETTINGS_KEY, value: stored, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: stored, updatedAt: new Date() },
      });
  }

  invalidateRolePermissionsCache();
  return DEFAULT_ROLE_PERMISSIONS[role];
}
