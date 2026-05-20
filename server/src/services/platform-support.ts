import { db } from "../db";
import {
  platformSupportTickets,
  platformSupportTicketMessages,
  tenants,
  platformAdmins,
} from "../db/schema";
import { desc, eq, and, ilike, or, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NotFoundError, BadRequestError } from "../middleware/error";

export const TICKET_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TICKET_CATEGORIES = ["general", "billing", "technical", "onboarding", "access"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type SupportTicketRow = {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  createdByAdminId: string | null;
  createdByAdminName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type SupportTicketMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  authorName: string | null;
  createdAt: string;
};

export type PlatformSupportHub = {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    closed: number;
    urgent: number;
    unassigned: number;
  };
  schools: { id: string; slug: string; name: string }[];
  assignees: { id: string; name: string; email: string; role: string }[];
  tickets: SupportTicketRow[];
};

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function assertStatus(v: string): TicketStatus {
  if (!(TICKET_STATUSES as readonly string[]).includes(v)) {
    throw new BadRequestError(`Invalid status: ${v}`);
  }
  return v as TicketStatus;
}

function assertPriority(v: string): TicketPriority {
  if (!(TICKET_PRIORITIES as readonly string[]).includes(v)) {
    throw new BadRequestError(`Invalid priority: ${v}`);
  }
  return v as TicketPriority;
}

function assertCategory(v: string): TicketCategory {
  if (!(TICKET_CATEGORIES as readonly string[]).includes(v)) {
    throw new BadRequestError(`Invalid category: ${v}`);
  }
  return v as TicketCategory;
}

async function messageCounts(ticketIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ticketIds.length === 0) return map;
  const rows = await db
    .select({
      ticketId: platformSupportTicketMessages.ticketId,
      count: sql<number>`count(*)::int`,
    })
    .from(platformSupportTicketMessages)
    .where(inArray(platformSupportTicketMessages.ticketId, ticketIds))
    .groupBy(platformSupportTicketMessages.ticketId);
  for (const r of rows) map.set(r.ticketId, Number(r.count));
  return map;
}

function mapTicketRow(
  r: {
    id: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    tenantId: string | null;
    tenantSlug: string | null;
    tenantName: string | null;
    requesterName: string | null;
    requesterEmail: string | null;
    assignedAdminId: string | null;
    assignedAdminName: string | null;
    createdByAdminId: string | null;
    createdByAdminName: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  },
  messageCount: number,
): SupportTicketRow {
  return {
    id: r.id,
    subject: r.subject,
    description: r.description,
    status: r.status as TicketStatus,
    priority: r.priority as TicketPriority,
    category: r.category as TicketCategory,
    tenantId: r.tenantId,
    tenantSlug: r.tenantSlug,
    tenantName: r.tenantName,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    assignedAdminId: r.assignedAdminId,
    assignedAdminName: r.assignedAdminName,
    createdByAdminId: r.createdByAdminId,
    createdByAdminName: r.createdByAdminName,
    messageCount,
    createdAt: toIso(r.createdAt)!,
    updatedAt: toIso(r.updatedAt)!,
    resolvedAt: toIso(r.resolvedAt),
  };
}

