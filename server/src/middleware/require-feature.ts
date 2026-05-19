import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "./error";
import { getTenant } from "../lib/tenant-scope";
import { isFeatureAllowedForTenant } from "../services/plan-features";

/** Enforce tenant_features + plan tier for a feature code (e.g. messaging_enabled). */
export function requireTenantFeature(featureCode: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tenant = getTenant(req);
      const allowed = await isFeatureAllowedForTenant(tenant.id, featureCode);
      if (!allowed) {
        return next(new ForbiddenError(
          `Feature '${featureCode}' is disabled for this school or not included in the subscription plan`,
        ));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
