import { Request } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { ForbiddenError } from "../middleware/error";

/** Resolved school from resolveTenant middleware */
export type TenantContext = { id: string; slug: string; name: string; status: string };

/** Staff user from requireAuth — always tenant-scoped */
export type StaffUser = { id: string; tenantId: string; email: string };

export function getTenant(req: Request): TenantContext {
  const tenant = (req as any).tenant as TenantContext | undefined;
  if (!tenant?.id) throw new ForbiddenError("School context required");
  return tenant;
}

export function getTenantId(req: Request): string {
  return getTenant(req).id;
}

export function getStaffUser(req: Request): StaffUser {
  const user = (req as any).user as StaffUser | undefined;
  if (!user?.id) throw new ForbiddenError("Staff authentication required");
  return user;
}

/** Ensures staff session belongs to the resolved tenant (use after requireAuth + resolveTenant). */
export function assertStaffTenantMatch(req: Request): void {
  const tenant = getTenant(req);
  const user = getStaffUser(req);
  if (user.tenantId !== tenant.id) {
    throw new ForbiddenError("Staff account does not belong to this school");
  }
}

/** Drizzle helper: AND tenant_id = ctx.tenantId */
export function tenantWhere<T extends { tenantId: any }>(
  table: T,
  tenantId: string,
): SQL {
  return eq(table.tenantId, tenantId);
}
