import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { tenantHelpArticles } from "../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { safeList } from "../lib/safe-route";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

const DEFAULT_ARTICLES = [
  { title: "Command Center overview", category: "getting-started", bodyMd: "Use the dashboard for KPIs, AI insights, and quick links to students, finance, and messaging." },
  { title: "Campus filtering", category: "multi-campus", bodyMd: "Select a campus in the header to scope students, classes, and finance lists." },
  { title: "Parent portal", category: "portal", bodyMd: "Parents log in at /s/your-school/portal/login to pay fees, view results, and message teachers." },
];

router.get("/", ...guard, safeList("help", DEFAULT_ARTICLES.map((a, i) => ({ ...a, sortOrder: i })), async (req) => {
  const tenant = (req as any).tenant;
  let rows = await db.select().from(tenantHelpArticles).where(eq(tenantHelpArticles.tenantId, tenant.id)).orderBy(asc(tenantHelpArticles.sortOrder));
  if (!rows.length) {
    rows = await db.insert(tenantHelpArticles).values(
      DEFAULT_ARTICLES.map((a, i) => ({ tenantId: tenant.id, ...a, sortOrder: i })),
    ).returning();
  }
  return rows;
}));

router.post("/", ...guard, requirePermission("settings.manage"), validate({
  body: z.object({ title: z.string().min(1), category: z.string().optional(), bodyMd: z.string(), sortOrder: z.number().optional() }),
}), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.insert(tenantHelpArticles).values({
      tenantId: tenant.id,
      title: req.body.title,
      category: req.body.category ?? "general",
      bodyMd: req.body.bodyMd,
      sortOrder: req.body.sortOrder ?? 0,
    }).returning();
    res.status(201).json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.patch("/:id", ...guard, requirePermission("settings.manage"), validate({
  body: z.object({
    title: z.string().min(1).optional(),
    category: z.string().optional(),
    bodyMd: z.string().optional(),
    sortOrder: z.number().optional(),
  }),
}), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.update(tenantHelpArticles).set(req.body).where(and(
      eq(tenantHelpArticles.id, req.params.id),
      eq(tenantHelpArticles.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Article not found");
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.delete("/:id", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.delete(tenantHelpArticles).where(and(
      eq(tenantHelpArticles.id, req.params.id),
      eq(tenantHelpArticles.tenantId, tenant.id),
    )).returning();
    if (!row) throw new NotFoundError("Article not found");
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
