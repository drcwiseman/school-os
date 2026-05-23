import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  academicYears, terms, classes, streams, subjects, rooms, teacherAssignments,
  timetables, timetablePeriods, assignments, assignmentSubmissions,
  students, studentClassHistory, seatingLayouts, lessonLogs, smartDevices, users,
  studentMaterials, onlineClassLinks, onlineClassAttendance,
  attendanceSessions, attendanceRecords,
} from "../db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { writeTenantFile, resolveTenantFile } from "../lib/uploads";
import { ConflictError, NotFoundError } from "../middleware/error";
import { getCampusId } from "../lib/campus-scope";
import {
  getOnlineClassById,
  insertOnlineClass,
  listClassesForTenant,
  listOnlineClassAttendance,
  listOnlineClassesForTenant,
  listStudentMaterialsForTenant,
  rosterForStream,
  setOnlineClassAttendanceSessionId,
} from "../lib/academics-query";
import { getTableColumns } from "../lib/table-columns";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission, requireAnyPermission } from "../middleware/rbac";
import { validate } from "../utils/validate";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/context", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [years, termsRows, classesList, subjectsList] = await Promise.all([
      db.select().from(academicYears).where(eq(academicYears.tenantId, tenant.id)).orderBy(desc(academicYears.startDate)),
      db.select().from(terms).where(eq(terms.tenantId, tenant.id)),
      listClassesForTenant(tenant.id, getCampusId(req)),
      db.select().from(subjects).where(eq(subjects.tenantId, tenant.id)),
    ]);
    res.json({
      success: true,
      data: {
        years,
        terms: termsRows,
        classes: classesList,
        subjects: subjectsList,
        counts: {
          years: years.length,
          terms: termsRows.length,
          classes: classesList.length,
          subjects: subjectsList.length,
        },
      },
    });
  } catch (e) { next(e); }
});

