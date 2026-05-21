import { db } from "../db";
import {
  students, invoices, payments, expenses, announcements, schoolEvents, portalMessages, auditLogs,
} from "../db/schema";
import { eq, and, isNull, sql, gte, desc, isNotNull, lt } from "drizzle-orm";
import { campusCondition } from "../lib/campus-scope";
import { safeDb } from "../lib/safe-db";

export type DashboardWidgets = {
  genderBreakdown: { male: number; female: number; other: number };
  feesChart: { collectedMinor: number; outstandingMinor: number; collectedByMonth: Array<{ month: string; amountMinor: number }> };
  expensesByMonth: Array<{ month: string; amountMinor: number }>;
  upcomingEvents: Array<{ id: string; title: string; at: string }>;
  recentAnnouncements: Array<{ id: string; title: string; createdAt: string }>;
};

export type HeaderNotificationCounts = {
  unreadMessages: number;
  auditToday: number;
  scheduledAnnouncements: number;
};

export async function buildDashboardWidgets(tenantId: string, campusId?: string): Promise<DashboardWidgets> {
  const studentWhere = [eq(students.tenantId, tenantId), isNull(students.deletedAt)];
  const cStu = campusCondition(students, campusId);
  if (cStu) studentWhere.push(cStu);

  const [gender] = await db
    .select({
      male: sql<number>`count(*) filter (where ${students.gender} = 'male')`,
      female: sql<number>`count(*) filter (where ${students.gender} = 'female')`,
      other: sql<number>`count(*) filter (where ${students.gender} = 'other' or ${students.gender} is null)`,
    })
    .from(students)
    .where(and(...studentWhere));

  const [collected] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), isNull(payments.deletedAt)));

  const [outstanding] = await db
    .select({ total: sql<number>`coalesce(sum(${invoices.totalAmount} - ${invoices.paidAmount}), 0)` })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt), sql`${invoices.paidAmount} < ${invoices.totalAmount}`));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const collectedByMonth = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'Mon YY')`,
      amountMinor: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), isNull(payments.deletedAt), gte(payments.paidAt, sixMonthsAgo)))
    .groupBy(sql`date_trunc('month', ${payments.paidAt})`)
    .orderBy(sql`date_trunc('month', ${payments.paidAt})`);

  const expensesByMonth = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${expenses.spentAt}), 'Mon YY')`,
      amountMinor: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(and(eq(expenses.tenantId, tenantId), gte(expenses.spentAt, sixMonthsAgo)))
    .groupBy(sql`date_trunc('month', ${expenses.spentAt})`)
    .orderBy(sql`date_trunc('month', ${expenses.spentAt})`);

  const now = new Date();
  const inThirtyDays = new Date(now);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  const upcomingSchool = await safeDb("widgets-school-events", [] as { id: string; title: string; at: Date }[], async () =>
    db.select({ id: schoolEvents.id, title: schoolEvents.title, at: schoolEvents.startsAt })
      .from(schoolEvents)
      .where(and(
        eq(schoolEvents.tenantId, tenantId),
        eq(schoolEvents.published, true),
        gte(schoolEvents.startsAt, now),
        lt(schoolEvents.startsAt, inThirtyDays),
      ))
      .orderBy(schoolEvents.startsAt)
      .limit(8),
  );

  const upcomingAnnouncements = await db
    .select({ id: announcements.id, title: announcements.title, at: announcements.publishAt })
    .from(announcements)
    .where(and(
      eq(announcements.tenantId, tenantId),
      isNotNull(announcements.publishAt),
      gte(announcements.publishAt, now),
      lt(announcements.publishAt, inThirtyDays),
    ))
    .orderBy(announcements.publishAt)
    .limit(8);

  const upcoming = [
    ...upcomingSchool.map((e) => ({ id: e.id, title: e.title, at: e.at })),
    ...upcomingAnnouncements.filter((e) => e.at).map((e) => ({ id: e.id, title: e.title, at: e.at! })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 8);

  const recent = await db
    .select({ id: announcements.id, title: announcements.title, createdAt: announcements.createdAt })
    .from(announcements)
    .where(and(eq(announcements.tenantId, tenantId), eq(announcements.published, true)))
    .orderBy(desc(announcements.createdAt))
    .limit(6);

  return {
    genderBreakdown: {
      male: Number(gender?.male ?? 0),
      female: Number(gender?.female ?? 0),
      other: Number(gender?.other ?? 0),
    },
    feesChart: {
      collectedMinor: Number(collected?.total ?? 0),
      outstandingMinor: Number(outstanding?.total ?? 0),
      collectedByMonth: collectedByMonth.map((r) => ({ month: r.month, amountMinor: Number(r.amountMinor) })),
    },
    expensesByMonth: expensesByMonth.map((r) => ({ month: r.month, amountMinor: Number(r.amountMinor) })),
    upcomingEvents: upcoming
      .filter((e) => e.at)
      .map((e) => ({ id: e.id, title: e.title, at: e.at!.toISOString() })),
    recentAnnouncements: recent.map((a) => ({
      id: a.id,
      title: a.title,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

const emptyNotifications: HeaderNotificationCounts = {
  unreadMessages: 0, auditToday: 0, scheduledAnnouncements: 0,
};

export async function getHeaderNotificationCounts(tenantId: string): Promise<HeaderNotificationCounts> {
  return safeDb("notifications", emptyNotifications, () => getHeaderNotificationCountsInner(tenantId));
}

async function getHeaderNotificationCountsInner(tenantId: string): Promise<HeaderNotificationCounts> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [msgs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(portalMessages)
    .where(and(
      eq(portalMessages.tenantId, tenantId),
      eq(portalMessages.senderType, "parent"),
      isNull(portalMessages.readAt),
    ));

  const [audit] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(eq(auditLogs.tenantId, tenantId), gte(auditLogs.createdAt, startOfDay)));

  const [ann] = await db
    .select({ count: sql<number>`count(*)` })
    .from(announcements)
    .where(and(
      eq(announcements.tenantId, tenantId),
      eq(announcements.published, false),
      isNotNull(announcements.publishAt),
    ));

  return {
    unreadMessages: Number(msgs?.count ?? 0),
    auditToday: Number(audit?.count ?? 0),
    scheduledAnnouncements: Number(ann?.count ?? 0),
  };
}
