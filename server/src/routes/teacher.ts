import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  lessonPlans, schemeOfWork, teacherMeetings, portalMessages, assignmentSubmissions,
  substituteAssignments, cbtPapers, cbtQuestions, assessments, marks, students,
  teacherAssignments, classes, subjects,
} from "../db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { getTeacherWorkspace } from "../services/teacher-workspace";
import { generateLessonPlan, generateReportComment } from "../services/ai-teacher";
import { gradeSubmission } from "../services/ai-agents";
import { requireTenantFeature } from "../middleware/require-feature";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

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

router.post("/lesson-plans", ...guard, requirePermission("academics.manage"),
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

router.post("/lesson-plans/ai-generate", ...guard, requirePermission("academics.manage"), requireTenantFeature("ai_homework"),
  validate({ body: z.object({ subject: z.string(), className: z.string(), topic: z.string(), durationMinutes: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const generated = await generateLessonPlan({ tenantId: tenant.id, ...req.body });
      res.json({ success: true, data: generated });
    } catch (e) { next(e); }
  }
);

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

router.post("/scheme-of-work", ...guard, requirePermission("academics.manage"),
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

router.post("/meetings", ...guard, requirePermission("academics.manage"),
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

router.post("/ai/grade-submission", ...guard, requirePermission("academics.manage"), requireTenantFeature("ai_homework"),
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
      const [row] = await db.insert(portalMessages).values({
        tenantId: tenant.id, studentId: req.body.studentId, senderType: "staff",
        staffUserId: user.id, body: req.body.body,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

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
    res.json({ success: true, data: await db.select().from(substituteAssignments).where(eq(substituteAssignments.tenantId, tenant.id)).orderBy(desc(substituteAssignments.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/substitutes", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ absentUserId: z.string().uuid(), substituteUserId: z.string().uuid(), classId: z.string().uuid().optional(), date: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(substituteAssignments).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/cbt-papers", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(cbtPapers).where(eq(cbtPapers.tenantId, tenant.id)).orderBy(desc(cbtPapers.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/cbt-papers", ...guard, requirePermission("academics.manage"),
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

router.post("/cbt-papers/:id/questions", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ prompt: z.string(), options: z.array(z.string()).min(2), correctIndex: z.number(), points: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
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