async function fetchTicketRows(opts: {
  status?: string;
  priority?: string;
  tenantId?: string;
  assignedAdminId?: string;
  search?: string;
  limit?: number;
}) {
  const conditions = [];
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(platformSupportTickets.status, opts.status));
  }
  if (opts.priority && opts.priority !== "all") {
    conditions.push(eq(platformSupportTickets.priority, opts.priority));
  }
  if (opts.tenantId) conditions.push(eq(platformSupportTickets.tenantId, opts.tenantId));
  if (opts.assignedAdminId === "unassigned") {
    conditions.push(sql`${platformSupportTickets.assignedAdminId} IS NULL`);
  } else if (opts.assignedAdminId && opts.assignedAdminId !== "all") {
    conditions.push(eq(platformSupportTickets.assignedAdminId, opts.assignedAdminId));
  }
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    conditions.push(or(
      ilike(platformSupportTickets.subject, q),
      ilike(platformSupportTickets.description, q),
      ilike(platformSupportTickets.requesterEmail, q),
      ilike(platformSupportTickets.requesterName, q),
    )!);
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const limit = Math.min(opts.limit ?? 300, 500);

  const assignee = alias(platformAdmins, "assignee");
  const creator = alias(platformAdmins, "creator");

  const rows = await db
    .select({
      id: platformSupportTickets.id,
      subject: platformSupportTickets.subject,
      description: platformSupportTickets.description,
      status: platformSupportTickets.status,
      priority: platformSupportTickets.priority,
      category: platformSupportTickets.category,
      tenantId: platformSupportTickets.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      requesterName: platformSupportTickets.requesterName,
      requesterEmail: platformSupportTickets.requesterEmail,
      assignedAdminId: platformSupportTickets.assignedAdminId,
      assignedAdminName: assignee.name,
      createdByAdminId: platformSupportTickets.createdByAdminId,
      createdByAdminName: creator.name,
      createdAt: platformSupportTickets.createdAt,
      updatedAt: platformSupportTickets.updatedAt,
      resolvedAt: platformSupportTickets.resolvedAt,
    })
    .from(platformSupportTickets)
    .leftJoin(tenants, eq(platformSupportTickets.tenantId, tenants.id))
    .leftJoin(assignee, eq(platformSupportTickets.assignedAdminId, assignee.id))
    .leftJoin(creator, eq(platformSupportTickets.createdByAdminId, creator.id))
    .where(where)
    .orderBy(desc(platformSupportTickets.updatedAt))
    .limit(limit);

  return rows;
}

export async function getPlatformSupportHub(opts: {
  status?: string;
  priority?: string;
  tenantId?: string;
  assignedAdminId?: string;
  search?: string;
}): Promise<PlatformSupportHub> {
  const [rawTickets, schools, assignees] = await Promise.all([
    fetchTicketRows(opts),
    db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name }).from(tenants).orderBy(tenants.name),
    db.select({
      id: platformAdmins.id,
      name: platformAdmins.name,
      email: platformAdmins.email,
      role: platformAdmins.role,
    }).from(platformAdmins).orderBy(platformAdmins.name),
  ]);

  const counts = await messageCounts(rawTickets.map((t) => t.id));
  const tickets = rawTickets.map((r) => mapTicketRow(r, counts.get(r.id) ?? 0));

  let open = 0;
  let inProgress = 0;
  let waiting = 0;
  let resolved = 0;
  let closed = 0;
  let urgent = 0;
  let unassigned = 0;

  for (const t of tickets) {
    if (t.status === "open") open += 1;
    else if (t.status === "in_progress") inProgress += 1;
    else if (t.status === "waiting") waiting += 1;
    else if (t.status === "resolved") resolved += 1;
    else if (t.status === "closed") closed += 1;
    if (t.priority === "urgent") urgent += 1;
    if (!t.assignedAdminId) unassigned += 1;
  }

  return {
    summary: {
      total: tickets.length,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      urgent,
      unassigned,
    },
    schools,
    assignees,
    tickets,
  };
}

export async function createPlatformSupportTicket(
  adminId: string,
  body: {
    tenantId?: string | null;
    subject: string;
    description: string;
    priority?: string;
    category?: string;
    requesterName?: string;
    requesterEmail?: string;
    assignedAdminId?: string | null;
  },
) {
  const priority = body.priority ? assertPriority(body.priority) : "normal";
  const category = body.category ? assertCategory(body.category) : "general";

  if (body.tenantId) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, body.tenantId)).limit(1);
    if (!tenant) throw new NotFoundError("School not found");
  }

  const [ticket] = await db.insert(platformSupportTickets).values({
    tenantId: body.tenantId ?? undefined,
    subject: body.subject.trim(),
    description: body.description.trim(),
    priority,
    category,
    requesterName: body.requesterName?.trim() || undefined,
    requesterEmail: body.requesterEmail?.trim() || undefined,
    assignedAdminId: body.assignedAdminId ?? adminId,
    createdByAdminId: adminId,
    status: "open",
  }).returning();

  return getPlatformSupportTicketDetail(ticket.id);
}

