import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { schoolTickets, staff, users } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth, requireTenantMatch);

async function nextTicketNumber(tenantId: string) {
  const [cnt] = await db.select({ n: sql<number>`count(*)` }).from(schoolTickets).where(eq(schoolTickets.tenantId, tenantId));
  return `TKT-${String(Number(cnt?.n ?? 0) + 1).padStart(5, "0")}`;
}

ticketsRouter.get("/dashboard", requirePermission("ticket.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [stats] = await db.select({
      open: sql<number>`count(*) filter (where ${schoolTickets.status} in ('open', 'in_progress'))`,
      resolved: sql<number>`count(*) filter (where ${schoolTickets.status} = 'resolved')`,
      high: sql<number>`count(*) filter (where ${schoolTickets.priority} = 'high' and ${schoolTickets.status} != 'closed')`,
    }).from(schoolTickets).where(eq(schoolTickets.tenantId, tenant.id));
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
});

ticketsRouter.get("/", requirePermission("ticket.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const status = req.query.status as string | undefined;
    const conds = [eq(schoolTickets.tenantId, tenant.id)];
    if (status) conds.push(eq(schoolTickets.status, status));
    const rows = await db.select({
      ticket: schoolTickets,
      assignee: { firstName: staff.firstName, lastName: staff.lastName, employeeNo: staff.employeeNo },
      reporter: { firstName: users.firstName, lastName: users.lastName },
    }).from(schoolTickets)
      .leftJoin(staff, eq(schoolTickets.assignedToStaffId, staff.id))
      .leftJoin(users, eq(schoolTickets.reportedBy, users.id))
      .where(and(...conds))
      .orderBy(desc(schoolTickets.createdAt))
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

ticketsRouter.post("/", requirePermission("ticket.manage"),
  validate({
    body: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["maintenance", "it", "facilities", "transport", "other"]).default("maintenance"),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      assignedToStaffId: z.string().uuid().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const ticketNumber = await nextTicketNumber(tenant.id);
      const [row] = await db.insert(schoolTickets).values({
        tenantId: tenant.id,
        ticketNumber,
        title: req.body.title,
        description: req.body.description ?? null,
        category: req.body.category,
        priority: req.body.priority,
        reportedBy: user.id,
        assignedToStaffId: req.body.assignedToStaffId ?? null,
        status: req.body.assignedToStaffId ? "in_progress" : "open",
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

ticketsRouter.patch("/:id", requirePermission("ticket.manage"),
  validate({
    body: z.object({
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      assignedToStaffId: z.string().uuid().nullable().optional(),
      resolutionNotes: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
      if (patch.status === "resolved" || patch.status === "closed") {
        patch.resolvedAt = new Date();
      }
      const [row] = await db.update(schoolTickets).set(patch).where(and(
        eq(schoolTickets.id, req.params.id),
        eq(schoolTickets.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Ticket not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default ticketsRouter;
