import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { tenants } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError, ForbiddenError } from "./error";

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.schoolSlug as string | undefined;
    if (!slug) return next(new NotFoundError("School slug is required"));

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (!tenant) return next(new NotFoundError(`School '${slug}' not found`));
    if (tenant.status === "suspended") return next(new ForbiddenError("This school account is suspended"));

    (req as any).tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

/** Guard: ensures authenticated user belongs to the resolved tenant */
export function requireTenantMatch(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).tenant;
  const user   = (req as any).user;
  if (!tenant || !user) return next(new ForbiddenError("Tenant or user context missing"));
  if (user.tenantId !== tenant.id) return next(new ForbiddenError("Access denied to this school"));
  next();
}
