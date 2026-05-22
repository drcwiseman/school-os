import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  academicYears,
  announcements,
  attendanceRecords,
  attendanceSessions,
  feeHeads,
  feeStructureItems,
  feeStructures,
  guardians,
  invoices,
  parentAccounts,
  portalMessages,
  reportCards,
  schoolEvents,
  studentGuardians,
  studentClassHistory,
  classes,
  streams,
  students,
  terms,
} from "../db/schema";
import type { PortalPrincipal } from "../middleware/portal-auth";
import { getPortalAccessibleStudentIds } from "./portal-access";

export type PortalNotification = {
  id: string;
  type: "announcement" | "message" | "fee" | "results" | "leave" | "event" | "calendar";
  title: string;
  body: string;
  createdAt: string;
  linkTab?: string;
  studentId?: string;
  read?: boolean;
};

type FeeTermRow = {
  termId: string | null;
  termName: string;
  totalMinor: number;
  paidMinor: number;
  remainingMinor: number;
  invoiceCount: number;
};

export type ClassAttendanceRow = {
  id: string;
  date: string;
  status: string;
  className: string;
  streamName: string | null;
  note: string | null;
  inCurrentTerm: boolean;
};

export type SchoolTermFeeSchedule = {
  termId: string;
  termName: string;
  isCurrent: boolean;
  structureId: string;
  structureName: string;
  className: string | null;
  items: { feeHeadName: string; amountMinor: number }[];
  totalMinor: number;
};

function feeStructureMatchScore(
  fs: { termId: string | null; classId: string | null },
  termId: string,
  classId: string | null,
): number {
  if (fs.termId != null && fs.termId !== termId) return -1;
  if (fs.classId != null && fs.classId !== classId) return -1;
  let score = 0;
  if (fs.termId === termId) score += 4;
  else if (fs.termId == null) score += 1;
  if (fs.classId === classId) score += 4;
  else if (fs.classId == null) score += 1;
  return score;
}

function eventCategory(eventType: string, title: string): "games" | "trip" | "academic" | "cultural" | "other" {
  const t = eventType.toLowerCase();
  const titleL = title.toLowerCase();
  if (t === "sports" || titleL.includes("game") || titleL.includes("sports") || titleL.includes("vd ")) return "games";
  if (titleL.includes("trip") || titleL.includes("excursion") || titleL.includes("tour") || t === "extracurricular" || t === "co_curricular") return "trip";
  if (t === "cultural" || t === "club") return "cultural";
  if (t === "academic") return "academic";
  return "other";
}

