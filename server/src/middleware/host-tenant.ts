import { Request, Response, NextFunction } from "express";
import { hostMatchesTenantCustomDomain } from "../lib/custom-domain-host";
import { resolveTenantByHost, isPlatformHost, normalizeHost } from "../services/tenant-resolve";

/** SPA paths served on verified custom domains without redirecting to /s/:slug (clean browser URL). */
export const CUSTOM_DOMAIN_CLEAN_PATHS = new Set([
  "/",
  "/login",
  "/dashboard",
  "/portal/login",
  "/portal/dashboard",
  "/apply",
  "/impersonate",
]);

function isApiPath(url: string) {
  return url.startsWith("/api") || /^\/s\/[^/]+\/api(\/|$)/.test(url);
}

/**
 * When USE_SUBDOMAIN=true or request hits a verified school custom domain,
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
    const onVerifiedCustom = Boolean(
      tenant.domainVerified && hostMatchesTenantCustomDomain(tenant.customDomain, host),
    );

    if (useSubdomain || onVerifiedCustom) {
      req.params.schoolSlug = tenant.slug;
      (req as any).tenant = tenant;
      (req as any).customDomainHost = onVerifiedCustom;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * SPA: on verified custom domain, keep clean URLs (/login, /portal/login).
 * Otherwise redirect bare paths to /s/:slug/...
 */
export function redirectSchoolHostToSlugPath(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).resolvedTenantFromHost as {
    slug: string;
    customDomain?: string | null;
    domainVerified?: boolean;
  } | undefined;
  if (!tenant) return next();

  if (isApiPath(req.path) || req.path.startsWith("/s/") || req.path.startsWith("/platform")) {
    return next();
  }

  const onVerifiedCustom = Boolean(
    tenant.domainVerified && hostMatchesTenantCustomDomain(tenant.customDomain, req.headers.host ?? ""),
  );

  if (onVerifiedCustom) {
    if (req.path === "/") {
      return res.redirect(302, "/dashboard");
    }
    if (CUSTOM_DOMAIN_CLEAN_PATHS.has(req.path)) {
      return next();
    }
  }

  const target = `/s/${tenant.slug}${req.path === "/" ? "/dashboard" : req.path}`;
  return res.redirect(302, target);
}

export function isVerifiedCustomDomainHost(req: Request): boolean {
  const tenant = (req as any).resolvedTenantFromHost as {
    customDomain?: string | null;
    domainVerified?: boolean;
  } | undefined;
  if (!tenant?.domainVerified || !tenant.customDomain) return false;
  return hostMatchesTenantCustomDomain(tenant.customDomain, req.headers.host ?? "");
}
