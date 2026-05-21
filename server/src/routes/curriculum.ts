import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  curriculumFrameworks, curriculumUnits, curriculumCompetencies, curriculumOutcomes,
  studentCompetencyTracking, curriculumCrossLinks, gradingScales, curriculumPacks,
  tenantSettings,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import {
  curriculumAnalytics,
  curriculumTablesReady,
  getCurriculumFrameworkById,
  insertCurriculumFramework,
  listCurriculumCompetencies,
  listCurriculumFrameworks,
  listCurriculumOutcomes,
  listCurriculumUnits,
} from "../lib/curriculum-query";
import { getTableColumns, tableExists } from "../lib/table-columns";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

export const FRAMEWORK_PRESETS = [
  { code: "cbc", name: "Competency-Based Curriculum (CBC)", examBoard: "KNEC" },
  { code: "cbe", name: "Competency-Based Education (CBE)", examBoard: null },
  { code: "british", name: "British National Curriculum", examBoard: "Cambridge" },
  { code: "american", name: "American Common Core", examBoard: null },
  { code: "uneb", name: "UNEB (Uganda)", examBoard: "UNEB" },
  { code: "custom", name: "Custom Framework", examBoard: null },
];

router.get("/status", ...guard, requirePermission("academics.view"), async (_req, res) => {
  const ready = await curriculumTablesReady();
  res.json({ success: true, data: { ready, repairHint: ready ? null : "npm run db:repair --prefix server" } });
});

router.get("/frameworks", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await listCurriculumFrameworks(tenant.id);
    res.json({ success: true, data: rows, presets: FRAMEWORK_PRESETS });
  } catch (e) { next(e); }
});

router.post("/frameworks", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ code: z.string(), name: z.string(), examBoard: z.string().optional(), version: z.string().optional(), active: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const row = await insertCurriculumFramework(tenant.id, {
        code: req.body.code,
        name: req.body.name,
        examBoard: req.body.examBoard,
        version: req.body.version ?? "1.0",
        active: req.body.active ?? true,
      });
      if (req.body.active && row) {
        const tsCols = await getTableColumns("tenant_settings");
        if (tsCols.has("curriculum_framework")) {
          await db.update(tenantSettings).set({ curriculumFramework: req.body.code }).where(eq(tenantSettings.tenantId, tenant.id));
        }
      }
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/frameworks/:id/activate", ...guard, requirePermission("academics.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const fw = await getCurriculumFrameworkById(tenant.id, req.params.id);
    if (!fw) throw new NotFoundError("Framework not found");
    const fwCols = await getTableColumns("curriculum_frameworks");
    if (fwCols.has("active")) {
      await db.update(curriculumFrameworks).set({ active: false }).where(eq(curriculumFrameworks.tenantId, tenant.id));
      await db.update(curriculumFrameworks).set({ active: true }).where(eq(curriculumFrameworks.id, fw.id));
    }
    const tsCols = await getTableColumns("tenant_settings");
    if (tsCols.has("curriculum_framework")) {
      await db.update(tenantSettings).set({ curriculumFramework: fw.code }).where(eq(tenantSettings.tenantId, tenant.id));
    }
    const updated = await getCurriculumFrameworkById(tenant.id, fw.id);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.get("/units", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const frameworkId = req.query.frameworkId as string | undefined;
    const rows = await listCurriculumUnits(tenant.id, frameworkId);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/units", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ frameworkId: z.string().uuid(), title: z.string(), subjectId: z.string().uuid().optional(), classId: z.string().uuid().optional(), termId: z.string().uuid().optional(), orderNo: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      if (!(await tableExists("curriculum_units"))) throw new NotFoundError("Curriculum tables missing — run db:repair");
      const [row] = await db.insert(curriculumUnits).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/competencies", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const frameworkId = req.query.frameworkId as string | undefined;
    const rows = await listCurriculumCompetencies(tenant.id, frameworkId);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/competencies", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ frameworkId: z.string().uuid(), code: z.string(), name: z.string(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      if (!(await tableExists("curriculum_competencies"))) throw new NotFoundError("Curriculum tables missing — run db:repair");
      const [row] = await db.insert(curriculumCompetencies).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/outcomes", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const unitId = req.query.unitId as string | undefined;
    const rows = await listCurriculumOutcomes(tenant.id, unitId);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/outcomes", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ unitId: z.string().uuid(), competencyId: z.string().uuid().optional(), description: z.string(), orderNo: z.number().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      if (!(await tableExists("curriculum_outcomes"))) throw new NotFoundError("Curriculum tables missing — run db:repair");
      const [row] = await db.insert(curriculumOutcomes).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/tracking", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    if (!(await tableExists("student_competency_tracking"))) return res.json({ success: true, data: [] });
    const studentId = req.query.studentId as string | undefined;
    const where = studentId
      ? and(eq(studentCompetencyTracking.tenantId, tenant.id), eq(studentCompetencyTracking.studentId, studentId))
      : eq(studentCompetencyTracking.tenantId, tenant.id);
    res.json({ success: true, data: await db.select().from(studentCompetencyTracking).where(where) });
  } catch (e) { next(e); }
});