export async function buildParentPortalExtras(
  tenantId: string,
  studentIds: string[],
  principal: PortalPrincipal,
) {
  const [currentTerm] = await db.select().from(terms).where(and(
    eq(terms.tenantId, tenantId),
    eq(terms.isCurrent, true),
  )).limit(1);

  let currentAcademicYear: { id: string; name: string } | null = null;
  if (currentTerm) {
    const [ay] = await db.select({ id: academicYears.id, name: academicYears.name })
      .from(academicYears)
      .where(eq(academicYears.id, currentTerm.academicYearId))
      .limit(1);
    currentAcademicYear = ay ?? null;
  }

  const allTerms = await db.select({
    id: terms.id,
    name: terms.name,
    isCurrent: terms.isCurrent,
    startDate: terms.startDate,
    endDate: terms.endDate,
  }).from(terms).where(eq(terms.tenantId, tenantId)).orderBy(desc(terms.startDate));

  const termNameById = Object.fromEntries(allTerms.map((t) => [t.id, t.name]));

  function aggregateFees(invs: { termId: string | null; totalAmount: number; paidAmount: number }[]): FeeTermRow[] {
    const byTerm = new Map<string | null, { total: number; paid: number; count: number }>();
    for (const inv of invs) {
      const key = inv.termId ?? null;
      const cur = byTerm.get(key) ?? { total: 0, paid: 0, count: 0 };
      cur.total += inv.totalAmount;
      cur.paid += inv.paidAmount;
      cur.count += 1;
      byTerm.set(key, cur);
    }
    const rows: FeeTermRow[] = [];
    for (const [termId, agg] of byTerm) {
      rows.push({
        termId,
        termName: termId ? (termNameById[termId] ?? "Term") : "General / other",
        totalMinor: agg.total,
        paidMinor: agg.paid,
        remainingMinor: Math.max(0, agg.total - agg.paid),
        invoiceCount: agg.count,
      });
    }
    rows.sort((a, b) => {
      if (a.termId === currentTerm?.id) return -1;
      if (b.termId === currentTerm?.id) return 1;
      return a.termName.localeCompare(b.termName);
    });
    return rows;
  }

  const feeByTerm: FeeTermRow[] = [];
  const feeByStudent: Record<string, FeeTermRow[]> = {};

  if (studentIds.length) {
    const invs = await db.select({
      studentId: invoices.studentId,
      termId: invoices.termId,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
    }).from(invoices).where(and(
      eq(invoices.tenantId, tenantId),
      inArray(invoices.studentId, studentIds),
      isNull(invoices.deletedAt),
    ));

    feeByTerm.push(...aggregateFees(invs));
    for (const sid of studentIds) {
      feeByStudent[sid] = aggregateFees(invs.filter((i) => i.studentId === sid));
    }
  }

  const familyByStudent: Record<string, Array<{
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isPrimary: boolean;
    hasPortalAccount: boolean;
    isLoggedInParent: boolean;
  }>> = {};

  if (studentIds.length) {
    const links = await db.select({
      studentId: studentGuardians.studentId,
      isPrimary: studentGuardians.isPrimary,
      guardian: guardians,
    })
      .from(studentGuardians)
      .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(inArray(studentGuardians.studentId, studentIds));

    const guardianIds = [...new Set(links.map((l) => l.guardian.id))];
    const portalByGuardian = new Map<string, string>();
    if (guardianIds.length) {
      const accounts = await db.select({ id: parentAccounts.id, guardianId: parentAccounts.guardianId })
        .from(parentAccounts)
        .where(and(eq(parentAccounts.tenantId, tenantId), inArray(parentAccounts.guardianId, guardianIds)));
      for (const a of accounts) portalByGuardian.set(a.guardianId, a.id);
    }

    for (const row of links) {
      const sid = row.studentId;
      if (!familyByStudent[sid]) familyByStudent[sid] = [];
      const loggedIn = principal.kind === "parent" && principal.account.guardianId === row.guardian.id;
      familyByStudent[sid].push({
        id: row.guardian.id,
        firstName: row.guardian.firstName,
        lastName: row.guardian.lastName,
        relationship: row.guardian.relationship,
        phone: row.guardian.phone,
        email: row.guardian.email,
        address: row.guardian.address,
        isPrimary: row.isPrimary,
        hasPortalAccount: portalByGuardian.has(row.guardian.id),
        isLoggedInParent: loggedIn,
      });
    }
  }

  const emergencyByStudent: Record<string, { contact?: string; phone?: string }> = {};
  if (studentIds.length) {
    const studs = await db.select({
      id: students.id,
      medicalJson: students.medicalJson,
    }).from(students).where(inArray(students.id, studentIds));
    for (const s of studs) {
      const m = (s.medicalJson ?? {}) as { emergencyContact?: string; emergencyPhone?: string };
      if (m.emergencyContact || m.emergencyPhone) {
        emergencyByStudent[s.id] = { contact: m.emergencyContact, phone: m.emergencyPhone };
      }
    }
  }

  const enrollmentsEnhanced = studentIds.length
    ? await db.select({
      studentId: studentClassHistory.studentId,
      classId: studentClassHistory.classId,
      streamId: studentClassHistory.streamId,
      termId: studentClassHistory.termId,
      className: classes.name,
      streamName: streams.name,
      classLevel: classes.level,
      termName: terms.name,
    })
      .from(studentClassHistory)
      .innerJoin(classes, eq(classes.id, studentClassHistory.classId))
      .leftJoin(streams, eq(streams.id, studentClassHistory.streamId))
      .leftJoin(terms, eq(terms.id, studentClassHistory.termId))
      .where(and(
        eq(studentClassHistory.tenantId, tenantId),
        inArray(studentClassHistory.studentId, studentIds),
        isNull(studentClassHistory.toDate),
      ))
    : [];

  const classIdByStudent = new Map<string, string | null>();
  const classNameByStudent = new Map<string, string | null>();
  for (const sid of studentIds) {
    const rows = enrollmentsEnhanced.filter((e) => e.studentId === sid);
    const cur = rows.find((e) => e.termId === currentTerm?.id) ?? rows[0];
    classIdByStudent.set(sid, cur?.classId ?? null);
    classNameByStudent.set(sid, cur?.className ?? null);
  }

  const classAttendanceByStudent: Record<string, ClassAttendanceRow[]> = {};
  if (studentIds.length) {
    const termStart = currentTerm?.startDate ? new Date(currentTerm.startDate) : null;
    const termEnd = currentTerm?.endDate ? new Date(currentTerm.endDate) : null;

    const attRows = await db.select({
      id: attendanceRecords.id,
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
      note: attendanceRecords.note,
      date: attendanceSessions.date,
      className: classes.name,
      streamName: streams.name,
    })
      .from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .innerJoin(classes, eq(classes.id, attendanceSessions.classId))
      .leftJoin(streams, eq(streams.id, attendanceSessions.streamId))
      .where(and(
        eq(attendanceRecords.tenantId, tenantId),
        inArray(attendanceRecords.studentId, studentIds),
      ))
      .orderBy(desc(attendanceSessions.date))
      .limit(500);

    for (const row of attRows) {
      const sid = row.studentId;
      if (!classAttendanceByStudent[sid]) classAttendanceByStudent[sid] = [];
      if (classAttendanceByStudent[sid].length >= 90) continue;
      const d = new Date(row.date);
      const inCurrentTerm = !!(termStart && termEnd && d >= termStart && d <= termEnd);
      classAttendanceByStudent[sid].push({
        id: row.id,
        date: d.toISOString(),
        status: row.status,
        className: row.className,
        streamName: row.streamName,
        note: row.note,
        inCurrentTerm,
      });
    }
  }

  const schoolTermFeesByStudent: Record<string, SchoolTermFeeSchedule[]> = {};
  if (studentIds.length && allTerms.length) {
    const structures = await db.select({
      id: feeStructures.id,
      name: feeStructures.name,
      termId: feeStructures.termId,
      classId: feeStructures.classId,
      className: classes.name,
    })
      .from(feeStructures)
      .leftJoin(classes, eq(classes.id, feeStructures.classId))
      .where(and(
        eq(feeStructures.tenantId, tenantId),
        eq(feeStructures.isActive, true),
        isNull(feeStructures.deletedAt),
      ));

    const structureIds = structures.map((s) => s.id);
    const itemsByStructure = new Map<string, { feeHeadName: string; amountMinor: number }[]>();

    if (structureIds.length) {
      const itemRows = await db.select({
        feeStructureId: feeStructureItems.feeStructureId,
        amount: feeStructureItems.amount,
        feeHeadName: feeHeads.name,
      })
        .from(feeStructureItems)
        .innerJoin(feeHeads, eq(feeHeads.id, feeStructureItems.feeHeadId))
        .where(and(
          eq(feeStructureItems.tenantId, tenantId),
          inArray(feeStructureItems.feeStructureId, structureIds),
        ));

      for (const it of itemRows) {
        const list = itemsByStructure.get(it.feeStructureId) ?? [];
        list.push({ feeHeadName: it.feeHeadName, amountMinor: it.amount });
        itemsByStructure.set(it.feeStructureId, list);
      }
    }

    for (const sid of studentIds) {
      const classId = classIdByStudent.get(sid) ?? null;
      const schedules: SchoolTermFeeSchedule[] = [];

      for (const term of allTerms) {
        let best: (typeof structures)[0] | null = null;
        let bestScore = -1;
        for (const fs of structures) {
          const score = feeStructureMatchScore(fs, term.id, classId);
          if (score > bestScore) {
            bestScore = score;
            best = fs;
          }
        }
        if (!best || bestScore < 0) continue;
        const items = itemsByStructure.get(best.id) ?? [];
        if (!items.length) continue;
        const totalMinor = items.reduce((s, i) => s + i.amountMinor, 0);
        schedules.push({
          termId: term.id,
          termName: term.name,
          isCurrent: term.id === currentTerm?.id,
          structureId: best.id,
          structureName: best.name,
          className: best.className ?? classNameByStudent.get(sid) ?? null,
          items,
          totalMinor,
        });
      }

      schedules.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return a.termName.localeCompare(b.termName);
      });
      schoolTermFeesByStudent[sid] = schedules;
    }
  }

  const reportCardsByTerm = studentIds.length
    ? await db.select({
      id: reportCards.id,
      studentId: reportCards.studentId,
      termId: reportCards.termId,
      termName: terms.name,
      dataJson: reportCards.dataJson,
      published: reportCards.published,
      createdAt: reportCards.createdAt,
    })
      .from(reportCards)
      .innerJoin(terms, eq(terms.id, reportCards.termId))
      .where(and(
        eq(reportCards.tenantId, tenantId),
        inArray(reportCards.studentId, studentIds),
        eq(reportCards.published, true),
      ))
      .orderBy(desc(reportCards.createdAt))
    : [];

  const now = new Date();
  const past30 = new Date(now);
  past30.setDate(past30.getDate() - 30);
  const future90 = new Date(now);
  future90.setDate(future90.getDate() + 90);

  const calendarRows = await db.select().from(schoolEvents).where(and(
    eq(schoolEvents.tenantId, tenantId),
    eq(schoolEvents.published, true),
    or(
      eq(schoolEvents.audience, "all"),
      eq(schoolEvents.audience, "parents"),
    ),
    gte(schoolEvents.startsAt, past30),
    lte(schoolEvents.startsAt, future90),
  )).orderBy(schoolEvents.startsAt);

  const calendar = {
    upcoming: [] as Array<ReturnType<typeof mapEvent>>,
    games: [] as Array<ReturnType<typeof mapEvent>>,
    trips: [] as Array<ReturnType<typeof mapEvent>>,
    academic: [] as Array<ReturnType<typeof mapEvent>>,
    all: [] as Array<ReturnType<typeof mapEvent>>,
  };

  function mapEvent(e: typeof schoolEvents.$inferSelect) {
    const cat = eventCategory(e.eventType, e.title);
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      eventType: e.eventType,
      category: cat,
      venue: e.venue,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      audience: e.audience,
    };
  }

  for (const e of calendarRows) {
    const mapped = mapEvent(e);
    calendar.all.push(mapped);
    if (new Date(e.startsAt) >= now) calendar.upcoming.push(mapped);
    if (mapped.category === "games") calendar.games.push(mapped);
    if (mapped.category === "trip") calendar.trips.push(mapped);
    if (mapped.category === "academic") calendar.academic.push(mapped);
  }

  const notifications = await buildPortalNotifications(tenantId, studentIds, principal, {
    termName: currentTerm?.name,
    feeByTerm,
  });

  return {
    currentTerm: currentTerm ? {
      id: currentTerm.id,
      name: currentTerm.name,
      startDate: currentTerm.startDate,
      endDate: currentTerm.endDate,
    } : null,
    currentAcademicYear,
    terms: allTerms,
    feeByTerm,
    feeByStudent,
    familyByStudent,
    emergencyByStudent,
    enrollmentsEnhanced,
    classAttendanceByStudent,
    schoolTermFeesByStudent,
    reportCardsByTerm,
    calendar,
    notifications,
  };
}

