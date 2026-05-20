import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../middleware/error";

export const PLATFORM_ROLES = ["super_admin", "support", "billing"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export function isPlatformRole(v: string): v is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(v);
}

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  support: "Support",
  billing: "Billing",
};

export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  super_admin: "Full platform control — schools, plans, finance, users, and all settings.",
  support: "Day-to-day operations — view schools, manage features, suspend tenants, support tickets.",
  billing: "Subscriptions and revenue — assign plans, view finance ledgers and school billing.",
};

/** Platform operator capabilities — separate from tenant (school) RBAC. */
export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, string[]> = {
  super_admin: ["*", "tenants.provision", "tenants.suspend", "plans.write"],
  support: [
    "tenants.read",
    "tenants.features",
    "tenants.suspend",
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

export type PlatformPermissionDef = {
  code: string;
  label: string;
  description: string;
  group: string;
};

/** All granular permissions (excluding wildcard). */
export const PLATFORM_PERMISSION_CATALOG: PlatformPermissionDef[] = [
  { code: "tenants.read", label: "View schools", description: "List and open school detail, impersonate", group: "Schools" },
  { code: "tenants.provision", label: "Provision schools", description: "Create schools, domains, platform users", group: "Schools" },
  { code: "tenants.suspend", label: "Suspend schools", description: "Change school status (active/trial/suspended)", group: "Schools" },
  { code: "tenants.features", label: "Manage features", description: "Toggle plan features and add-ons per school", group: "Schools" },
  { code: "plans.read", label: "View plans", description: "Plans & pricing catalog and subscriptions list", group: "Billing" },
  { code: "plans.write", label: "Edit plans", description: "Create/update/delete plan tiers and regional prices", group: "Billing" },
  { code: "plans.assign", label: "Assign subscriptions", description: "Assign or change a school's subscription plan", group: "Billing" },
  { code: "stats.read", label: "View analytics", description: "Dashboard stats, revenue, invoices, transactions, payouts", group: "Analytics" },
];

export function roleHasPermission(role: string, permission: string): boolean {
  const perms = PLATFORM_ROLE_PERMISSIONS[role as PlatformRole] ?? PLATFORM_ROLE_PERMISSIONS.support;
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}

export function platformAdminHasPermission(role: string, permission: string): boolean {
  return roleHasPermission(role, permission);
}

export function permissionsForRole(role: PlatformRole): PlatformPermissionDef[] {
  const codes = PLATFORM_ROLE_PERMISSIONS[role];
  if (codes.includes("*")) return [...PLATFORM_PERMISSION_CATALOG];
  const set = new Set(codes);
  return PLATFORM_PERMISSION_CATALOG.filter((p) => set.has(p.code));
}

export function getPlatformRolesMeta() {
  return PLATFORM_ROLES.map((role) => ({
    role,
    label: PLATFORM_ROLE_LABELS[role],
    description: PLATFORM_ROLE_DESCRIPTIONS[role],
    permissions: permissionsForRole(role).map((p) => p.code),
    permissionCount: permissionsForRole(role).length,
    hasFullAccess: PLATFORM_ROLE_PERMISSIONS[role].includes("*"),
  }));
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
