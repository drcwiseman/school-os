import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { roles, permissions, rolePermissions, userRoles, users, auditLogs } from "../db/schema";
import { eq, and, ilike, desc, isNull } from "drizzle-orm";
import { softDeleteStaffUser } from "../services/soft-delete";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { createAuditLog } from "../services/audit";
import { NotFoundError, ConflictError } from "../middleware/error";
import { paginationSchema, paginate, paginatedResponse } from "../utils/pagination";
import { z } from "zod";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

// ── Roles ────────────────────────────────────────────────────────────────────

router.get("/roles", ...guard, requirePermission("rbac.manage.roles"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const allRoles = await db.select().from(roles).where(eq(roles.tenantId, tenant.id));
    res.json({ success: true, data: allRoles });
  } catch (err) { next(err); }
});

router.post("/roles", ...guard, requirePermission("rbac.manage.roles"),
  validate({ body: z.object({ name: z.string().min(1) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user   = (req as any).user;
      const [existing] = await db.select().from(roles).where(and(eq(roles.tenantId, tenant.id), eq(roles.name, req.body.name))).limit(1);
      if (existing) throw new ConflictError("Role with this name already exists");
      const [role] = await db.insert(roles).values({ tenantId: tenant.id, name: req.body.name }).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "role.create", entityType: "role", entityId: role.id, after: role, ip: req.ip });
      res.status(201).json({ success: true, data: role });
    } catch (err) { next(err); }
  }
);

router.post("/roles/:roleId/permissions", ...guard, requirePermission("rbac.manage.permissions"),
  validate({ body: z.object({ permissionIds: z.array(z.string().uuid()) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user   = (req as any).user;
      const [role] = await db.select().from(roles).where(and(eq(roles.id, req.params.roleId), eq(roles.tenantId, tenant.id))).limit(1);
      if (!role) throw new NotFoundError("Role not found");
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      if (req.body.permissionIds.length > 0) {
        await db.insert(rolePermissions).values(req.body.permissionIds.map((pid: string) => ({ roleId: role.id, permissionId: pid })));
      }
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "role.permissions.update", entityType: "role", entityId: role.id, after: { permissionIds: req.body.permissionIds }, ip: req.ip });
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// ── Permissions list ──────────────────────────────────────────────────────────

router.get("/permissions", ...guard, requirePermission("rbac.manage.roles"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allPerms = await db.select().from(permissions);
    res.json({ success: true, data: allPerms });
  } catch (err) { next(err); }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/users", ...guard, requirePermission("settings.users.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const q      = await paginationSchema.parseAsync(req.query);
    const { limit, offset } = paginate(q.page, q.limit);
    const rows = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, status: users.status, createdAt: users.createdAt })
      .from(users).where(and(eq(users.tenantId, tenant.id), isNull(users.deletedAt))).limit(limit).offset(offset);
    res.json(paginatedResponse(rows, rows.length, q.page, q.limit));
  } catch (err) { next(err); }
});

router.post("/users/:userId/roles", ...guard, requirePermission("rbac.manage.roles"),
  validate({ body: z.object({ roleIds: z.array(z.string().uuid()) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant  = (req as any).tenant;
      const actor   = (req as any).user;
      const [target] = await db.select().from(users).where(and(eq(users.id, req.params.userId), eq(users.tenantId, tenant.id))).limit(1);
      if (!target) throw new NotFoundError("User not found");
      await db.delete(userRoles).where(and(eq(userRoles.userId, target.id), eq(userRoles.tenantId, tenant.id)));
      if (req.body.roleIds.length > 0) {
        await db.insert(userRoles).values(req.body.roleIds.map((rid: string) => ({ userId: target.id, roleId: rid, tenantId: tenant.id })));
      }
      await createAuditLog({ tenantId: tenant.id, actorUserId: actor.id, action: "user.roles.update", entityType: "user", entityId: target.id, after: { roleIds: req.body.roleIds }, ip: req.ip });
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

router.patch("/users/:userId/status", ...guard, requirePermission("settings.users.manage"),
  validate({ body: z.object({ status: z.enum(["active", "suspended", "disabled", "inactive"]) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const actor = (req as any).user;
      if (actor.id === req.params.userId && req.body.status !== "active") {
        throw new ConflictError("Cannot suspend or disable your own account");
      }
      const [before] = await db.select().from(users).where(and(eq(users.id, req.params.userId), eq(users.tenantId, tenant.id), isNull(users.deletedAt))).limit(1);
      if (!before) throw new NotFoundError("User not found");
      const [updated] = await db.update(users).set({ status: req.body.status, updatedAt: new Date() }).where(eq(users.id, before.id)).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: actor.id, action: "user.status.update", entityType: "user", entityId: before.id, before, after: updated, ip: req.ip });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },
);

router.delete("/users/:userId", ...guard, requirePermission("settings.users.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const actor = (req as any).user;
      if (actor.id === req.params.userId) throw new ConflictError("Cannot delete your own account");
      const [before] = await db.select().from(users).where(and(eq(users.id, req.params.userId), eq(users.tenantId, tenant.id), isNull(users.deletedAt))).limit(1);
      if (!before) throw new NotFoundError("User not found");
      const updated = await softDeleteStaffUser(tenant.id, req.params.userId, actor.id);
      await createAuditLog({ tenantId: tenant.id, actorUserId: actor.id, action: "user.soft_delete", entityType: "user", entityId: before.id, before, after: updated, ip: req.ip });
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

// ── Audit log viewer ──────────────────────────────────────────────────────────

router.get("/audit-logs", ...guard, requirePermission("audit.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const q      = await paginationSchema.parseAsync(req.query);
    const { limit, offset } = paginate(q.page, q.limit);
    const actionFilter = typeof req.query.action === "string" && req.query.action.trim()
      ? ilike(auditLogs.action, `%${req.query.action.trim()}%`)
      : undefined;
    const whereClause = actionFilter
      ? and(eq(auditLogs.tenantId, tenant.id), actionFilter)
      : eq(auditLogs.tenantId, tenant.id);
    const rows = await db
      .select({
        id: auditLogs.id,
        tenantId: auditLogs.tenantId,
        actorUserId: auditLogs.actorUserId,
        actorEmail: users.email,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        beforeJson: auditLogs.beforeJson,
        afterJson: auditLogs.afterJson,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(paginatedResponse(rows, rows.length, q.page, q.limit));
  } catch (err) { next(err); }
});

export default router;
