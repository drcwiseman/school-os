import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  examGroups, examAcademicGroups, examAcademicGroupMembers, examTimetableSlots, examAdmitCards,
  assessments, marks, students, classes, subjects, studentClassHistory,
} from "../db/schema";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { percentToGrade, scoreToPercent, defaultRemarks } from "../services/exam-grading";
import {
  generateAdmitCardPdf, generateBulkAdmitCardsPdf, generateMarkSheetPdf,
  generateBulkResultSheetsPdf, generateAcademicPerformanceReportPdf,
} from "../services/pdf";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

function sendPdf(res: Response, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

// ─── Exam groups ───
router.get("/groups", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(examGroups).where(eq(examGroups.tenantId, tenant.id)).orderBy(desc(examGroups.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/groups", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ name: z.string(), groupType: z.enum(["term", "unit", "custom"]).optional(), termId: z.string().uuid().optional(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(examGroups).values({
        tenantId: tenant.id,
        name: req.body.name,
        groupType: req.body.groupType ?? "term",
        termId: req.body.termId,
        description: req.body.description,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/groups/:id", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ name: z.string().optional(), published: z.boolean().optional(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(examGroups).set(req.body).where(and(eq(examGroups.id, req.params.id), eq(examGroups.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("Exam group not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/groups/:id/assessments", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(assessments).where(and(
      eq(assessments.tenantId, tenant.id),
      eq(assessments.examGroupId, req.params.id),
      isNull(assessments.deletedAt),
    ));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// ─── Academic multi-groups ───
router.get("/academic-groups", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const groups = await db.select().from(examAcademicGroups).where(eq(examAcademicGroups.tenantId, tenant.id)).orderBy(desc(examAcademicGroups.createdAt));
    const members = await db.select().from(examAcademicGroupMembers).where(eq(examAcademicGroupMembers.tenantId, tenant.id));
    res.json({ success: true, data: groups.map((g) => ({ ...g, members: members.filter((m) => m.groupId === g.id) })) });
  } catch (e) { next(e); }
});