router.get("/years", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(academicYears).where(eq(academicYears.tenantId, tenant.id)).orderBy(desc(academicYears.startDate));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/years", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1), startDate: z.string(), endDate: z.string(), isCurrent: z.boolean().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(academicYears).values({
        tenantId: tenant.id,
        name: req.body.name,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: req.body.isCurrent ?? false,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.patch("/years/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    name: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = {};
      if (req.body.name != null) patch.name = req.body.name;
      if (req.body.startDate != null) patch.startDate = new Date(req.body.startDate);
      if (req.body.endDate != null) patch.endDate = new Date(req.body.endDate);
      if (req.body.isCurrent != null) patch.isCurrent = req.body.isCurrent;
      const [row] = await db.update(academicYears).set(patch)
        .where(and(eq(academicYears.id, req.params.id), eq(academicYears.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Academic year not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/years/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(academicYears)
      .where(and(eq(academicYears.id, req.params.id), eq(academicYears.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Academic year not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/terms", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(terms).where(eq(terms.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/terms", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ academicYearId: z.string().uuid(), name: z.string().min(1), startDate: z.string(), endDate: z.string(), isCurrent: z.boolean().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(terms).values({
        tenantId: tenant.id,
        academicYearId: req.body.academicYearId,
        name: req.body.name,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: req.body.isCurrent ?? false,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.patch("/terms/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    academicYearId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = {};
      if (req.body.academicYearId != null) patch.academicYearId = req.body.academicYearId;
      if (req.body.name != null) patch.name = req.body.name;
      if (req.body.startDate != null) patch.startDate = new Date(req.body.startDate);
      if (req.body.endDate != null) patch.endDate = new Date(req.body.endDate);
      if (req.body.isCurrent != null) patch.isCurrent = req.body.isCurrent;
      const [row] = await db.update(terms).set(patch)
        .where(and(eq(terms.id, req.params.id), eq(terms.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Term not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/terms/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(terms)
      .where(and(eq(terms.id, req.params.id), eq(terms.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Term not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/classes", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await listClassesForTenant(tenant.id, getCampusId(req));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/classes", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1), level: z.number().int().min(1).optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(classes).values({
        tenantId: tenant.id,
        name: req.body.name,
        level: req.body.level ?? 1,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.patch("/classes/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1).optional(), level: z.number().int().min(1).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = {};
      if (req.body.name != null) patch.name = req.body.name;
      if (req.body.level != null) patch.level = req.body.level;
      const [row] = await db.update(classes).set(patch)
        .where(and(eq(classes.id, req.params.id), eq(classes.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Class not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/classes/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(classes)
      .where(and(eq(classes.id, req.params.id), eq(classes.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Class not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/classes/:classId/streams", ...guard, requirePermission("academics.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [cls] = await db.select().from(classes).where(and(eq(classes.id, req.params.classId), eq(classes.tenantId, tenant.id))).limit(1);
    if (!cls) throw new NotFoundError("Class not found");
    const rows = await db.select().from(streams).where(and(eq(streams.classId, cls.id), eq(streams.tenantId, tenant.id)));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/classes/:classId/streams", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [cls] = await db.select().from(classes).where(and(eq(classes.id, req.params.classId), eq(classes.tenantId, tenant.id))).limit(1);
      if (!cls) throw new NotFoundError("Class not found");
      const [row] = await db.insert(streams).values({ tenantId: tenant.id, classId: cls.id, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.patch("/streams/:streamId", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(streams).set({ name: req.body.name })
        .where(and(eq(streams.id, req.params.streamId), eq(streams.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Section not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/streams/:streamId", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(streams)
      .where(and(eq(streams.id, req.params.streamId), eq(streams.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Section not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/subjects", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(subjects).where(eq(subjects.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/subjects", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ code: z.string(), name: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(subjects).values({ tenantId: tenant.id, code: req.body.code, name: req.body.name }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/subjects/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ code: z.string().optional(), name: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(subjects).set(req.body)
        .where(and(eq(subjects.id, req.params.id), eq(subjects.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Subject not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/subjects/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(subjects)
      .where(and(eq(subjects.id, req.params.id), eq(subjects.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Subject not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/rooms", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(rooms).where(eq(rooms.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/rooms", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string(), capacity: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(rooms).values({ tenantId: tenant.id, name: req.body.name, capacity: req.body.capacity }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/rooms/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string().optional(), capacity: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(rooms).set(req.body)
        .where(and(eq(rooms.id, req.params.id), eq(rooms.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Room not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/rooms/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(rooms)
      .where(and(eq(rooms.id, req.params.id), eq(rooms.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Room not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/timetables", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(timetables).where(eq(timetables.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/timetables", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    classId: z.string().uuid(),
    termId: z.string().uuid().optional(),
    name: z.string(),
    timetableType: z.enum(["teaching", "exam", "mock", "test"]).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [tt] = await db.insert(timetables).values({
        tenantId: tenant.id,
        classId: req.body.classId,
        termId: req.body.termId,
        name: req.body.name,
        timetableType: req.body.timetableType ?? "teaching",
      }).returning();
      res.status(201).json({ success: true, data: tt });
    } catch (e) { next(e); }
  }
);

router.get("/timetables/:id/periods", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(timetablePeriods).where(and(eq(timetablePeriods.timetableId, req.params.id), eq(timetablePeriods.tenantId, tenant.id)));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/timetables/:id/periods", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ dayOfWeek: z.number(), periodNo: z.number(), subjectId: z.string().uuid().optional(), teacherUserId: z.string().uuid().optional(), roomId: z.string().uuid().optional(), startTime: z.string().optional(), endTime: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [tt] = await db.select().from(timetables).where(and(eq(timetables.id, req.params.id), eq(timetables.tenantId, tenant.id))).limit(1);
      if (!tt) throw new NotFoundError("Timetable not found");

      const existing = await db.select().from(timetablePeriods).where(and(
        eq(timetablePeriods.timetableId, req.params.id),
        eq(timetablePeriods.tenantId, tenant.id),
      ));
      const candidate = {
        id: "new",
        dayOfWeek: req.body.dayOfWeek,
        periodNo: req.body.periodNo,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        teacherUserId: req.body.teacherUserId,
        roomId: req.body.roomId,
        classId: tt.classId,
      };
      const { detectPeriodConflicts } = await import("../services/timetable-conflicts");
      const tenantPeriods = await db.select({
        id: timetablePeriods.id,
        dayOfWeek: timetablePeriods.dayOfWeek,
        periodNo: timetablePeriods.periodNo,
        startTime: timetablePeriods.startTime,
        endTime: timetablePeriods.endTime,
        teacherUserId: timetablePeriods.teacherUserId,
        roomId: timetablePeriods.roomId,
        classId: timetables.classId,
      })
        .from(timetablePeriods)
        .innerJoin(timetables, eq(timetables.id, timetablePeriods.timetableId))
        .where(and(eq(timetablePeriods.tenantId, tenant.id), eq(timetables.isPublished, true)));
      const conflicts = detectPeriodConflicts([...tenantPeriods, candidate]);
      if (conflicts.some((c) => c.severity === "error")) {
        throw new ConflictError(conflicts[0]?.detail ?? "Timetable overlap detected");
      }

      const [row] = await db.insert(timetablePeriods).values({ tenantId: tenant.id, timetableId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/assignments", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(assignments).where(eq(assignments.tenantId, tenant.id)).orderBy(desc(assignments.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/assignments", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ classId: z.string().uuid(), subjectId: z.string().uuid(), title: z.string(), description: z.string().optional(), dueDate: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(assignments).values({
        tenantId: tenant.id, classId: req.body.classId, subjectId: req.body.subjectId,
        title: req.body.title, description: req.body.description, createdBy: user.id,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/assignments/:id", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    classId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body };
      if (req.body.dueDate != null) patch.dueDate = new Date(req.body.dueDate);
      const [row] = await db.update(assignments).set(patch)
        .where(and(eq(assignments.id, req.params.id), eq(assignments.tenantId, tenant.id)))
        .returning();
      if (!row) throw new NotFoundError("Assignment not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/assignments/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(assignments)
      .where(and(eq(assignments.id, req.params.id), eq(assignments.tenantId, tenant.id)))
      .returning();
    if (!row) throw new NotFoundError("Assignment not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post("/assignments/:id/submit", ...guard, requirePermission("academics.view"),
  validate({ body: z.object({ studentId: z.string().uuid(), content: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(assignmentSubmissions).values({
        tenantId: tenant.id, assignmentId: req.params.id, studentId: req.body.studentId, content: req.body.content,
        status: "submitted",
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/assignments/:id/submissions", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      id: assignmentSubmissions.id,
      studentId: assignmentSubmissions.studentId,
      content: assignmentSubmissions.content,
      score: assignmentSubmissions.score,
      maxScore: assignmentSubmissions.maxScore,
      feedback: assignmentSubmissions.feedback,
      status: assignmentSubmissions.status,
      submittedAt: assignmentSubmissions.submittedAt,
      gradedAt: assignmentSubmissions.gradedAt,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    })
      .from(assignmentSubmissions)
      .innerJoin(students, eq(students.id, assignmentSubmissions.studentId))
      .where(and(eq(assignmentSubmissions.assignmentId, req.params.id), eq(assignmentSubmissions.tenantId, tenant.id)))
      .orderBy(desc(assignmentSubmissions.submittedAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.patch("/assignments/submissions/:submissionId/grade", ...guard, requireAnyPermission("academics.manage", "academics.teach", "exams.enter_marks"),
  validate({
    body: z.object({
      score: z.number().min(0),
      maxScore: z.number().min(1).optional(),
      feedback: z.string().optional(),
      status: z.enum(["graded", "returned"]).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.update(assignmentSubmissions).set({
        score: String(req.body.score),
        maxScore: req.body.maxScore != null ? String(req.body.maxScore) : undefined,
        feedback: req.body.feedback ?? null,
        status: req.body.status ?? "graded",
        gradedAt: new Date(),
        gradedBy: user.id,
      }).where(and(
        eq(assignmentSubmissions.id, req.params.submissionId),
        eq(assignmentSubmissions.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Submission not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/teacher-assignments", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      id: teacherAssignments.id,
      userId: teacherAssignments.userId,
      classId: teacherAssignments.classId,
      subjectId: teacherAssignments.subjectId,
      role: teacherAssignments.role,
      teacherName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      className: classes.name,
      subjectName: subjects.name,
    })
      .from(teacherAssignments)
      .leftJoin(users, eq(users.id, teacherAssignments.userId))
      .leftJoin(classes, eq(classes.id, teacherAssignments.classId))
      .leftJoin(subjects, eq(subjects.id, teacherAssignments.subjectId))
      .where(eq(teacherAssignments.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/teacher-assignments", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ userId: z.string().uuid(), classId: z.string().uuid(), subjectId: z.string().uuid().optional(), role: z.enum(["subject", "class_teacher"]).default("subject") }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(teacherAssignments).values({
        tenantId: tenant.id,
        userId: req.body.userId,
        classId: req.body.classId,
        subjectId: req.body.role === "class_teacher" ? null : req.body.subjectId,
        role: req.body.role,
      }).returning();
      if (req.body.role === "class_teacher" && req.body.subjectId) {
        await db.update(streams).set({ classTeacherUserId: req.body.userId })
          .where(and(eq(streams.tenantId, tenant.id), eq(streams.classId, req.body.classId)));
      }
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/streams/:streamId/roster", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const result = await rosterForStream(tenant.id, req.params.streamId);
    if (!result) throw new NotFoundError("Stream not found");
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.get("/streams/:streamId/seating", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [layout] = await db.select().from(seatingLayouts).where(and(eq(seatingLayouts.streamId, req.params.streamId), eq(seatingLayouts.tenantId, tenant.id))).limit(1);
    res.json({ success: true, data: layout ?? null });
  } catch (e) { next(e); }
});

router.put("/streams/:streamId/seating", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ rows: z.number(), cols: z.number(), seatsJson: z.array(z.object({ row: z.number(), col: z.number(), studentId: z.string().uuid().optional() })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(seatingLayouts).where(and(eq(seatingLayouts.streamId, req.params.streamId), eq(seatingLayouts.tenantId, tenant.id))).limit(1);
      if (existing) {
        const [row] = await db.update(seatingLayouts).set({ ...req.body, updatedAt: new Date() }).where(eq(seatingLayouts.id, existing.id)).returning();
        return res.json({ success: true, data: row });
      }
      const [row] = await db.insert(seatingLayouts).values({ tenantId: tenant.id, streamId: req.params.streamId, ...req.body }).returning();
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/lesson-logs", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(lessonLogs).where(eq(lessonLogs.tenantId, tenant.id)).orderBy(desc(lessonLogs.logDate)) });
  } catch (e) { next(e); }
});

router.post("/lesson-logs", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    classId: z.string().uuid(),
    subjectId: z.string().uuid().optional(),
    topic: z.string(),
    notes: z.string().optional(),
    progressPercent: z.number().int().min(0).max(100).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(lessonLogs).values({ tenantId: tenant.id, userId: user.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/lesson-logs/progress", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const classId = String(req.query.classId ?? "");
    const conditions = [eq(lessonLogs.tenantId, tenant.id)];
    if (classId) conditions.push(eq(lessonLogs.classId, classId));
    const rows = await db.select({
      subjectId: lessonLogs.subjectId,
      subjectName: subjects.name,
      topicCount: sql<number>`count(*)::int`,
      avgProgress: sql<number>`coalesce(avg(${lessonLogs.progressPercent}), 0)::int`,
      lastTopic: sql<string>`max(${lessonLogs.topic})`,
    })
      .from(lessonLogs)
      .leftJoin(subjects, eq(subjects.id, lessonLogs.subjectId))
      .where(and(...conditions))
      .groupBy(lessonLogs.subjectId, subjects.name);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/smart-devices", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(smartDevices).where(eq(smartDevices.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/smart-devices", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string(), deviceType: z.string().optional(), roomId: z.string().uuid().optional(), serialNo: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(smartDevices).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/timetables/:id/conflicts", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [tt] = await db.select().from(timetables).where(and(eq(timetables.id, req.params.id), eq(timetables.tenantId, tenant.id))).limit(1);
    const periods = await db.select({
      id: timetablePeriods.id,
      dayOfWeek: timetablePeriods.dayOfWeek,
      periodNo: timetablePeriods.periodNo,
      startTime: timetablePeriods.startTime,
      endTime: timetablePeriods.endTime,
      teacherUserId: timetablePeriods.teacherUserId,
      roomId: timetablePeriods.roomId,
      classId: timetables.classId,
      className: classes.name,
    })
      .from(timetablePeriods)
      .innerJoin(timetables, eq(timetables.id, timetablePeriods.timetableId))
      .leftJoin(classes, eq(classes.id, timetables.classId))
      .where(and(eq(timetablePeriods.timetableId, req.params.id), eq(timetablePeriods.tenantId, tenant.id)));

    const tenantPeriods = await db.select({
      id: timetablePeriods.id,
      dayOfWeek: timetablePeriods.dayOfWeek,
      periodNo: timetablePeriods.periodNo,
      startTime: timetablePeriods.startTime,
      endTime: timetablePeriods.endTime,
      teacherUserId: timetablePeriods.teacherUserId,
      roomId: timetablePeriods.roomId,
      classId: timetables.classId,
      className: classes.name,
    })
      .from(timetablePeriods)
      .innerJoin(timetables, eq(timetables.id, timetablePeriods.timetableId))
      .leftJoin(classes, eq(classes.id, timetables.classId))
      .where(and(
        eq(timetablePeriods.tenantId, tenant.id),
        eq(timetables.isPublished, true),
        tt ? sql`${timetables.id} <> ${tt.id}` : sql`true`,
      ));

    const { detectPeriodConflicts } = await import("../services/timetable-conflicts");
    const local = detectPeriodConflicts(periods.map((p) => ({ ...p, classId: p.classId ?? tt?.classId ?? null })));
    const cross = detectPeriodConflicts([...tenantPeriods, ...periods.map((p) => ({ ...p, classId: p.classId ?? tt?.classId ?? null }))]);
    const conflicts = [...local, ...cross.filter((c) => !local.some((l) => l.detail === c.detail))];
    res.json({ success: true, data: { conflicts, periodCount: periods.length } });
  } catch (e) { next(e); }
});

router.patch("/timetables/:id/publish", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const published = Boolean(req.body?.published ?? true);
    const [row] = await db.update(timetables).set({ isPublished: published }).where(and(
      eq(timetables.id, req.params.id),
      eq(timetables.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Timetable not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post("/timetables/:id/generate", ...guard, requirePermission("academics.manage"),
  validate({
    body: z.object({
      daysOfWeek: z.array(z.number()).optional(),
      periodsPerDay: z.number().int().min(1).max(12),
      startTime: z.string(),
      periodDurationMinutes: z.number().int().min(15).max(120),
      breakAfterPeriod: z.number().int().optional(),
      breakDurationMinutes: z.number().int().optional(),
      subjects: z.array(z.object({
        subjectId: z.string().uuid(),
        teacherUserId: z.string().uuid().optional(),
        roomId: z.string().uuid().optional(),
        periodsPerWeek: z.number().int().min(1).max(40),
      })).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { generateTeachingTimetable } = await import("../services/timetable-generator");
      const result = await generateTeachingTimetable(tenant.id, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },
);

router.get("/materials", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await listStudentMaterialsForTenant(tenant.id);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/materials", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    title: z.string().min(1),
    subject: z.string().optional(),
    subjectId: z.string().uuid().optional(),
    url: z.string().optional(),
    classId: z.string().uuid().optional(),
    folder: z.string().optional(),
    fileName: z.string().optional(),
    contentBase64: z.string().optional(),
    mimeType: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      let filePath: string | null = null;
      let fileName: string | null = req.body.fileName ?? null;
      let mimeType: string | null = req.body.mimeType ?? null;
      if (req.body.contentBase64 && req.body.fileName) {
        const { validateUpload } = await import("../middleware/upload");
        const { safeName, size } = validateUpload(req.body.fileName, req.body.mimeType, req.body.contentBase64);
        const buffer = Buffer.from(req.body.contentBase64, "base64");
        if (buffer.length !== size) throw new ConflictError("Invalid file payload");
        filePath = writeTenantFile(tenant.id, ["materials"], `${Date.now()}_${safeName}`, buffer);
        fileName = safeName;
        mimeType = req.body.mimeType ?? null;
      }
      const [row] = await db.insert(studentMaterials).values({
        tenantId: tenant.id,
        title: req.body.title,
        subject: req.body.subject ?? null,
        subjectId: req.body.subjectId ?? null,
        url: req.body.url || null,
        classId: req.body.classId ?? null,
        folder: req.body.folder ?? "general",
        filePath,
        fileName,
        mimeType,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/materials/:id/file", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [mat] = await db.select().from(studentMaterials).where(and(
      eq(studentMaterials.id, req.params.id),
      eq(studentMaterials.tenantId, tenant.id),
    )).limit(1);
    if (!mat?.filePath) throw new NotFoundError("File not found");
    res.sendFile(resolveTenantFile(tenant.id, mat.filePath));
  } catch (e) { next(e); }
});

router.delete("/materials/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(studentMaterials).where(and(eq(studentMaterials.id, req.params.id), eq(studentMaterials.tenantId, tenant.id)));
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/online-classes", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await listOnlineClassesForTenant(tenant.id);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/online-classes", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({
    title: z.string().min(1),
    url: z.string().url(),
    classId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    scheduledAt: z.string().optional(),
    durationMinutes: z.number().int().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const row = await insertOnlineClass(tenant.id, {
        title: req.body.title,
        url: req.body.url,
        classId: req.body.classId ?? null,
        subjectId: req.body.subjectId ?? null,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        durationMinutes: req.body.durationMinutes ?? 60,
      });
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/online-classes/:id/attendance", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const link = await getOnlineClassById(tenant.id, req.params.id);
    if (!link) throw new NotFoundError("Live class not found");
    const rows = await listOnlineClassAttendance(link.id, tenant.id);
    res.json({ success: true, data: { link, attendance: rows } });
  } catch (e) { next(e); }
});

router.post("/online-classes/:id/attendance", ...guard, requirePermission("academics.manage"),
  validate({
    body: z.object({
      records: z.array(z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "excused"]).default("present"),
        performanceScore: z.number().int().min(0).max(100).optional(),
        notes: z.string().optional(),
      })),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const link = await getOnlineClassById(tenant.id, req.params.id);
      if (!link) throw new NotFoundError("Live class not found");
      const saved = [];
      for (const rec of req.body.records) {
        const [existing] = await db.select().from(onlineClassAttendance).where(and(
          eq(onlineClassAttendance.onlineClassId, link.id),
          eq(onlineClassAttendance.studentId, rec.studentId),
        )).limit(1);
        if (existing) {
          const [row] = await db.update(onlineClassAttendance).set({
            status: rec.status,
            performanceScore: rec.performanceScore ?? null,
            notes: rec.notes ?? null,
            markedBy: user.id,
            joinedAt: existing.joinedAt ?? new Date(),
          }).where(eq(onlineClassAttendance.id, existing.id)).returning();
          saved.push(row);
        } else {
          const [row] = await db.insert(onlineClassAttendance).values({
            tenantId: tenant.id,
            onlineClassId: link.id,
            studentId: rec.studentId,
            status: rec.status,
            performanceScore: rec.performanceScore ?? null,
            notes: rec.notes ?? null,
            markedBy: user.id,
            joinedAt: new Date(),
          }).returning();
          saved.push(row);
        }
      }
      res.json({ success: true, data: saved });
    } catch (e) { next(e); }
  }
);

router.post("/online-classes/:id/init-roster", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const link = await getOnlineClassById(tenant.id, req.params.id);
    if (!link?.classId) throw new NotFoundError("Live class needs a class to load roster");
    const studentCols = await getTableColumns("students");
    const rosterConds = [
      eq(studentClassHistory.tenantId, tenant.id),
      eq(studentClassHistory.classId, link.classId),
      isNull(studentClassHistory.toDate),
    ];
    if (studentCols.has("deleted_at")) rosterConds.push(isNull(students.deletedAt));
    const classStudents = await db.select({ id: students.id })
      .from(studentClassHistory)
      .innerJoin(students, eq(students.id, studentClassHistory.studentId))
      .where(and(...rosterConds));
    const created = [];
    for (const s of classStudents) {
      const [ex] = await db.select().from(onlineClassAttendance).where(and(
        eq(onlineClassAttendance.onlineClassId, link.id),
        eq(onlineClassAttendance.studentId, s.id),
      )).limit(1);
      if (!ex) {
        const [row] = await db.insert(onlineClassAttendance).values({
          tenantId: tenant.id,
          onlineClassId: link.id,
          studentId: s.id,
          status: "absent",
        }).returning();
        created.push(row);
      }
    }
    res.json({ success: true, data: { initialized: created.length } });
  } catch (e) { next(e); }
});

router.post("/online-classes/:id/sync-attendance", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const link = await getOnlineClassById(tenant.id, req.params.id);
    if (!link?.classId) throw new NotFoundError("Class required to sync attendance");
    const sessionDate = link.scheduledAt ?? new Date();
    let sessionId = (link as { attendanceSessionId?: string }).attendanceSessionId;
    if (!sessionId) {
      const [session] = await db.insert(attendanceSessions).values({
        tenantId: tenant.id,
        classId: link.classId,
        date: sessionDate,
        periodNo: 99,
        takenBy: user.id,
      }).returning();
      sessionId = session.id;
      await setOnlineClassAttendanceSessionId(link.id, sessionId);
    }
    const oca = await db.select().from(onlineClassAttendance).where(eq(onlineClassAttendance.onlineClassId, link.id));
    let synced = 0;
    for (const row of oca) {
      const attStatus = row.status === "late" ? "late" : row.status === "absent" ? "absent" : "present";
      const [ex] = await db.select().from(attendanceRecords).where(and(
        eq(attendanceRecords.sessionId, sessionId!),
        eq(attendanceRecords.studentId, row.studentId),
      )).limit(1);
      if (ex) {
        await db.update(attendanceRecords).set({ status: attStatus as "present" | "absent" | "late" }).where(eq(attendanceRecords.id, ex.id));
      } else {
        await db.insert(attendanceRecords).values({
          tenantId: tenant.id,
          sessionId: sessionId!,
          studentId: row.studentId,
          status: attStatus as "present" | "absent" | "late",
        });
      }
      synced += 1;
    }
    res.json({ success: true, data: { sessionId, synced } });
  } catch (e) { next(e); }
});

router.delete("/online-classes/:id", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(onlineClassLinks).where(and(eq(onlineClassLinks.id, req.params.id), eq(onlineClassLinks.tenantId, tenant.id)));
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
