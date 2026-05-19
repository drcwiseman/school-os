import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { tenants } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError, ForbiddenError } from "./error";

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    let slug = req.params.schoolSlug as string | undefined;

    // Easy Switch: Extract school slug from subdomain if USE_SUBDOMAIN is enabled
    if (process.env.USE_SUBDOMAIN === "true") {
      const host = req.headers.host || "";
      const parts = host.split(".");
      // If host is e.g. school-a.schoolos.com or school-a.localhost:5000
      if (parts.length >= 2 && parts[0] !== "www" && parts[0] !== "localhost") {
        slug = parts[0];
      }
    }

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