async function buildPortalNotifications(
  tenantId: string,
  studentIds: string[],
  principal: PortalPrincipal,
  ctx: { termName?: string; feeByTerm: FeeTermRow[] },
): Promise<PortalNotification[]> {
  const out: PortalNotification[] = [];
  const now = Date.now();

  const anns = await db.select().from(announcements).where(and(
    eq(announcements.tenantId, tenantId),
    eq(announcements.published, true),
    or(eq(announcements.audience, "all"), eq(announcements.audience, "parents")),
  )).orderBy(desc(announcements.createdAt)).limit(8);

  for (const a of anns) {
    out.push({
      id: `ann-${a.id}`,
      type: "announcement",
      title: a.title,
      body: (a.body ?? "").slice(0, 200),
      createdAt: a.createdAt.toISOString(),
      linkTab: "overview",
    });
  }

  if (studentIds.length) {
    const unreadMsgs = await db.select({
      id: portalMessages.id,
      body: portalMessages.body,
      studentId: portalMessages.studentId,
      createdAt: portalMessages.createdAt,
    }).from(portalMessages).where(and(
      eq(portalMessages.tenantId, tenantId),
      inArray(portalMessages.studentId, studentIds),
      eq(portalMessages.senderType, "staff"),
      sql`${portalMessages.readAt} is null`,
    )).orderBy(desc(portalMessages.createdAt)).limit(10);

    for (const m of unreadMsgs) {
      out.push({
        id: `msg-${m.id}`,
        type: "message",
        title: "New message from school",
        body: m.body.slice(0, 160),
        createdAt: m.createdAt.toISOString(),
        linkTab: "messages",
        studentId: m.studentId,
      });
    }

    const dueTerm = ctx.feeByTerm.find((f) => f.remainingMinor > 0);
    if (dueTerm) {
      out.push({
        id: `fee-due-${dueTerm.termId ?? "general"}`,
        type: "fee",
        title: `Fees due — ${dueTerm.termName}`,
        body: `Outstanding balance for ${dueTerm.termName}. Open Fees to pay online.`,
        createdAt: new Date().toISOString(),
        linkTab: "fees",
      });
    }

    const recentRc = await db.select({
      id: reportCards.id,
      studentId: reportCards.studentId,
      createdAt: reportCards.createdAt,
      termName: terms.name,
    }).from(reportCards)
      .innerJoin(terms, eq(terms.id, reportCards.termId))
      .where(and(
        eq(reportCards.tenantId, tenantId),
        inArray(reportCards.studentId, studentIds),
        eq(reportCards.published, true),
        gte(reportCards.createdAt, new Date(now - 14 * 86400000)),
      ))
      .orderBy(desc(reportCards.createdAt))
      .limit(5);

    for (const rc of recentRc) {
      out.push({
        id: `rc-${rc.id}`,
        type: "results",
        title: `Report card published — ${rc.termName}`,
        body: "New term results are available to view and download.",
        createdAt: rc.createdAt.toISOString(),
        linkTab: "academics",
        studentId: rc.studentId,
      });
    }
  }

  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  const evs = await db.select().from(schoolEvents).where(and(
    eq(schoolEvents.tenantId, tenantId),
    eq(schoolEvents.published, true),
    gte(schoolEvents.startsAt, new Date()),
    lte(schoolEvents.startsAt, soon),
    or(eq(schoolEvents.audience, "all"), eq(schoolEvents.audience, "parents")),
  )).orderBy(schoolEvents.startsAt).limit(6);

  for (const e of evs) {
    out.push({
      id: `ev-${e.id}`,
      type: "calendar",
      title: e.title,
      body: `${eventCategory(e.eventType, e.title)} · ${new Date(e.startsAt).toLocaleString()}${e.venue ? ` @ ${e.venue}` : ""}`,
      createdAt: e.startsAt.toISOString(),
      linkTab: "calendar",
    });
  }

  out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return out.slice(0, 25);
}

export async function markPortalMessageRead(
  tenantId: string,
  principal: PortalPrincipal,
  messageId: string,
) {
  const studentIds = await getPortalAccessibleStudentIds(principal);
  await db.update(portalMessages).set({ readAt: new Date() }).where(and(
    eq(portalMessages.id, messageId),
    eq(portalMessages.tenantId, tenantId),
    inArray(portalMessages.studentId, studentIds),
    eq(portalMessages.senderType, "staff"),
  ));
}