export async function updatePlatformSupportTicket(
  ticketId: string,
  patch: {
    status?: string;
    priority?: string;
    category?: string;
    assignedAdminId?: string | null;
  },
) {
  const [existing] = await db.select().from(platformSupportTickets)
    .where(eq(platformSupportTickets.id, ticketId)).limit(1);
  if (!existing) throw new NotFoundError("Ticket not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status != null) {
    const status = assertStatus(patch.status);
    updates.status = status;
    if (status === "resolved" || status === "closed") {
      updates.resolvedAt = existing.resolvedAt ?? new Date();
    } else {
      updates.resolvedAt = null;
    }
  }
  if (patch.priority != null) updates.priority = assertPriority(patch.priority);
  if (patch.category != null) updates.category = assertCategory(patch.category);
  if (patch.assignedAdminId !== undefined) {
    updates.assignedAdminId = patch.assignedAdminId;
  }

  await db.update(platformSupportTickets).set(updates).where(eq(platformSupportTickets.id, ticketId));
  return getPlatformSupportTicketDetail(ticketId);
}

export async function addPlatformSupportTicketMessage(
  ticketId: string,
  adminId: string,
  body: { message: string; isInternal?: boolean },
) {
  const [ticket] = await db.select().from(platformSupportTickets)
    .where(eq(platformSupportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new NotFoundError("Ticket not found");
  const text = body.message.trim();
  if (!text) throw new BadRequestError("Message cannot be empty");

  await db.insert(platformSupportTicketMessages).values({
    ticketId,
    platformAdminId: adminId,
    body: text,
    isInternal: body.isInternal ?? false,
  });

  const nextStatus = ticket.status === "open" ? "in_progress" : ticket.status;
  await db.update(platformSupportTickets)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(platformSupportTickets.id, ticketId));

  return getPlatformSupportTicketDetail(ticketId);
}

export async function getPlatformSupportTicketDetail(ticketId: string) {
  const assignee = alias(platformAdmins, "assignee");
  const creator = alias(platformAdmins, "creator");

  const [row] = await db
    .select({
      id: platformSupportTickets.id,
      subject: platformSupportTickets.subject,
      description: platformSupportTickets.description,
      status: platformSupportTickets.status,
      priority: platformSupportTickets.priority,
      category: platformSupportTickets.category,
      tenantId: platformSupportTickets.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      requesterName: platformSupportTickets.requesterName,
      requesterEmail: platformSupportTickets.requesterEmail,
      assignedAdminId: platformSupportTickets.assignedAdminId,
      assignedAdminName: assignee.name,
      createdByAdminId: platformSupportTickets.createdByAdminId,
      createdByAdminName: creator.name,
      createdAt: platformSupportTickets.createdAt,
      updatedAt: platformSupportTickets.updatedAt,
      resolvedAt: platformSupportTickets.resolvedAt,
    })
    .from(platformSupportTickets)
    .leftJoin(tenants, eq(platformSupportTickets.tenantId, tenants.id))
    .leftJoin(assignee, eq(platformSupportTickets.assignedAdminId, assignee.id))
    .leftJoin(creator, eq(platformSupportTickets.createdByAdminId, creator.id))
    .where(eq(platformSupportTickets.id, ticketId))
    .limit(1);

  if (!row) throw new NotFoundError("Ticket not found");

  const messages = await db
    .select({
      id: platformSupportTicketMessages.id,
      body: platformSupportTicketMessages.body,
      isInternal: platformSupportTicketMessages.isInternal,
      authorName: platformAdmins.name,
      createdAt: platformSupportTicketMessages.createdAt,
    })
    .from(platformSupportTicketMessages)
    .leftJoin(platformAdmins, eq(platformSupportTicketMessages.platformAdminId, platformAdmins.id))
    .where(eq(platformSupportTicketMessages.ticketId, ticketId))
    .orderBy(platformSupportTicketMessages.createdAt);

  const ticket = mapTicketRow(row, messages.length);

  return {
    ticket,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      isInternal: m.isInternal,
      authorName: m.authorName,
      createdAt: toIso(m.createdAt)!,
    })) satisfies SupportTicketMessage[],
  };
}
