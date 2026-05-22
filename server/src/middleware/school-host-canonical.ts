import { Request, Response, NextFunction } from "express";
import { hostMatchesTenantCustomDomain } from "../lib/custom-domain-host";

/**
 * On a verified custom domain, force /s/:slug to the school's canonical slug
 * so bookmarks to the wrong slug cannot access another tenant.
 */
export function canonicalizeSchoolHostSlug(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).tenant as { slug: string; customDomain?: string | null; domainVerified?: boolean } | undefined;
  if (!tenant?.domainVerified || !tenant.customDomain) return next();

  if (!hostMatchesTenantCustomDomain(tenant.customDomain, req.headers.host ?? "")) return next();

  const pathSlug = req.params.schoolSlug as string | undefined;
  if (!pathSlug || pathSlug === tenant.slug) return next();

  const rest = req.originalUrl.replace(/^\/s\/[^/]+/, "") || "/dashboard";
  return res.redirect(302, `/s/${tenant.slug}${rest}`);
}
