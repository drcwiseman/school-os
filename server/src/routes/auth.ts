import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { userAuthColumns } from "../lib/user-columns";
import { eq, and } from "drizzle-orm";
import { userRoles, roles } from "../db/schema";
import { hashPassword, verifyPassword, createSession, deleteSession } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { validate } from "../utils/validate";
import { registerSchema, loginSchema } from "./auth.schemas";
import { ConflictError, UnauthorizedError } from "../middleware/error";
import { createAuditLog } from "../services/audit";
import { getUserPermissions } from "../middleware/rbac";
import { getTenantModuleAccess } from "../services/plan-features";
import { exchangeImpersonationToken } from "../services/impersonation";
import { isReadOnlyImpersonation } from "../middleware/auth";

const router = Router();

// POST /s/:schoolSlug/api/auth/register
router.post("/register", validate({ body: registerSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const { email, password, firstName, lastName } = req.body;

    const [existing] = await db.select(userAuthColumns).from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, email))).limit(1);
    if (existing) throw new ConflictError("Email already registered in this school");

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({
      tenantId: tenant.id, email, passwordHash, firstName, lastName,
    }).returning();

    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "user.register", entityType: "user", entityId: user.id, ip: req.ip });

    const session = await createSession(user.id, tenant.id, req.ip, req.headers["user-agent"]);
    res.cookie("session_token", session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (err) { next(err); }
});

// POST /s/:schoolSlug/api/auth/login
router.post("/login", validate({ body: loginSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const { email, password } = req.body;

    const [user] = await db.select(userAuthColumns).from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, email))).limit(1);
    if (!user || user.status !== "active") throw new UnauthorizedError("Invalid credentials");

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");

    const session = await createSession(user.id, tenant.id, req.ip, req.headers["user-agent"]);
    res.cookie("session_token", session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (err) { next(err); }
});

// POST /s/:schoolSlug/api/auth/logout
router.post("/logout", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.session_token;
    if (token) await deleteSession(token);
    res.clearCookie("session_token");
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /s/:schoolSlug/api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { passwordHash, ...safeUser } = user;
    const permissions = await getUserPermissions(user.id, user.tenantId);
    const roleRows = await db
      .select({ id: roles.id, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));
    const modules = await getTenantModuleAccess(user.tenantId);
    const session = (req as any).session;
    res.json({
      success: true,
      user: safeUser,
      permissions,
      roles: roleRows,
      modules,
      impersonation: isReadOnlyImpersonation(session) ? { readOnly: true } : null,
    });
  } catch (err) { next(err); }
});

// GET /s/:schoolSlug/api/auth/impersonate?token= — platform shadow login (one-time)
router.get("/impersonate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const slug = tenant?.slug ?? (req.params.schoolSlug as string);
    const token = String(req.query.token ?? "");
    if (!token) throw new UnauthorizedError("Missing impersonation token");
    if (!tenant?.id) throw new UnauthorizedError("School not found");

    const result = await exchangeImpersonationToken(
      token,
      tenant.id,
      req.ip,
      req.headers["user-agent"],
    );
    if (!result) throw new UnauthorizedError("Invalid or expired impersonation token");

    const { passwordHash, ...safeUser } = result.user;
    const permissions = await getUserPermissions(result.user.id, result.user.tenantId);
    const roleRows = await db
      .select({ id: roles.id, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, result.user.id));
    const modules = await getTenantModuleAccess(result.user.tenantId);

    res.cookie("session_token", result.session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({
      success: true,
      readOnly: result.readOnly,
      redirect: `/s/${slug}/dashboard`,
      user: safeUser,
      permissions,
      roles: roleRows,
      modules,
      impersonation: result.readOnly ? { readOnly: true } : null,
    });
  } catch (err) { next(err); }
});

export default router;
