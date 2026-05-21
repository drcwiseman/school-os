import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { classes } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { requireTenantFeature } from "../middleware/require-feature";
import { validate } from "../utils/validate";
import { getCampusId } from "../lib/campus-scope";
import {
  getAiUsageSummary,
  buildAtRiskList,
  buildFeeDefaultRisk,
  operationalRecommendations,
  summarizeReportText,
  adminAssistantReply,
  generateQuizQuestions,
  studyRecommendations,
} from "../services/ai-admin";
import { generateLessonPlan, generateReportComment } from "../services/ai-teacher";
import { buildCommandCenterKpis } from "../services/command-center";

const router = Router();
const guard = [requireAuth, requireTenantMatch, requireTenantFeature("ai_homework")];

router.get("/overview", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const campusId = getCampusId(req);
    const usage = await getAiUsageSummary(tenant.id);
    const atRisk = await buildAtRiskList(tenant.id, campusId, 8);
    const feeDefault = await buildFeeDefaultRisk(tenant.id, campusId);
    const kpis = await buildCommandCenterKpis(tenant.id, campusId);
    const recommendations = operationalRecommendations({
      atRisk: atRisk.length,
      feeDefault,
      pendingInvoices: kpis.finance.pendingInvoices,
      attendanceRate: kpis.academic.attendanceRateToday,
    });
    res.json({
      success: true,
      data: { usage, atRisk, feeDefault, recommendations, kpisPreview: { academic: kpis.academic, finance: kpis.finance } },
    });
  } catch (e) { next(e); }
});

router.get("/at-risk", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await buildAtRiskList(tenant.id, getCampusId(req), 25) });
  } catch (e) { next(e); }
});

router.get("/usage", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await getAiUsageSummary(tenant.id) });
  } catch (e) { next(e); }
});

router.post("/assistant", ...guard, requirePermission("settings.view"),
  validate({ body: z.object({ message: z.string().min(1).max(2000) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const campusId = getCampusId(req);
      const kpis = await buildCommandCenterKpis(tenant.id, campusId);
      const reply = await adminAssistantReply(tenant.id, req.body.message, {
        activeStudents: kpis.academic.activeStudents,
      });
      res.json({ success: true, data: { reply } });
    } catch (e) { next(e); }
  },
);

router.post("/summarize", ...guard, requirePermission("reports.view"),
  validate({ body: z.object({ text: z.string().min(10) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const summary = await summarizeReportText(tenant.id, req.body.text);
      res.json({ success: true, data: { summary } });
    } catch (e) { next(e); }
  },
);

router.post("/lesson-plan", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ subject: z.string(), className: z.string(), topic: z.string(), durationMinutes: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const plan = await generateLessonPlan({ tenantId: tenant.id, ...req.body });
      res.json({ success: true, data: plan });
    } catch (e) { next(e); }
  },
);

router.post("/quiz", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ topic: z.string(), count: z.number().int().min(1).max(20).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      res.json({ success: true, data: await generateQuizQuestions(tenant.id, req.body.topic, req.body.count ?? 5) });
    } catch (e) { next(e); }
  },
);

router.post("/report-comment", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ studentName: z.string(), averageScore: z.number(), attendanceRate: z.number() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const comment = await generateReportComment({ tenantId: tenant.id, ...req.body });
      res.json({ success: true, data: { comment } });
    } catch (e) { next(e); }
  },
);

router.post("/study-plan", ...guard, requirePermission("students.view"),
  validate({ body: z.object({ subject: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      res.json({ success: true, data: await studyRecommendations(tenant.id, req.body.subject) });
    } catch (e) { next(e); }
  },
);

router.get("/learning-path/:studentId", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [s] = await db.select().from(classes).where(eq(classes.tenantId, tenant.id)).limit(1);
    res.json({
      success: true,
      data: {
        steps: [
          { week: 1, focus: "Diagnostic review", subject: "Core" },
          { week: 2, focus: "Targeted practice", subject: "Core" },
          { week: 3, focus: "Assessment & feedback", subject: s?.name ?? "Class" },
        ],
      },
    });
  } catch (e) { next(e); }
});

export default router;
