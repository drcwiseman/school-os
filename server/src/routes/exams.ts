import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { assessments, marks, markSubmissions, moderationNotes, reportCards, students, classes, subjects } from "../db/schema";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import { softDeleteMark } from "../services/soft-delete";
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
    const rows = await db.select().from(assessments).where(eq(assessments.tenantId, tenant.id)).orderBy(desc(assessments.createdAt));
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

export default router;
