import { Router, Request } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  lessonPlans, schemeOfWork, teacherMeetings, portalMessages, assignmentSubmissions,
  substituteAssignments, cbtPapers, cbtQuestions, assessments, marks, students,
  teacherAssignments, classes, subjects, staff,
} from "../db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission, requireAnyPermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, ForbiddenError } from "../middleware/error";
import { TEACHER_WRITE_PERMISSIONS } from "../lib/teacher-permissions";
import { getTeacherWorkspace } from "../services/teacher-workspace";
import { generateLessonPlan, generateReportComment } from "../services/ai-teacher";
import { gradeSubmission } from "../services/ai-agents";
import { requireTenantFeature } from "../middleware/require-feature";

const router = Router();
const guard = [requireAuth, requireTenantMatch];
const teach = requireAnyPermission(...TEACHER_WRITE_PERMISSIONS);

async function userCanManageAcademics(req: Request) {
  const user = (req as any).user;
  if (!(req as any)._permissions) {
    const { getUserPermissions } = await import("../middleware/rbac");
    (req as any)._permissions = await getUserPermissions(user.id, user.tenantId);
  }
  return ((req as any)._permissions as string[]).includes("academics.manage");
}

router.get("/my-classes", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const rows = await db.select({
      classId: teacherAssignments.classId,
      subjectId: teacherAssignments.subjectId,
      className: classes.name,
      subjectName: subjects.name,
    })
      .from(teacherAssignments)
      .innerJoin(classes, eq(classes.id, teacherAssignments.classId))
      .leftJoin(subjects, eq(subjects.id, teacherAssignments.subjectId))
      .where(and(eq(teacherAssignments.tenantId, tenant.id), eq(teacherAssignments.userId, user.id)));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/colleagues", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      userId: staff.userId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      employeeNo: staff.employeeNo,
      department: staff.department,
    })
      .from(staff)
      .where(and(eq(staff.tenantId, tenant.id), isNull(staff.deletedAt)));
    res.json({
      success: true,
      data: rows.filter((r) => r.userId),
    });
  } catch (e) { next(e); }
});

