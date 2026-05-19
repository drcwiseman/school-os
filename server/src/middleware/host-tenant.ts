import { Request, Response, NextFunction } from "express";
import { resolveTenantByHost, isPlatformHost } from "../services/tenant-resolve";

/**
 * When USE_SUBDOMAIN=true or request hits a school custom domain,
 * attach resolved tenant and canonical slug for downstream routers.
 */
export async function attachTenantFromHost(req: Request, _res: Response, next: NextFunction) {
  try {
    const host = req.headers.host ?? "";
    if (!host || isPlatformHost(host)) return next();

    const useSubdomain = process.env.USE_SUBDOMAIN === "true";
    const tenant = await resolveTenantByHost(host);
    if (!tenant) return next();

    (req as any).resolvedTenantFromHost = tenant;
    if (useSubdomain || tenant.domainVerified) {
      req.params.schoolSlug = tenant.slug;
      (req as any).tenant = tenant;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** SPA: redirect bare paths on school host to /s/:slug/... */
export function redirectSchoolHostToSlugPath(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).resolvedTenantFromHost as { slug: string } | undefined;
  if (!tenant) return next();
  if (req.path.startsWith("/api") || req.path.startsWith("/s/") || req.path.startsWith("/platform")) {
    return next();
  }
  const target = `/s/${tenant.slug}${req.path === "/" ? "/dashboard" : req.path}`;
  return res.redirect(302, target);
}
