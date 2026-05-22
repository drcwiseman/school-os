import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { NotFoundError, ForbiddenError } from "./error";
import { hostMatchesTenantCustomDomain } from "../lib/custom-domain-host";
import { resolveTenantByHost, resolveTenantBySlug } from "../services/tenant-resolve";

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  try {
    let slug = req.params.schoolSlug as string | undefined;
    const host = req.headers.host ?? "";

    if ((req as any).tenant?.slug) {
      req.params.schoolSlug = (req as any).tenant.slug;
      return next();
    }

    const fromHost = await resolveTenantByHost(host);
    if (fromHost) {
      const onCustom = Boolean(
        fromHost.domainVerified && hostMatchesTenantCustomDomain(fromHost.customDomain, host),
      );
      if (process.env.USE_SUBDOMAIN === "true" || onCustom) {
        (req as any).tenant = fromHost;
        req.params.schoolSlug = fromHost.slug;
        slug = fromHost.slug;
      }
    }

    if (!slug) return next(new NotFoundError("School slug is required"));

    const tenant = await resolveTenantBySlug(slug);
    if (!tenant) return next(new NotFoundError(`School '${slug}' not found`));
    if (tenant.status === "suspended") return next(new ForbiddenError("This school account is suspended"));

    const path = req.path || "";
    if (!path.includes("/impersonate") && !path.includes("/login")) {
      const { getPlatformGeneralSettings } = await import("../services/platform-general-settings");
      const general = await getPlatformGeneralSettings();
      if (general.maintenanceMode) {
        return next(
          new ForbiddenError(general.maintenanceMessage || "Platform is under maintenance. Please try again later."),
        );
      }
    }

    (req as any).tenant = tenant;
    req.params.schoolSlug = tenant.slug;
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