router.post("/academic-groups", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ name: z.string(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(examAcademicGroups).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.post("/academic-groups/:id/members", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ memberType: z.enum(["student", "subject", "class"]), memberId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [g] = await db.select().from(examAcademicGroups).where(and(eq(examAcademicGroups.id, req.params.id), eq(examAcademicGroups.tenantId, tenant.id))).limit(1);
      if (!g) throw new NotFoundError("Group not found");
      const [row] = await db.insert(examAcademicGroupMembers).values({
        tenantId: tenant.id, groupId: g.id, memberType: req.body.memberType, memberId: req.body.memberId,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/academic-groups/:groupId/members/:memberId", ...guard, requirePermission("exams.enter_marks"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(examAcademicGroupMembers).where(and(
      eq(examAcademicGroupMembers.id, req.params.memberId),
      eq(examAcademicGroupMembers.groupId, req.params.groupId),
      eq(examAcademicGroupMembers.tenantId, tenant.id),
    ));
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─── Timetable ───
router.get("/timetable", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const examGroupId = req.query.examGroupId as string | undefined;
    const classId = req.query.classId as string | undefined;
    const conditions = [eq(examTimetableSlots.tenantId, tenant.id)];
    if (examGroupId) conditions.push(eq(examTimetableSlots.examGroupId, examGroupId));
    if (classId) conditions.push(eq(examTimetableSlots.classId, classId));
    const rows = await db.select({
      slot: examTimetableSlots,
      className: classes.name,
      subjectName: subjects.name,
    }).from(examTimetableSlots)
      .innerJoin(classes, eq(examTimetableSlots.classId, classes.id))
      .innerJoin(subjects, eq(examTimetableSlots.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(examTimetableSlots.examDate);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/timetable", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({
    examGroupId: z.string().uuid().optional(),
    classId: z.string().uuid(),
    subjectId: z.string().uuid(),
    assessmentId: z.string().uuid().optional(),
    examDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    room: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(examTimetableSlots).values({
        tenantId: tenant.id,
        examGroupId: req.body.examGroupId,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        assessmentId: req.body.assessmentId,
        examDate: new Date(req.body.examDate),
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        room: req.body.room,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/timetable/:id", ...guard, requirePermission("exams.enter_marks"),
  validate({
    body: z.object({
      examDate: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      room: z.string().optional().nullable(),
      subjectId: z.string().uuid().optional(),
      classId: z.string().uuid().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.examDate) patch.examDate = new Date(patch.examDate as string);
      const [row] = await db.update(examTimetableSlots).set(patch).where(and(
        eq(examTimetableSlots.id, req.params.id),
        eq(examTimetableSlots.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Slot not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/timetable/:id", ...guard, requirePermission("exams.enter_marks"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await db.delete(examTimetableSlots).where(and(
      eq(examTimetableSlots.id, req.params.id),
      eq(examTimetableSlots.tenantId, tenant.id),
    ));
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.patch("/timetable/:id/publish", ...guard, requirePermission("exams.publish"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const publishAll = req.query.all === "1";
    if (publishAll && req.query.examGroupId) {
      const updated = await db.update(examTimetableSlots).set({ published: true }).where(and(
        eq(examTimetableSlots.tenantId, tenant.id),
        eq(examTimetableSlots.examGroupId, req.query.examGroupId as string),
      )).returning();
      return res.json({ success: true, data: { count: updated.length } });
    }
    const [row] = await db.update(examTimetableSlots).set({ published: true }).where(and(
      eq(examTimetableSlots.id, req.params.id), eq(examTimetableSlots.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Slot not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

// ─── Results: compute grades & publish ───
router.post("/results/compute", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ examGroupId: z.string().uuid().optional(), classId: z.string().uuid().optional(), assessmentId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      let assessmentIds: string[] = [];
      if (req.body.assessmentId) {
        assessmentIds = [req.body.assessmentId];
      } else {
        const conds = [eq(assessments.tenantId, tenant.id), isNull(assessments.deletedAt)];
        if (req.body.examGroupId) conds.push(eq(assessments.examGroupId, req.body.examGroupId));
        if (req.body.classId) conds.push(eq(assessments.classId, req.body.classId));
        const rows = await db.select({ id: assessments.id }).from(assessments).where(and(...conds));
        assessmentIds = rows.map((r) => r.id);
      }
      let updated = 0;
      for (const aid of assessmentIds) {
        const [a] = await db.select().from(assessments).where(eq(assessments.id, aid)).limit(1);
        if (!a) continue;
        const markRows = await db.select().from(marks).where(and(eq(marks.assessmentId, aid), eq(marks.tenantId, tenant.id), isNull(marks.deletedAt)));
        for (const m of markRows) {
          const pct = scoreToPercent(m.score, a.maxScore);
          const grade = pct != null ? percentToGrade(pct) : null;
          await db.update(marks).set({
            grade: grade ?? undefined,
            remarks: m.remarks ?? (grade ? defaultRemarks(grade) : undefined),
            updatedAt: new Date(),
          }).where(eq(marks.id, m.id));
          updated++;
        }
      }
      res.json({ success: true, data: { marksUpdated: updated } });
    } catch (e) { next(e); }
  },
);

router.post("/results/publish", ...guard, requirePermission("exams.publish"),
  validate({ body: z.object({ examGroupId: z.string().uuid().optional(), classId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const conds = [eq(assessments.tenantId, tenant.id), isNull(assessments.deletedAt)];
      if (req.body.examGroupId) conds.push(eq(assessments.examGroupId, req.body.examGroupId));
      if (req.body.classId) conds.push(eq(assessments.classId, req.body.classId));
      const ids = (await db.select({ id: assessments.id }).from(assessments).where(and(...conds))).map((r) => r.id);
      if (!ids.length) return res.json({ success: true, data: { published: 0 } });
      await db.update(assessments).set({ published: true }).where(inArray(assessments.id, ids));
      await db.update(marks).set({ status: "published" }).where(and(
        eq(marks.tenantId, tenant.id),
        inArray(marks.assessmentId, ids),
      ));
      res.json({ success: true, data: { assessmentsPublished: ids.length } });
    } catch (e) { next(e); }
  },
);

router.put("/assessments/:id/marks-detailed", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ entries: z.array(z.object({
    studentId: z.string().uuid(),
    score: z.number().int().min(0).nullable(),
    grade: z.string().optional(),
    remarks: z.string().optional(),
  })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id))).limit(1);
      if (!a) throw new NotFoundError("Assessment not found");
      for (const entry of req.body.entries) {
        const pct = entry.score != null ? scoreToPercent(entry.score, a.maxScore) : null;
        const grade = entry.grade ?? (pct != null ? percentToGrade(pct) : null);
        const remarks = entry.remarks ?? (grade ? defaultRemarks(grade) : null);
        const [existing] = await db.select().from(marks).where(and(eq(marks.assessmentId, a.id), eq(marks.studentId, entry.studentId))).limit(1);
        if (existing) {
          await db.update(marks).set({ score: entry.score, grade, remarks, enteredBy: user.id, updatedAt: new Date() }).where(eq(marks.id, existing.id));
        } else {
          await db.insert(marks).values({
            tenantId: tenant.id, assessmentId: a.id, studentId: entry.studentId,
            score: entry.score, grade, remarks, enteredBy: user.id,
          });
        }
      }
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

// ─── Admit cards ───
router.post("/admit-cards/issue", ...guard, requirePermission("exams.publish"),
  validate({ body: z.object({ examGroupId: z.string().uuid(), classId: z.string().uuid(), hall: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const enrolled = await db.select({ studentId: students.id })
        .from(studentClassHistory)
        .innerJoin(students, eq(students.id, studentClassHistory.studentId))
        .where(and(
          eq(studentClassHistory.tenantId, tenant.id),
          eq(studentClassHistory.classId, req.body.classId),
          isNull(studentClassHistory.toDate),
          isNull(students.deletedAt),
        ));
      let issued = 0;
      let seat = 1;
      for (const { studentId } of enrolled) {
        await db.insert(examAdmitCards).values({
          tenantId: tenant.id,
          examGroupId: req.body.examGroupId,
          studentId,
          hall: req.body.hall ?? "Main Hall",
          seatNo: String(seat++),
        }).onConflictDoNothing();
        issued++;
      }
      res.json({ success: true, data: { issued } });
    } catch (e) { next(e); }
  },
);

router.get("/admit-cards", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const examGroupId = z.string().uuid().parse(req.query.examGroupId);
    const rows = await db.select({
      card: examAdmitCards,
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
    }).from(examAdmitCards)
      .innerJoin(students, eq(examAdmitCards.studentId, students.id))
      .where(and(eq(examAdmitCards.tenantId, tenant.id), eq(examAdmitCards.examGroupId, examGroupId)));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// ─── PDF printing ───
router.get("/pdf/admit-card/:studentId", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const examGroupId = z.string().uuid().parse(req.query.examGroupId);
    const bytes = await generateAdmitCardPdf(tenant.id, examGroupId, req.params.studentId);
    sendPdf(res, bytes, `admit-${req.params.studentId.slice(0, 8)}.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/admit-cards/bulk", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const examGroupId = z.string().uuid().parse(req.query.examGroupId);
    const classId = req.query.classId ? z.string().uuid().parse(req.query.classId) : undefined;
    const bytes = await generateBulkAdmitCardsPdf(tenant.id, examGroupId, classId);
    sendPdf(res, bytes, `admit-cards-bulk.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/marksheet/:assessmentId", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateMarkSheetPdf(tenant.id, req.params.assessmentId);
    sendPdf(res, bytes, `marksheet-${req.params.assessmentId.slice(0, 8)}.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/results/bulk", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const termId = z.string().uuid().parse(req.query.termId);
    const classId = z.string().uuid().parse(req.query.classId);
    const examGroupId = req.query.examGroupId ? z.string().uuid().parse(req.query.examGroupId as string) : undefined;
    const academicGroupId = req.query.academicGroupId ? z.string().uuid().parse(req.query.academicGroupId as string) : undefined;
    const bytes = await generateBulkResultSheetsPdf(tenant.id, { termId, classId, examGroupId, academicGroupId });
    sendPdf(res, bytes, `results-bulk.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/academic-report", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const termId = z.string().uuid().parse(req.query.termId);
    const classId = z.string().uuid().parse(req.query.classId);
    const academicGroupId = req.query.academicGroupId ? z.string().uuid().parse(req.query.academicGroupId as string) : undefined;
    const bytes = await generateAcademicPerformanceReportPdf(tenant.id, termId, classId, academicGroupId);
    sendPdf(res, bytes, `academic-report.pdf`);
  } catch (e) { next(e); }
});

export default router;
