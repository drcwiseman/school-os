import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { attendanceSessions, attendanceRecords, students, studentClassHistory } from "../db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { AppError } from "../middleware/error";
import { createAuditLog } from "../services/audit";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth, requireTenantMatch);

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
    const targetDate = new Date(body.date);
    
    const periodNo = body.periodNo ?? null;

    // Check if session already exists (same class, date, period)
    let [session] = await db.select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.classId, body.classId),
          eq(attendanceSessions.date, targetDate),
          periodNo != null
            ? eq(attendanceSessions.periodNo, periodNo)
            : sql`${attendanceSessions.periodNo} IS NULL`
        )
      );

    if (!session) {
      // Create new session
      [session] = await db.insert(attendanceSessions).values({
        tenantId,
        classId: body.classId,
        streamId: body.streamId || null,
        date: targetDate,
        periodNo,
        takenBy: (req as any).user!.id
      }).returning();

      // Pre-fill records with 'present' for all active students in the class
      const classStudents = await db.select({ id: students.id })
        .from(studentClassHistory)
        .innerJoin(students, eq(students.id, studentClassHistory.studentId))
        .where(
          and(
            eq(studentClassHistory.tenantId, tenantId),
            eq(studentClassHistory.classId, body.classId),
            eq(students.status, "active")
          )
        );

      if (classStudents.length > 0) {
        const recordsToInsert = classStudents.map(s => ({
          tenantId,
          sessionId: session.id,
          studentId: s.id,
          status: "present" as const,
        }));
        await db.insert(attendanceRecords).values(recordsToInsert);
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
