import { Router, Request } from "express";
import { z } from "zod";
import { db } from "../db";
import { cbtPapers, cbtQuestions, cbtSessions, cbtAnswers, students } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, BadRequestError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

router.get("/papers", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(cbtPapers).where(eq(cbtPapers.tenantId, tenant.id)).orderBy(desc(cbtPapers.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/papers", ...guard, requirePermission("exams.enter_marks"),
  validate({
    body: z.object({
      title: z.string(),
      classId: z.string().uuid().optional(),
      subjectId: z.string().uuid().optional(),
      termId: z.string().uuid().optional(),
      durationMinutes: z.number().optional(),
      mode: z.enum(["practice", "graded"]).optional(),
      randomize: z.boolean().optional(),
      lockdown: z.boolean().optional(),
      published: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(cbtPapers).values({
        tenantId: tenant.id,
        createdBy: user.id,
        title: req.body.title,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        termId: req.body.termId,
        durationMinutes: req.body.durationMinutes ?? 60,
        mode: req.body.mode ?? "graded",
        randomize: req.body.randomize ?? false,
        lockdown: req.body.lockdown ?? false,
        published: req.body.published ?? false,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/papers/:id", ...guard, requirePermission("exams.enter_marks"),
  validate({ body: z.object({ published: z.boolean().optional(), randomize: z.boolean().optional(), lockdown: z.boolean().optional(), mode: z.enum(["practice", "graded"]).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(cbtPapers).set(req.body).where(and(eq(cbtPapers.id, req.params.id), eq(cbtPapers.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("Paper not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.post("/papers/:id/questions", ...guard, requirePermission("exams.enter_marks"),
  validate({
    body: z.object({
      prompt: z.string(),
      questionType: z.enum(["mcq", "essay", "file"]).default("mcq"),
      optionsJson: z.array(z.string()).optional(),
      correctIndex: z.number().optional(),
      points: z.number().optional(),
      orderNo: z.number().optional(),
      maxWords: z.number().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [paper] = await db.select().from(cbtPapers).where(and(eq(cbtPapers.id, req.params.id), eq(cbtPapers.tenantId, tenant.id))).limit(1);
      if (!paper) throw new NotFoundError("Paper not found");
      const [row] = await db.insert(cbtQuestions).values({
        tenantId: tenant.id,
        paperId: paper.id,
        prompt: req.body.prompt,
        questionType: req.body.questionType,
        optionsJson: req.body.optionsJson ?? [],
        correctIndex: req.body.correctIndex ?? 0,
        points: req.body.points ?? 1,
        orderNo: req.body.orderNo ?? 0,
        maxWords: req.body.maxWords,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/papers/:id/questions", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(cbtQuestions).where(and(eq(cbtQuestions.paperId, req.params.id), eq(cbtQuestions.tenantId, tenant.id))).orderBy(cbtQuestions.orderNo);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

/** Student: list available published exams */
router.get("/available", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const studentId = (req as any).portalStudentId ?? req.query.studentId;
    if (!studentId) return res.json({ success: true, data: [] });
    const rows = await db.select().from(cbtPapers).where(and(
      eq(cbtPapers.tenantId, tenant.id),
      eq(cbtPapers.published, true),
    ));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/sessions/start", ...guard,
  validate({ body: z.object({ paperId: z.string().uuid(), studentId: z.string().uuid() }) }),
  async (req: Request, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [paper] = await db.select().from(cbtPapers).where(and(eq(cbtPapers.id, req.body.paperId), eq(cbtPapers.tenantId, tenant.id), eq(cbtPapers.published, true))).limit(1);
      if (!paper) throw new NotFoundError("Exam not available");
      const endsAt = new Date(Date.now() + paper.durationMinutes * 60 * 1000);
      const [session] = await db.insert(cbtSessions).values({
        tenantId: tenant.id,
        paperId: paper.id,
        studentId: req.body.studentId,
        endsAt,
        ipAddress: req.ip,
        deviceFingerprint: (req.headers["x-device-fingerprint"] as string) ?? undefined,
        maxScore: 0,
      }).returning();
      const questions = await db.select().from(cbtQuestions).where(eq(cbtQuestions.paperId, paper.id));
      const maxScore = questions.reduce((s, q) => s + q.points, 0);
      await db.update(cbtSessions).set({ maxScore }).where(eq(cbtSessions.id, session.id));
      let qs = questions.map((q) => ({ id: q.id, prompt: q.prompt, questionType: q.questionType, optionsJson: q.optionsJson, points: q.points, maxWords: q.maxWords }));
      if (paper.randomize) qs = shuffle(qs);
      res.status(201).json({
        success: true,
        data: {
          session: { ...session, maxScore },
          paper: { id: paper.id, title: paper.title, durationMinutes: paper.durationMinutes, lockdown: paper.lockdown, mode: paper.mode },
          questions: qs,
        },
      });
    } catch (e) { next(e); }
  },
);

router.post("/sessions/:id/answer", ...guard,
  validate({ body: z.object({ questionId: z.string().uuid(), answer: z.union([z.number(), z.string(), z.record(z.unknown())]) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [session] = await db.select().from(cbtSessions).where(and(eq(cbtSessions.id, req.params.id), eq(cbtSessions.tenantId, tenant.id), eq(cbtSessions.status, "in_progress"))).limit(1);
      if (!session) throw new NotFoundError("Session not found");
      if (session.endsAt && new Date() > session.endsAt) throw new BadRequestError("Time expired");
      const [q] = await db.select().from(cbtQuestions).where(and(eq(cbtQuestions.id, req.body.questionId), eq(cbtQuestions.paperId, session.paperId))).limit(1);
      if (!q) throw new NotFoundError("Question not found");
      let score: number | null = null;
      if (q.questionType === "mcq" && typeof req.body.answer === "number") {
        score = req.body.answer === q.correctIndex ? q.points : 0;
      }
      const [existing] = await db.select().from(cbtAnswers).where(and(eq(cbtAnswers.sessionId, session.id), eq(cbtAnswers.questionId, q.id))).limit(1);
      const payload = { answerJson: req.body.answer, score };
      if (existing) {
        await db.update(cbtAnswers).set(payload).where(eq(cbtAnswers.id, existing.id));
      } else {
        await db.insert(cbtAnswers).values({ tenantId: tenant.id, sessionId: session.id, questionId: q.id, ...payload });
      }
      res.json({ success: true, data: { autoScore: score } });
    } catch (e) { next(e); }
  },
);

router.post("/sessions/:id/submit", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [session] = await db.select().from(cbtSessions).where(and(eq(cbtSessions.id, req.params.id), eq(cbtSessions.tenantId, tenant.id))).limit(1);
    if (!session) throw new NotFoundError("Session not found");
    const answers = await db.select().from(cbtAnswers).where(eq(cbtAnswers.sessionId, session.id));
    const objectiveScore = answers.reduce((s, a) => s + (a.score ?? 0), 0);
    const subjective = answers.filter((a) => a.score == null);
    const status = subjective.length > 0 ? "pending_grading" : "graded";
    const [updated] = await db.update(cbtSessions).set({
      submittedAt: new Date(),
      status,
      score: status === "graded" ? objectiveScore : objectiveScore,
    }).where(eq(cbtSessions.id, session.id)).returning();
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.get("/grading-queue", ...guard, requirePermission("exams.moderate"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const sessions = await db.select().from(cbtSessions).where(and(eq(cbtSessions.tenantId, tenant.id), eq(cbtSessions.status, "pending_grading"))).orderBy(desc(cbtSessions.submittedAt));
    res.json({ success: true, data: sessions });
  } catch (e) { next(e); }
});

router.post("/sessions/:id/grade-answer", ...guard, requirePermission("exams.moderate"),
  validate({ body: z.object({ answerId: z.string().uuid(), score: z.number().int().min(0) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      await db.update(cbtAnswers).set({ score: req.body.score, gradedAt: new Date(), gradedBy: user.id }).where(and(eq(cbtAnswers.id, req.body.answerId), eq(cbtAnswers.tenantId, tenant.id)));
      const answers = await db.select().from(cbtAnswers).where(eq(cbtAnswers.sessionId, req.params.id));
      const allGraded = answers.every((a) => a.score != null);
      if (allGraded) {
        const total = answers.reduce((s, a) => s + (a.score ?? 0), 0);
        await db.update(cbtSessions).set({ status: "graded", score: total }).where(eq(cbtSessions.id, req.params.id));
      }
      res.json({ success: true });
    } catch (e) { next(e); }
  },
);

router.get("/analytics/:paperId", ...guard, requirePermission("exams.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const sessions = await db.select().from(cbtSessions).where(and(eq(cbtSessions.paperId, req.params.paperId), eq(cbtSessions.tenantId, tenant.id), eq(cbtSessions.status, "graded")));
    const avg = sessions.length ? sessions.reduce((s, x) => s + (x.score ?? 0), 0) / sessions.length : 0;
    const questions = await db.select().from(cbtQuestions).where(eq(cbtQuestions.paperId, req.params.paperId));
    const itemStats = [];
    for (const q of questions) {
      const ans = await db.select({ score: cbtAnswers.score }).from(cbtAnswers).innerJoin(cbtSessions, eq(cbtAnswers.sessionId, cbtSessions.id))
        .where(and(eq(cbtAnswers.questionId, q.id), eq(cbtSessions.status, "graded")));
      const correct = ans.filter((a) => (a.score ?? 0) >= q.points).length;
      itemStats.push({ questionId: q.id, prompt: q.prompt.slice(0, 80), attempts: ans.length, correctRate: ans.length ? Math.round((correct / ans.length) * 100) : 0 });
    }
    res.json({ success: true, data: { sessions: sessions.length, averageScore: Math.round(avg), itemStats } });
  } catch (e) { next(e); }
});

export default router;
