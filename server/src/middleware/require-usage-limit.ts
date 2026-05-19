import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "./error";
import { getTenant } from "../lib/tenant-scope";
import { getTenantUsageLimit } from "../services/billing-usage";

/** Enforce that a school tenant remains within their plan limits for a metered metric. */
export function requireUsageLimit(metric: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tenant = getTenant(req);
      const { used, limit, exceeded } = await getTenantUsageLimit(tenant.id, metric);
      
      if (exceeded) {
        return next(
          new ForbiddenError(
            `Usage limit exceeded for metric '${metric}' (${used}/${limit}). Please upgrade your SchoolOS subscription tier.`
          )
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
