/** Shared defaults — no imports from services (avoids circular deps). */

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

export type PlatformPermissionDef = {
  code: string;
  label: string;
  description: string;
  group: string;
};

export const PLATFORM_PERMISSION_CATALOG: PlatformPermissionDef[] = [
  { code: "tenants.read", label: "View schools", description: "List and open school detail, impersonate", group: "Schools" },
  { code: "tenants.provision", label: "Provision schools", description: "Create schools, domains, platform users", group: "Schools" },
  { code: "tenants.suspend", label: "Suspend schools", description: "Change school status (active/trial/suspended)", group: "Schools" },
  { code: "tenants.features", label: "Manage features", description: "Toggle plan features and add-ons per school", group: "Schools" },
  { code: "plans.read", label: "View plans", description: "Plans & pricing catalog and subscriptions list", group: "Billing" },
  { code: "plans.write", label: "Edit plans", description: "Create/update/delete plan tiers and regional prices", group: "Billing" },
  { code: "plans.assign", label: "Assign subscriptions", description: "Assign or change a school's subscription plan", group: "Billing" },
  { code: "stats.read", label: "View analytics", description: "Dashboard stats, revenue, invoices, transactions, payouts", group: "Analytics" },
  { code: "roles.manage", label: "Manage role permissions", description: "Edit capabilities for Support and Billing roles", group: "Platform" },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<PlatformRole, string[]> = {
  super_admin: ["*", "tenants.provision", "tenants.suspend", "plans.write", "roles.manage"],
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