router.get("/workspace", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const data = await getTeacherWorkspace(tenant.id, user.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get("/lesson-plans", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const { tableExists } = await import("../lib/table-columns");
    if (!(await tableExists("lesson_plans"))) return res.json({ success: true, data: [] });
    const rows = await db.select().from(lessonPlans)
      .where(and(eq(lessonPlans.tenantId, tenant.id), eq(lessonPlans.userId, user.id)))
      .orderBy(desc(lessonPlans.updatedAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/lesson-plans", ...guard, teach,
  validate({ body: z.object({ title: z.string(), content: z.string().optional(), classId: z.string().uuid().optional(), subjectId: z.string().uuid().optional(), weekNo: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(lessonPlans).values({
        tenantId: tenant.id, userId: user.id, title: req.body.title,
        content: req.body.content ?? "", classId: req.body.classId, subjectId: req.body.subjectId, weekNo: req.body.weekNo,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.post("/lesson-plans/ai-generate", ...guard, teach, requireTenantFeature("ai_homework"),
  validate({ body: z.object({ subject: z.string(), className: z.string(), topic: z.string(), durationMinutes: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const generated = await generateLessonPlan({ tenantId: tenant.id, ...req.body });
      res.json({ success: true, data: generated });
    } catch (e) { next(e); }
  }
);

router.patch("/lesson-plans/:id", ...guard, teach,
  validate({ body: z.object({ title: z.string().optional(), content: z.string().optional(), classId: z.string().uuid().optional().nullable(), subjectId: z.string().uuid().optional().nullable(), weekNo: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.update(lessonPlans).set({ ...req.body, updatedAt: new Date() }).where(and(
        eq(lessonPlans.id, req.params.id),
        eq(lessonPlans.tenantId, tenant.id),
        eq(lessonPlans.userId, user.id),
      )).returning();
      if (!row) throw new NotFoundError("Lesson plan not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/lesson-plans/:id", ...guard, teach, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [row] = await db.delete(lessonPlans).where(and(
      eq(lessonPlans.id, req.params.id),
      eq(lessonPlans.tenantId, tenant.id),
      eq(lessonPlans.userId, user.id),
    )).returning();
    if (!row) throw new NotFoundError("Lesson plan not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/scheme-of-work", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const { tableExists } = await import("../lib/table-columns");
    if (!(await tableExists("scheme_of_work"))) return res.json({ success: true, data: [] });
    const rows = await db.select().from(schemeOfWork)
      .where(and(eq(schemeOfWork.tenantId, tenant.id), eq(schemeOfWork.userId, user.id)))
      .orderBy(schemeOfWork.weekNo);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/scheme-of-work", ...guard, teach,
  validate({ body: z.object({ topic: z.string(), objectives: z.string().optional(), weekNo: z.number(), classId: z.string().uuid().optional(), subjectId: z.string().uuid().optional(), termId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(schemeOfWork).values({ tenantId: tenant.id, userId: user.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/scheme-of-work/:id", ...guard, teach,
  validate({ body: z.object({ topic: z.string().optional(), objectives: z.string().optional(), weekNo: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.update(schemeOfWork).set(req.body).where(and(
        eq(schemeOfWork.id, req.params.id),
        eq(schemeOfWork.tenantId, tenant.id),
        eq(schemeOfWork.userId, user.id),
      )).returning();
      if (!row) throw new NotFoundError("Scheme entry not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/scheme-of-work/:id", ...guard, teach, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [row] = await db.delete(schemeOfWork).where(and(
      eq(schemeOfWork.id, req.params.id),
      eq(schemeOfWork.tenantId, tenant.id),
      eq(schemeOfWork.userId, user.id),
    )).returning();
    if (!row) throw new NotFoundError("Scheme entry not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/meetings", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const { tableExists } = await import("../lib/table-columns");
    if (!(await tableExists("teacher_meetings"))) return res.json({ success: true, data: [] });
    const rows = await db.select().from(teacherMeetings)
      .where(and(eq(teacherMeetings.tenantId, tenant.id), eq(teacherMeetings.userId, user.id)))
      .orderBy(teacherMeetings.scheduledAt);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/meetings", ...guard, teach,
  validate({ body: z.object({ title: z.string(), scheduledAt: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(teacherMeetings).values({
        tenantId: tenant.id, userId: user.id, title: req.body.title,
        scheduledAt: new Date(req.body.scheduledAt), notes: req.body.notes,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/meetings/:id", ...guard, teach,
  validate({ body: z.object({ title: z.string().optional(), scheduledAt: z.string().optional(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const updates: Record<string, unknown> = { ...req.body };
      if (req.body.scheduledAt) updates.scheduledAt = new Date(req.body.scheduledAt);
      const [row] = await db.update(teacherMeetings).set(updates).where(and(
        eq(teacherMeetings.id, req.params.id),
        eq(teacherMeetings.tenantId, tenant.id),
        eq(teacherMeetings.userId, user.id),
      )).returning();
      if (!row) throw new NotFoundError("Meeting not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/meetings/:id", ...guard, teach, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [row] = await db.delete(teacherMeetings).where(and(
      eq(teacherMeetings.id, req.params.id),
      eq(teacherMeetings.tenantId, tenant.id),
      eq(teacherMeetings.userId, user.id),
    )).returning();
    if (!row) throw new NotFoundError("Meeting not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post("/ai/report-comment", ...guard, requirePermission("exams.enter_marks"), requireTenantFeature("ai_homework"),
  validate({ body: z.object({ studentName: z.string(), averageScore: z.number(), attendanceRate: z.number() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const comment = await generateReportComment({ tenantId: tenant.id, ...req.body });
      res.json({ success: true, data: { comment } });
    } catch (e) { next(e); }
  }
);

router.post("/ai/grade-submission", ...guard, requireAnyPermission("academics.teach", "academics.manage", "exams.enter_marks"), requireTenantFeature("ai_homework"),
  validate({ body: z.object({ submissionId: z.string().uuid(), maxPoints: z.number().default(100) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [sub] = await db.select().from(assignmentSubmissions)
        .where(and(eq(assignmentSubmissions.id, req.body.submissionId), eq(assignmentSubmissions.tenantId, tenant.id))).limit(1);
      if (!sub) throw new NotFoundError("Submission not found");
      const result = await gradeSubmission(tenant.id, sub.content ?? "", {
        maxPoints: req.body.maxPoints,
        criteria: [{ name: "Content", maxScore: req.body.maxPoints, description: "Overall quality" }],
      });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  }
);

router.get("/messages/:studentId", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(portalMessages)
      .where(and(eq(portalMessages.tenantId, tenant.id), eq(portalMessages.studentId, req.params.studentId)))
      .orderBy(portalMessages.createdAt);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/messages", ...guard, requirePermission("messaging.send"),
  validate({ body: z.object({ studentId: z.string().uuid(), body: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const { assertStaffCanMessageStudent } = await import("../services/portal-messaging");
      await assertStaffCanMessageStudent(tenant.id, user.id, req.body.studentId);
      const [row] = await db.insert(portalMessages).values({
        tenantId: tenant.id, studentId: req.body.studentId, senderType: "staff",
        staffUserId: user.id, body: req.body.body,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/messages/recipients", ...guard, requirePermission("messaging.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const { getTeacherMessageRecipients } = await import("../services/portal-messaging");
    const data = await getTeacherMessageRecipients(tenant.id, user.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get("/performance", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const myClasses = await db.select().from(teacherAssignments).where(and(eq(teacherAssignments.tenantId, tenant.id), eq(teacherAssignments.userId, user.id)));
    const classIds = myClasses.map((c) => c.classId);
    const graded = classIds.length
      ? await db.select({ count: sql<number>`count(*)` }).from(marks).where(and(eq(marks.tenantId, tenant.id), eq(marks.enteredBy, user.id), isNull(marks.deletedAt)))
      : [{ count: 0 }];
    res.json({
      success: true,
      data: {
        classCount: myClasses.length,
        marksEntered: Number(graded[0]?.count ?? 0),
        lessonPlans: (await db.select().from(lessonPlans).where(and(eq(lessonPlans.tenantId, tenant.id), eq(lessonPlans.userId, user.id)))).length,
      },
    });
  } catch (e) { next(e); }
});

router.get("/substitutes", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const manage = await userCanManageAcademics(req);
    const where = manage
      ? eq(substituteAssignments.tenantId, tenant.id)
      : and(
          eq(substituteAssignments.tenantId, tenant.id),
          sql`(${substituteAssignments.absentUserId} = ${user.id} OR ${substituteAssignments.substituteUserId} = ${user.id})`,
        );
    res.json({ success: true, data: await db.select().from(substituteAssignments).where(where).orderBy(desc(substituteAssignments.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/substitutes", ...guard, teach,
  validate({ body: z.object({ absentUserId: z.string().uuid(), substituteUserId: z.string().uuid(), classId: z.string().uuid().optional(), date: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      if (!await userCanManageAcademics(req) && req.body.absentUserId !== user.id) {
        throw new ForbiddenError("Teachers may only request substitutes for their own absence");
      }
      const [row] = await db.insert(substituteAssignments).values({
        tenantId: tenant.id,
        absentUserId: req.body.absentUserId,
        substituteUserId: req.body.substituteUserId,
        classId: req.body.classId,
        date: req.body.date,
        notes: req.body.notes,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.delete("/substitutes/:id", ...guard, teach, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const manage = await userCanManageAcademics(req);
    const [existing] = await db.select().from(substituteAssignments).where(and(
      eq(substituteAssignments.id, req.params.id),
      eq(substituteAssignments.tenantId, tenant.id),
    )).limit(1);
    if (!existing) throw new NotFoundError("Substitute request not found");
    if (!manage && existing.absentUserId !== user.id) throw new ForbiddenError("Not allowed");
    await db.delete(substituteAssignments).where(eq(substituteAssignments.id, req.params.id));
    res.json({ success: true, data: existing });
  } catch (e) { next(e); }
});

router.get("/cbt-papers", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const manage = await userCanManageAcademics(req);
    const where = manage
      ? eq(cbtPapers.tenantId, tenant.id)
      : and(eq(cbtPapers.tenantId, tenant.id), eq(cbtPapers.createdBy, user.id));
    res.json({ success: true, data: await db.select().from(cbtPapers).where(where).orderBy(desc(cbtPapers.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/cbt-papers", ...guard, teach,
  validate({ body: z.object({ title: z.string(), classId: z.string().uuid().optional(), subjectId: z.string().uuid().optional(), durationMinutes: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(cbtPapers).values({ tenantId: tenant.id, createdBy: user.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.patch("/cbt-papers/:id", ...guard, teach,
  validate({ body: z.object({ title: z.string().optional(), durationMinutes: z.number().optional(), published: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const manage = await userCanManageAcademics(req);
      const where = manage
        ? and(eq(cbtPapers.id, req.params.id), eq(cbtPapers.tenantId, tenant.id))
        : and(eq(cbtPapers.id, req.params.id), eq(cbtPapers.tenantId, tenant.id), eq(cbtPapers.createdBy, user.id));
      const [row] = await db.update(cbtPapers).set(req.body).where(where).returning();
      if (!row) throw new NotFoundError("CBT paper not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/cbt-papers/:id", ...guard, teach, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const manage = await userCanManageAcademics(req);
    const where = manage
      ? and(eq(cbtPapers.id, req.params.id), eq(cbtPapers.tenantId, tenant.id))
      : and(eq(cbtPapers.id, req.params.id), eq(cbtPapers.tenantId, tenant.id), eq(cbtPapers.createdBy, user.id));
    const [row] = await db.delete(cbtPapers).where(where).returning();
    if (!row) throw new NotFoundError("CBT paper not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.post("/cbt-papers/:id/questions", ...guard, teach,
  validate({ body: z.object({ prompt: z.string(), options: z.array(z.string()).min(2), correctIndex: z.number(), points: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const manage = await userCanManageAcademics(req);
      const [paper] = await db.select().from(cbtPapers).where(and(
        eq(cbtPapers.id, req.params.id),
        eq(cbtPapers.tenantId, tenant.id),
      )).limit(1);
      if (!paper) throw new NotFoundError("CBT paper not found");
      if (!manage && paper.createdBy !== user.id) throw new ForbiddenError("Not your paper");
      const [row] = await db.insert(cbtQuestions).values({
        tenantId: tenant.id,
        paperId: req.params.id,
        prompt: req.body.prompt,
        optionsJson: req.body.options,
        correctIndex: req.body.correctIndex,
        points: req.body.points ?? 1,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.delete("/cbt-papers/:paperId/questions/:questionId", ...guard, teach, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const manage = await userCanManageAcademics(req);
    const [paper] = await db.select().from(cbtPapers).where(and(eq(cbtPapers.id, req.params.paperId), eq(cbtPapers.tenantId, tenant.id))).limit(1);
    if (!paper) throw new NotFoundError("CBT paper not found");
    if (!manage && paper.createdBy !== user.id) throw new ForbiddenError("Not your paper");
    const [row] = await db.delete(cbtQuestions).where(and(
      eq(cbtQuestions.id, req.params.questionId),
      eq(cbtQuestions.paperId, req.params.paperId),
      eq(cbtQuestions.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Question not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/cbt-papers/:id/questions", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(cbtQuestions).where(and(eq(cbtQuestions.paperId, req.params.id), eq(cbtQuestions.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.get("/gradebook", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const my = await db.select().from(teacherAssignments).where(and(eq(teacherAssignments.tenantId, tenant.id), eq(teacherAssignments.userId, user.id)));
    const assessmentIds = new Set<string>();
    const rows = [];
    for (const ta of my) {
      if (!ta.subjectId) continue;
      const exams = await db.select({
        id: assessments.id,
        name: assessments.name,
        className: classes.name,
        subjectName: subjects.name,
      })
        .from(assessments)
        .innerJoin(classes, eq(classes.id, assessments.classId))
        .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
        .where(and(eq(assessments.tenantId, tenant.id), eq(assessments.classId, ta.classId), eq(assessments.subjectId, ta.subjectId), isNull(assessments.deletedAt)));
      for (const ex of exams) {
        if (!assessmentIds.has(ex.id)) {
          assessmentIds.add(ex.id);
          rows.push(ex);
        }
      }
    }
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

export default router;
