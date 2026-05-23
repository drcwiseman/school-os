import { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, userRoles, roles } from "../db/schema";
import { userAuthColumns } from "../lib/user-columns";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../middleware/error";
import { validate } from "../utils/validate";
import { getUserPermissions } from "../middleware/rbac";
import { getTenantModuleAccess } from "../services/plan-features";
import { resolveTenantLocale } from "../services/tenant-locale";
import { tenantSettings } from "../db/schema";
import {
  getPlatformImpersonationContext,
  impersonationSessionPayload,
  switchPlatformImpersonation,
} from "../services/impersonation";

async function localeForTenant(tenantId: string) {
  const [row] = await db
    .select({ country: tenantSettings.country, currency: tenantSettings.currency })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  return resolveTenantLocale(row);
}

const switchBodySchema = z.object({
  userId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  roleName: z.string().min(1).optional(),
  provisionStaffLogin: z.boolean().optional(),
});

export const impersonateSwitchHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const tenant = (req as any).tenant;
    const session = (req as any).session;
    const token = req.cookies?.session_token as string | undefined;
    if (!tenant?.id || !token) throw new UnauthorizedError("Not signed in");

    const ctx = getPlatformImpersonationContext(session);
    if (!ctx) {
      throw new UnauthorizedError(
        "Only available during platform impersonation — open the school from Platform → Schools, then try Login as again",
      );
    }
    if (!req.body?.userId && !req.body?.staffId) {
      throw new BadRequestError("userId or staffId is required");
    }

    const result = await switchPlatformImpersonation({
      tenantId: tenant.id,
      slug: tenant.slug,
      currentSessionToken: token,
      platformAdminId: ctx.platformAdminId,
      readOnly: ctx.readOnly,
      target: {
        userId: req.body.userId,
        staffId: req.body.staffId,
        roleName: req.body.roleName,
        provisionStaffLogin: req.body.provisionStaffLogin === true,
      },
      ip: req.ip,
      ua: req.headers["user-agent"],
    });

    const [dbUser] = await db
      .select(userAuthColumns)
      .from(users)
      .where(and(eq(users.id, result.user.id), eq(users.tenantId, tenant.id)))
      .limit(1);
    if (!dbUser) throw new NotFoundError("User not found");
    const { passwordHash, ...safeUser } = dbUser;
    const permissions = await getUserPermissions(dbUser.id, dbUser.tenantId);
    const roleRows = await db
      .select({ id: roles.id, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, dbUser.id));
    const modules = await getTenantModuleAccess(dbUser.tenantId);
    const locale = await localeForTenant(dbUser.tenantId);

    res.cookie("session_token", result.session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      success: true,
      redirect: result.redirect,
      user: safeUser,
      permissions,
      roles: roleRows,
      modules,
      country: locale.country,
      currency: locale.currency,
      impersonation: {
        ...impersonationSessionPayload(ctx.readOnly),
        canSwitchUser: true,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** POST …/api/auth/impersonate-switch (and legacy …/impersonate/switch) */
export const impersonateSwitchRoute: RequestHandler[] = [
  requireAuth,
  validate({ body: switchBodySchema }),
  impersonateSwitchHandler,
];
