import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { academicYears, announcements, schoolEvents, terms } from "../db/schema";
import { NotFoundError } from "../middleware/error";
import { promoteScheduledAnnouncements } from "./announcements";

const STUDENT_AUDIENCES = ["all", "students"] as const;

export async function getStudentCalendarOverview(tenantId: string) {
  const [currentYear] = await db.select().from(academicYears).where(and(
    eq(academicYears.tenantId, tenantId),
    eq(academicYears.isCurrent, true),
  )).limit(1);

  const [currentTerm] = await db.select().from(terms).where(and(
    eq(terms.tenantId, tenantId),
    eq(terms.isCurrent, true),
  )).limit(1);

  const years = await db.select().from(academicYears)
    .where(eq(academicYears.tenantId, tenantId))
    .orderBy(desc(academicYears.startDate))
    .limit(5);

  const yearIds = years.map((y) => y.id);
  const termRows = yearIds.length
    ? await db.select().from(terms).where(and(
      eq(terms.tenantId, tenantId),
      inArray(terms.academicYearId, yearIds),
    )).orderBy(asc(terms.startDate))
    : [];

  const termsByYear = new Map<string, typeof termRows>();
  for (const t of termRows) {
    const list = termsByYear.get(t.academicYearId) ?? [];
    list.push(t);
    termsByYear.set(t.academicYearId, list);
  }

  return {
    currentAcademicYear: currentYear ?? null,
    currentTerm: currentTerm ?? null,
    academicYears: years.map((y) => ({
      ...y,
      terms: termsByYear.get(y.id) ?? [],
    })),
  };
}

export async function listStudentSchoolEvents(
  tenantId: string,
  opts?: { filter?: "upcoming" | "past" | "all"; eventType?: string; limit?: number },
) {
  const now = new Date();
  const filter = opts?.filter ?? "upcoming";
  const limit = opts?.limit ?? 60;

  const conds = [
    eq(schoolEvents.tenantId, tenantId),
    eq(schoolEvents.published, true),
    inArray(schoolEvents.audience, [...STUDENT_AUDIENCES]),
  ];
  if (opts?.eventType) conds.push(eq(schoolEvents.eventType, opts.eventType));

  let rows = await db.select().from(schoolEvents).where(and(...conds)).orderBy(
    filter === "past" ? desc(schoolEvents.startsAt) : asc(schoolEvents.startsAt),
  ).limit(limit);

  if (filter === "upcoming") {
    rows = rows.filter((e) => !e.endsAt || e.endsAt >= now);
  } else if (filter === "past") {
    rows = rows.filter((e) => e.endsAt ? e.endsAt < now : e.startsAt < now);
  }

  return rows.map((e) => ({
    ...e,
    isPast: e.endsAt ? e.endsAt < now : e.startsAt < now,
    isOngoing: e.startsAt <= now && (!e.endsAt || e.endsAt >= now),
  }));
}

export async function getStudentSchoolEvent(tenantId: string, eventId: string) {
  const [row] = await db.select().from(schoolEvents).where(and(
    eq(schoolEvents.id, eventId),
    eq(schoolEvents.tenantId, tenantId),
    eq(schoolEvents.published, true),
    inArray(schoolEvents.audience, [...STUDENT_AUDIENCES]),
  )).limit(1);
  if (!row) throw new NotFoundError("Event not found");
  const now = new Date();
  return {
    ...row,
    isPast: row.endsAt ? row.endsAt < now : row.startsAt < now,
    isOngoing: row.startsAt <= now && (!row.endsAt || row.endsAt >= now),
  };
}

export async function listStudentAnnouncements(tenantId: string, opts?: { q?: string; limit?: number }) {
  await promoteScheduledAnnouncements(tenantId);
  const conds = [
    eq(announcements.tenantId, tenantId),
    eq(announcements.published, true),
    inArray(announcements.audience, [...STUDENT_AUDIENCES]),
  ];
  if (opts?.q?.trim()) {
    const term = `%${opts.q.trim()}%`;
    conds.push(or(ilike(announcements.title, term), ilike(announcements.body, term))!);
  }

  const rows = await db.select().from(announcements).where(and(...conds))
    .orderBy(desc(announcements.createdAt))
    .limit(opts?.limit ?? 50);

  return rows;
}

export async function getStudentAnnouncement(tenantId: string, announcementId: string) {
  await promoteScheduledAnnouncements(tenantId);
  const [row] = await db.select().from(announcements).where(and(
    eq(announcements.id, announcementId),
    eq(announcements.tenantId, tenantId),
    eq(announcements.published, true),
    inArray(announcements.audience, [...STUDENT_AUDIENCES]),
  )).limit(1);
  if (!row) throw new NotFoundError("Announcement not found");
  return row;
}
