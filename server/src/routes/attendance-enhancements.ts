import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  attendanceSessions, attendanceRecords, students, classes, studentClassHistory, guardians, studentGuardians,
} from "../db/schema";
import { eq, and, desc, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { sendTenantMessage } from "../services/tenant-messaging";

export const attendanceEnhancementsRouter = Router();
attendanceEnhancementsRouter.use(requireAuth, requireTenantMatch);

attendanceEnhancementsRouter.get("/sessions/enriched", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const rows = await db.select({
      session: attendanceSessions,
      className: classes.name,
      recordCount: sql<number>`(select count(*)::int from attendance_records ar where ar.session_id = ${attendanceSessions.id})`,
      absentCount: sql<number>`(select count(*)::int from attendance_records ar where ar.session_id = ${attendanceSessions.id} and ar.status = 'absent')`,
    }).from(attendanceSessions)
      .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
      .where(eq(attendanceSessions.tenantId, tenantId))
      .orderBy(desc(attendanceSessions.date))
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

attendanceEnhancementsRouter.get("/session/:sessionId/detail", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const [session] = await db.select({
      session: attendanceSessions,
      className: classes.name,
    }).from(attendanceSessions)
      .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
      .where(and(eq(attendanceSessions.id, req.params.sessionId), eq(attendanceSessions.tenantId, tenantId)))
      .limit(1);
    if (!session) throw new NotFoundError("Session not found");

    const records = await db.select({
      record: attendanceRecords,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    }).from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .where(eq(attendanceRecords.sessionId, req.params.sessionId))
      .orderBy(students.lastName);

    res.json({ success: true, data: { ...session, records } });
  } catch (e) { next(e); }
});

attendanceEnhancementsRouter.get("/reports/daily", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const classId = req.query.classId as string | undefined;
    const sessionConds = [
      eq(attendanceSessions.tenantId, tenantId),
      gte(attendanceSessions.date, dayStart),
      lte(attendanceSessions.date, dayEnd),
    ];
    if (classId) sessionConds.push(eq(attendanceSessions.classId, classId));

    const sessions = await db.select({ id: attendanceSessions.id, classId: attendanceSessions.classId, className: classes.name })
      .from(attendanceSessions)
      .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
      .where(and(...sessionConds));

    const sessionIds = sessions.map((s) => s.id);
    if (!sessionIds.length) {
      return res.json({ success: true, data: { date: dateStr, present: 0, absent: 0, late: 0, excused: 0, sessions: [] } });
    }

    const counts = await db.select({
      status: attendanceRecords.status,
      count: sql<number>`count(*)::int`,
    }).from(attendanceRecords)
      .where(inArray(attendanceRecords.sessionId, sessionIds))
      .groupBy(attendanceRecords.status);

    const tally = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const c of counts) {
      if (c.status in tally) (tally as any)[c.status] += Number(c.count);
    }

    res.json({ success: true, data: { date: dateStr, ...tally, sessions } });
  } catch (e) { next(e); }
});

attendanceEnhancementsRouter.get("/reports/student/:studentId", requirePermission("attendance.view"), async (req, res, next) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const rows = await db.select({
      status: attendanceRecords.status,
      note: attendanceRecords.note,
      date: attendanceSessions.date,
      className: classes.name,
    }).from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .innerJoin(classes, eq(attendanceSessions.classId, classes.id))
      .where(and(
        eq(attendanceRecords.studentId, req.params.studentId),
        eq(attendanceRecords.tenantId, tenantId),
      ))
      .orderBy(desc(attendanceSessions.date))
      .limit(90);

    const total = rows.length;
    const present = rows.filter((r) => r.status === "present").length;
    res.json({
      success: true,
      data: { records: rows, summary: { total, present, rate: total ? Math.round((present / total) * 100) : 0 } },
    });
  } catch (e) { next(e); }
});

attendanceEnhancementsRouter.post("/session/:sessionId/notify-absences", requirePermission("attendance.take"),
  validate({ body: z.object({ channels: z.array(z.enum(["sms", "email"])).min(1) }) }),
  async (req, res, next) => {
    try {
      const tenantId = (req as any).tenant!.id;
      const [session] = await db.select().from(attendanceSessions)
        .where(and(eq(attendanceSessions.id, req.params.sessionId), eq(attendanceSessions.tenantId, tenantId))).limit(1);
      if (!session) throw new NotFoundError("Session not found");

      const absent = await db.select({
        studentId: attendanceRecords.studentId,
        firstName: students.firstName,
        lastName: students.lastName,
      }).from(attendanceRecords)
        .innerJoin(students, eq(attendanceRecords.studentId, students.id))
        .where(and(
          eq(attendanceRecords.sessionId, session.id),
          inArray(attendanceRecords.status, ["absent", "late"]),
        ));

      let sent = 0;
      let failed = 0;
      const dateLabel = new Date(session.date).toLocaleDateString();

      for (const row of absent) {
        const links = await db.select({ phone: guardians.phone, email: guardians.email })
          .from(studentGuardians)
          .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
          .where(eq(studentGuardians.studentId, row.studentId));
        const msg = `Attendance alert: ${row.firstName} ${row.lastName} was absent or late on ${dateLabel}. Please contact the school if this is unexpected.`;
        for (const g of links) {
          for (const ch of req.body.channels) {
            const to = ch === "email" ? g.email : g.phone;
            if (!to) continue;
            const result = await sendTenantMessage(tenantId, {
              to, channel: ch, subject: "Attendance alert", body: msg,
            });
            if (result.success) sent++;
            else failed++;
          }
        }
      }

      res.json({ success: true, data: { absent: absent.length, sent, failed } });
    } catch (e) { next(e); }
  },
);
