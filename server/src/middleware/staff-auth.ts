import { Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth";
import { assertStaffTenantMatch } from "../lib/tenant-scope";
import { UnauthorizedError } from "./error";

/**
 * Staff-only guard for /s/:schoolSlug/api/* routes.
 * Rejects requests that only have portal or platform cookies.
 */
export async function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  if (req.cookies?.portal_session_token) {
    return next(new UnauthorizedError("Staff login required — use /s/:schoolSlug/login"));
  }
  if (req.cookies?.platform_session_token && !req.cookies?.session_token) {
    return next(new UnauthorizedError("Staff login required — platform sessions cannot access school APIs"));
  }
  return requireAuth(req, res, (err) => {
    if (err) return next(err);
    try {
      assertStaffTenantMatch(req);
      next();
    } catch (e) {
      next(e);
    }
  });
}
