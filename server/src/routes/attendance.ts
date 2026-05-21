import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { attendanceSessions, attendanceRecords, classes } from "../db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { AppError, NotFoundError } from "../middleware/error";
import { createAuditLog } from "../services/audit";
import { parseAttendanceDate, rosterStudentIdsForClass } from "../lib/attendance-roster";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth, requireTenantMatch);

attendanceRouter.get("/classes", requirePermission("attendance.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const rows = await db.select({ id: classes.id, name: classes.name, level: classes.level })
      .from(classes)
      .where(eq(classes.tenantId, tenantId))
      .orderBy(classes.level);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// Fetch recent attendance sessions
attendanceRouter.get("/", requirePermission("attendance.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const sessions = await db.select()
      .from(attendanceSessions)
      .where(eq(attendanceSessions.tenantId, tenantId))
      .orderBy(desc(attendanceSessions.date))
      .limit(50);
    
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// Start or retrieve an attendance session for a class/date
const sessionSchema = z.object({
  classId: z.string().uuid(),
  streamId: z.string().uuid().optional(),
  date: z.string(), // ISO Date string
  periodNo: z.number().int().min(1).max(12).optional(),
});

attendanceRouter.post("/session", requirePermission("attendance.take"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const body = sessionSchema.parse(req.body);
    const targetDate = parseAttendanceDate(body.date);
    const periodNo = body.periodNo ?? null;
    const periodKey = periodNo ?? 0;

    let [session] = await db.select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.classId, body.classId),
          sql`${attendanceSessions.date}::date = ${body.date}::date`,
          sql`COALESCE(${attendanceSessions.periodNo}, 0) = ${periodKey}`,
        )
      );

    if (!session) {
      [session] = await db.insert(attendanceSessions).values({
        tenantId,
        classId: body.classId,
        streamId: body.streamId || null,
        date: targetDate,
        periodNo,
        takenBy: (req as any).user!.id
      }).returning();

      const studentIds = await rosterStudentIdsForClass(tenantId, body.classId, body.streamId);
      if (studentIds.length > 0) {
        await db.insert(attendanceRecords).values(
          studentIds.map((studentId) => ({
            tenantId,
            sessionId: session.id,
            studentId,
            status: "present" as const,
          })),
        );
      }

      await createAuditLog({
        tenantId,
        actorUserId: (req as any).user!.id,
        action: "CREATE",
        entityType: "attendance_session",
        entityId: session.id,
        after: session,
        ip: req.ip,
      });
    }

    // Return the session with its records
    const records = await db.select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, session.id));

    res.json({ success: true, data: { session, records } });
  } catch (error) {
    next(error);
  }
});

// Bulk update attendance records for a session
const updateRecordsSchema = z.object({
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(["present", "absent", "late", "excused"]),
    note: z.string().optional()
  }))
});

attendanceRouter.patch("/session/:sessionId", requirePermission("attendance.take"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const { sessionId } = req.params;
    const body = updateRecordsSchema.parse(req.body);

    const [session] = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.tenantId, tenantId)));
    if (!session) throw new AppError("Session not found", 404);

    // Drizzle doesn't support bulk upsert effectively with multiple conditions without raw sql, 
    // but we can delete and re-insert, or do individual updates. Individual updates inside a transaction would be safer but slow.
    // Given we are deleting existing records for these students and re-inserting them.
    const studentIds = body.records.map(r => r.studentId);
    
    await db.transaction(async (tx) => {
      // 1. Delete existing records for these specific students in this session
      await tx.delete(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, sessionId),
            inArray(attendanceRecords.studentId, studentIds)
          )
        );

      // 2. Insert new updated records
      const insertPayload = body.records.map(r => ({
        tenantId,
        sessionId,
        studentId: r.studentId,
        status: r.status,
        note: r.note || null
      }));

      await tx.insert(attendanceRecords).values(insertPayload);
    });

    res.json({ success: true, message: "Attendance updated successfully" });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.delete("/session/:sessionId", requirePermission("attendance.edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const { sessionId } = req.params;
    const [session] = await db.select().from(attendanceSessions)
      .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.tenantId, tenantId)))
      .limit(1);
    if (!session) throw new NotFoundError("Session not found");
    await db.delete(attendanceSessions).where(eq(attendanceSessions.id, sessionId));
    await createAuditLog({
      tenantId,
      actorUserId: (req as any).user!.id,
      action: "DELETE",
      entityType: "attendance_session",
      entityId: sessionId,
      before: session,
      ip: req.ip,
    });
    res.json({ success: true, message: "Session deleted" });
  } catch (error) {
    next(error);
  }
});
