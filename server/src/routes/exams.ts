import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  assessments, marks, markSubmissions, moderationNotes, reportCards, students, classes, subjects,
  studentClassHistory, questionBanks, questionBankItems, gradingRules,
} from "../db/schema";
import { eq, and, desc, inArray, isNull, sql } from "drizzle-orm";
import { softDeleteMark, softDeleteAssessment } from "../services/soft-delete";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, BadRequestError } from "../middleware/error";
import { createAuditLog } from "../services/audit";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/assessments", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(assessments).where(and(eq(assessments.tenantId, tenant.id), isNull(assessments.deletedAt))).orderBy(desc(assessments.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/assessments", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ classId: z.string().uuid(), subjectId: z.string().uuid(), name: z.string(), type: z.string().optional(), weight: z.number().optional(), maxScore: z.number().optional(), termId: z.string().uuid().optional(), deadline: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(assessments).values({
        tenantId: tenant.id, classId: req.body.classId, subjectId: req.body.subjectId,
        name: req.body.name, type: req.body.type ?? "exam", weight: req.body.weight ?? 100,
        maxScore: req.body.maxScore ?? 100, termId: req.body.termId,
        deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/assessments/:id/roster", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id), isNull(assessments.deletedAt))).limit(1);
    if (!a) throw new NotFoundError("Assessment not found");
    const enrolled = await db
      .select({
        studentId: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      })
      .from(studentClassHistory)
      .innerJoin(students, eq(students.id, studentClassHistory.studentId))
      .where(and(
        eq(studentClassHistory.tenantId, tenant.id),
        eq(studentClassHistory.classId, a.classId),
        isNull(studentClassHistory.toDate),
        isNull(students.deletedAt),
      ));
    const existingMarks = await db.select().from(marks).where(and(eq(marks.assessmentId, a.id), eq(marks.tenantId, tenant.id), isNull(marks.deletedAt)));
    const markByStudent = new Map(existingMarks.map((m) => [m.studentId, m]));
    const roster = enrolled.map((s) => {
      const m = markByStudent.get(s.studentId);
      return { ...s, markId: m?.id, score: m?.score ?? null, status: m?.status ?? "draft" };
    });
    res.json({ success: true, data: { assessment: a, roster } });
  } catch (e) { next(e); }
});

router.get("/assessments/:id/marks", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id))).limit(1);
    if (!a) throw new NotFoundError("Assessment not found");
    const rows = await db.select().from(marks).where(and(eq(marks.assessmentId, a.id), eq(marks.tenantId, tenant.id), isNull(marks.deletedAt)));
    res.json({ success: true, data: { assessment: a, marks: rows } });
  } catch (e) { next(e); }
});

router.put("/assessments/:id/marks", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ entries: z.array(z.object({ studentId: z.string().uuid(), score: z.number().int().min(0).nullable() })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id))).limit(1);
      if (!a) throw new NotFoundError("Assessment not found");
      const [sub] = await db.select().from(markSubmissions).where(and(eq(markSubmissions.assessmentId, a.id), eq(markSubmissions.locked, true))).limit(1);
      if (sub && !user) throw new BadRequestError("Marks are locked");

      for (const entry of req.body.entries) {
        const [existing] = await db.select().from(marks).where(and(eq(marks.assessmentId, a.id), eq(marks.studentId, entry.studentId))).limit(1);
        if (existing?.status === "submitted") {
          await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "mark.edit_after_submit", entityType: "mark", entityId: existing.id, before: existing, after: { score: entry.score }, ip: req.ip });
        }
        if (existing) {
          await db.update(marks).set({ score: entry.score, updatedAt: new Date(), enteredBy: user.id }).where(eq(marks.id, existing.id));
        } else {
          await db.insert(marks).values({ tenantId: tenant.id, assessmentId: a.id, studentId: entry.studentId, score: entry.score, enteredBy: user.id });
        }
      }
      res.json({ success: true });
    } catch (e) { next(e); }
  }
);

router.post("/assessments/:id/submit", ...guard, requirePermission("exams.enter_marks"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id))).limit(1);
    if (!a) throw new NotFoundError("Assessment not found");
    await db.update(marks).set({ status: "submitted" }).where(and(eq(marks.assessmentId, a.id), eq(marks.tenantId, tenant.id)));
    const [sub] = await db.insert(markSubmissions).values({ tenantId: tenant.id, assessmentId: a.id, submittedBy: user.id, locked: true }).returning();
    res.json({ success: true, data: sub });
  } catch (e) { next(e); }
});

router.get("/moderation", ...guard, requirePermission("exams.moderate"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const subs = await db.select().from(markSubmissions).where(eq(markSubmissions.tenantId, tenant.id)).orderBy(desc(markSubmissions.submittedAt));
    res.json({ success: true, data: subs });
  } catch (e) { next(e); }
});