router.put("/tracking", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), competencyId: z.string().uuid(), termId: z.string().uuid().optional(), level: z.string(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      if (!(await tableExists("student_competency_tracking"))) throw new NotFoundError("Curriculum tables missing — run db:repair");
      const [existing] = await db.select().from(studentCompetencyTracking).where(and(
        eq(studentCompetencyTracking.tenantId, tenant.id),
        eq(studentCompetencyTracking.studentId, req.body.studentId),
        eq(studentCompetencyTracking.competencyId, req.body.competencyId),
      )).limit(1);
      const payload = { ...req.body, tenantId: tenant.id, updatedAt: new Date() };
      const row = existing
        ? (await db.update(studentCompetencyTracking).set(payload).where(eq(studentCompetencyTracking.id, existing.id)).returning())[0]
        : (await db.insert(studentCompetencyTracking).values(payload).returning())[0];
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/cross-links", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    if (!(await tableExists("curriculum_cross_links"))) return res.json({ success: true, data: [] });
    res.json({ success: true, data: await db.select().from(curriculumCrossLinks).where(eq(curriculumCrossLinks.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/cross-links", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ fromUnitId: z.string().uuid(), toUnitId: z.string().uuid(), note: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(curriculumCrossLinks).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/grading-scales", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    if (!(await tableExists("grading_scales"))) return res.json({ success: true, data: [] });
    res.json({ success: true, data: await db.select().from(gradingScales).where(eq(gradingScales.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/grading-scales", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ frameworkId: z.string().uuid().optional(), name: z.string(), bandsJson: z.array(z.object({ label: z.string(), min: z.number(), max: z.number() })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(gradingScales).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/analytics", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const data = await curriculumAnalytics(tenant.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.post("/import-pack", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ name: z.string(), frameworkCode: z.string(), packJson: z.record(z.unknown()) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      if (!(await curriculumTablesReady())) throw new NotFoundError("Curriculum tables missing — run db:repair");
      const pack = req.body.packJson as { units?: { title: string; outcomes?: string[] }[]; competencies?: { code: string; name: string }[] };
      const preset = FRAMEWORK_PRESETS.find((p) => p.code === req.body.frameworkCode);
      const fw = await insertCurriculumFramework(tenant.id, {
        code: req.body.frameworkCode,
        name: preset?.name ?? req.body.name,
        examBoard: preset?.examBoard ?? undefined,
        active: true,
      });
      if (!fw) throw new Error("Failed to create framework");
      for (const c of pack.competencies ?? []) {
        await db.insert(curriculumCompetencies).values({ tenantId: tenant.id, frameworkId: fw.id, code: c.code, name: c.name });
      }
      for (const u of pack.units ?? []) {
        const [unit] = await db.insert(curriculumUnits).values({ tenantId: tenant.id, frameworkId: fw.id, title: u.title }).returning();
        for (const [i, desc] of (u.outcomes ?? []).entries()) {
          await db.insert(curriculumOutcomes).values({ tenantId: tenant.id, unitId: unit.id, description: desc, orderNo: i });
        }
      }
      let imp = null;
      if (await tableExists("curriculum_packs")) {
        [imp] = await db.insert(curriculumPacks).values({
          tenantId: tenant.id,
          name: req.body.name,
          frameworkCode: req.body.frameworkCode,
          packJson: req.body.packJson,
        }).returning();
      }
      res.status(201).json({ success: true, data: { framework: fw, import: imp } });
    } catch (e) { next(e); }
  },
);

router.post("/rollover", ...guard, requirePermission("academics.manage"),
  validate({ body: z.object({ frameworkId: z.string().uuid(), newVersion: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const src = await getCurriculumFrameworkById(tenant.id, req.body.frameworkId);
      if (!src) throw new NotFoundError("Framework not found");
      const fwCols = await getTableColumns("curriculum_frameworks");
      const values: Record<string, unknown> = {
        tenantId: tenant.id,
        code: `${src.code}_v${req.body.newVersion}`,
        name: `${src.name} (${req.body.newVersion})`,
        examBoard: src.examBoard ?? null,
        version: req.body.newVersion,
        active: false,
      };
      if (fwCols.has("settings_json") && (src as { settingsJson?: unknown }).settingsJson) {
        values.settingsJson = (src as { settingsJson?: unknown }).settingsJson;
      }
      const [clone] = await db.insert(curriculumFrameworks).values(values as any).returning();
      res.json({ success: true, data: clone, message: "New version created; copy units manually or re-import pack" });
    } catch (e) { next(e); }
  },
);

router.get("/teacher-map", ...guard, requirePermission("academics.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const units = await listCurriculumUnits(tenant.id);
    res.json({ success: true, data: { userId: user.id, units } });
  } catch (e) { next(e); }
});

router.get("/parent-summary", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const all = await listCurriculumFrameworks(tenant.id);
    const fw = all.find((f: { active?: boolean }) => f.active) ?? all[0];
    if (!fw) return res.json({ success: true, data: null });
    const units = await listCurriculumUnits(tenant.id, fw.id);
    res.json({ success: true, data: { framework: fw, units: units.slice(0, 20) } });
  } catch (e) { next(e); }
});

export default router;