router.post("/assessments/:id/approve", ...guard, requirePermission("exams.moderate"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id))).limit(1);
    if (!a) throw new NotFoundError("Assessment not found");
    await db.update(marks).set({ status: "approved" }).where(and(eq(marks.assessmentId, a.id), eq(marks.tenantId, tenant.id)));
    await db.insert(moderationNotes).values({ tenantId: tenant.id, assessmentId: a.id, note: "Approved", createdBy: user.id });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post("/report-cards/generate", ...guard, requirePermission("exams.publish"),
  validate({ body: z.object({ termId: z.string().uuid(), classId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const classStudents = await db.select().from(students).where(and(eq(students.tenantId, tenant.id), eq(students.status, "active")));
      const classAssessments = await db.select().from(assessments).where(and(eq(assessments.tenantId, tenant.id), eq(assessments.classId, req.body.classId), eq(assessments.termId, req.body.termId)));
      const created = [];
      for (const stu of classStudents) {
        const stuMarks = await db.select().from(marks).where(and(eq(marks.studentId, stu.id), inArray(marks.assessmentId, classAssessments.map(a => a.id))));
        const total = stuMarks.reduce((s, m) => s + (m.score ?? 0), 0);
        const avg = classAssessments.length ? total / classAssessments.length : 0;
        const dataJson = { average: avg, marks: stuMarks, generatedAt: new Date().toISOString() };
        const [existing] = await db.select().from(reportCards).where(and(eq(reportCards.studentId, stu.id), eq(reportCards.termId, req.body.termId))).limit(1);
        const rc = existing
          ? (await db.update(reportCards).set({ dataJson }).where(eq(reportCards.id, existing.id)).returning())[0]
          : (await db.insert(reportCards).values({ tenantId: tenant.id, studentId: stu.id, termId: req.body.termId, dataJson }).returning())[0];
        created.push(rc);
      }
      res.json({ success: true, data: created });
    } catch (e) { next(e); }
  }
);

router.delete("/assessments/:id", ...guard, requirePermission("exams.moderate"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(assessments).where(and(eq(assessments.id, req.params.id), eq(assessments.tenantId, tenant.id), isNull(assessments.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Assessment not found");
    const updated = await softDeleteAssessment(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "assessment.soft_delete", entityType: "assessment", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.delete("/marks/:id", ...guard, requirePermission("exams.moderate"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(marks).where(and(eq(marks.id, req.params.id), eq(marks.tenantId, tenant.id), isNull(marks.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Mark not found");
    const updated = await softDeleteMark(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "mark.soft_delete", entityType: "mark", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/report-cards", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(reportCards).where(eq(reportCards.tenantId, tenant.id)).orderBy(desc(reportCards.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.patch("/report-cards/:id/publish", ...guard, requirePermission("exams.publish"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [rc] = await db.update(reportCards).set({ published: true }).where(and(eq(reportCards.id, req.params.id), eq(reportCards.tenantId, tenant.id))).returning();
    if (!rc) throw new NotFoundError("Report card not found");
    res.json({ success: true, data: rc });
  } catch (e) { next(e); }
});

router.post("/report-cards/bulk-publish", ...guard, requirePermission("exams.publish"),
  validate({ body: z.object({ termId: z.string().uuid(), classId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const where = req.body.classId
        ? and(eq(reportCards.tenantId, tenant.id), eq(reportCards.termId, req.body.termId))
        : and(eq(reportCards.tenantId, tenant.id), eq(reportCards.termId, req.body.termId));
      const updated = await db.update(reportCards).set({ published: true }).where(where).returning();
      res.json({ success: true, data: { count: updated.length } });
    } catch (e) { next(e); }
  },
);

// Question banks (113)
router.get("/question-banks", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(questionBanks).where(eq(questionBanks.tenantId, tenant.id)).orderBy(desc(questionBanks.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/question-banks", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ name: z.string(), subjectId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(questionBanks).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/question-banks/:id/items", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(questionBankItems).where(and(eq(questionBankItems.bankId, req.params.id), eq(questionBankItems.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.post("/question-banks/:id/items", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ prompt: z.string(), questionType: z.string().optional(), optionsJson: z.array(z.string()).optional(), correctIndex: z.number().optional(), points: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(questionBankItems).values({ tenantId: tenant.id, bankId: req.params.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

// Grading rules & GPA (115-116)
router.get("/grading-rules", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(gradingRules).where(eq(gradingRules.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/grading-rules", ...guard, requirePermission("exams.moderate"),
  validate({ body: z.object({ name: z.string(), classId: z.string().uuid().optional(), termId: z.string().uuid().optional(), rulesJson: z.array(z.object({ assessmentType: z.string(), weight: z.number() })), gpaScaleJson: z.record(z.number()).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(gradingRules).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/rankings", ...guard, requirePermission("exams.view"), async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const classId = z.string().uuid().parse(req.query.classId);
      const termId = req.query.termId ? z.string().uuid().parse(req.query.termId) : undefined;
      const classAssessments = await db.select().from(assessments).where(and(
        eq(assessments.tenantId, tenant.id),
        eq(assessments.classId, classId),
        isNull(assessments.deletedAt),
        termId ? eq(assessments.termId, termId) : sql`true`,
      ));
      const enrolled = await db.select({ studentId: students.id, firstName: students.firstName, lastName: students.lastName })
        .from(studentClassHistory)
        .innerJoin(students, eq(students.id, studentClassHistory.studentId))
        .where(and(eq(studentClassHistory.tenantId, tenant.id), eq(studentClassHistory.classId, classId), isNull(studentClassHistory.toDate)));
      const rankings = [];
      for (const s of enrolled) {
        const stuMarks = await db.select().from(marks).where(and(
          eq(marks.studentId, s.studentId),
          inArray(marks.assessmentId, classAssessments.map((a) => a.id)),
          isNull(marks.deletedAt),
        ));
        const total = stuMarks.reduce((sum, m) => sum + (m.score ?? 0), 0);
        rankings.push({ ...s, total, average: classAssessments.length ? total / classAssessments.length : 0 });
      }
      rankings.sort((a, b) => b.average - a.average);
      rankings.forEach((r, i) => (r as any).rank = i + 1);
      res.json({ success: true, data: rankings });
    } catch (e) { next(e); }
  });

router.get("/analytics", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const allMarks = await db.select({ score: marks.score, maxScore: assessments.maxScore })
      .from(marks)
      .innerJoin(assessments, eq(marks.assessmentId, assessments.id))
      .where(and(eq(marks.tenantId, tenant.id), isNull(marks.deletedAt), eq(marks.status, "approved")));
    const pct = allMarks.map((m) => (m.score ?? 0) / (m.maxScore || 100) * 100);
    const pass = pct.filter((p) => p >= 50).length;
    const buckets = { "0-39": 0, "40-59": 0, "60-79": 0, "80-100": 0 };
    for (const p of pct) {
      if (p < 40) buckets["0-39"]++;
      else if (p < 60) buckets["40-59"]++;
      else if (p < 80) buckets["60-79"]++;
      else buckets["80-100"]++;
    }
    res.json({ success: true, data: { totalMarks: pct.length, passRate: pct.length ? Math.round((pass / pct.length) * 100) : 0, distribution: buckets } });
  } catch (e) { next(e); }
});

router.get("/transcripts/:studentId", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [stu] = await db.select().from(students).where(and(eq(students.id, req.params.studentId), eq(students.tenantId, tenant.id))).limit(1);
    if (!stu) throw new NotFoundError("Student not found");
    const cards = await db.select().from(reportCards).where(and(eq(reportCards.studentId, stu.id), eq(reportCards.tenantId, tenant.id)));
    const allMarks = await db.select({ assessmentName: assessments.name, score: marks.score, maxScore: assessments.maxScore, termId: assessments.termId })
      .from(marks)
      .innerJoin(assessments, eq(marks.assessmentId, assessments.id))
      .where(and(eq(marks.studentId, stu.id), eq(marks.tenantId, tenant.id), isNull(marks.deletedAt)));
    res.json({ success: true, data: { student: stu, reportCards: cards, marks: allMarks } });
  } catch (e) { next(e); }
});

router.post("/marks/import", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ assessmentId: z.string().uuid(), rows: z.array(z.object({ admissionNumber: z.string(), score: z.number().int().nullable() })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [a] = await db.select().from(assessments).where(and(eq(assessments.id, req.body.assessmentId), eq(assessments.tenantId, tenant.id))).limit(1);
      if (!a) throw new NotFoundError("Assessment not found");
      let imported = 0;
      for (const row of req.body.rows) {
        const [stu] = await db.select().from(students).where(and(eq(students.tenantId, tenant.id), eq(students.admissionNumber, row.admissionNumber))).limit(1);
        if (!stu) continue;
        const [existing] = await db.select().from(marks).where(and(eq(marks.assessmentId, a.id), eq(marks.studentId, stu.id))).limit(1);
        if (existing) await db.update(marks).set({ score: row.score, enteredBy: user.id }).where(eq(marks.id, existing.id));
        else await db.insert(marks).values({ tenantId: tenant.id, assessmentId: a.id, studentId: stu.id, score: row.score, enteredBy: user.id });
        imported++;
      }
      res.json({ success: true, data: { imported } });
    } catch (e) { next(e); }
  },
);

router.get("/statutory-export", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const termId = req.query.termId as string | undefined;
    const rows = await db.select({
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      className: classes.name,
      assessment: assessments.name,
      score: marks.score,
      maxScore: assessments.maxScore,
    }).from(marks)
      .innerJoin(students, eq(marks.studentId, students.id))
      .innerJoin(assessments, eq(marks.assessmentId, assessments.id))
      .innerJoin(classes, eq(assessments.classId, classes.id))
      .where(and(eq(marks.tenantId, tenant.id), isNull(marks.deletedAt), termId ? eq(assessments.termId, termId) : sql`true`));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

export default router;
