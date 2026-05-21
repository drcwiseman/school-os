import { Router } from "express";
import { db } from "../db";
import { guardians, studentGuardians, students, parentAccounts } from "../db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, ConflictError } from "../middleware/error";
import { z } from "zod";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

const guardianBodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

const linkSchema = z.object({
  studentId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
});

async function loadGuardianDirectory(tenantId: string, search?: string) {
  const gWhere = [eq(guardians.tenantId, tenantId)];
  if (search) {
    const s = `%${search}%`;
    gWhere.push(or(
      ilike(guardians.firstName, s),
      ilike(guardians.lastName, s),
      ilike(guardians.email, s),
      ilike(guardians.phone, s),
    )!);
  }

  const guardianRows = await db
    .select()
    .from(guardians)
    .where(and(...gWhere))
    .orderBy(desc(guardians.createdAt))
    .limit(200);

  const guardianIds = new Set(guardianRows.map((g) => g.id));

  const allLinks = await db
    .select({
      guardianId: studentGuardians.guardianId,
      studentId: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      isPrimary: studentGuardians.isPrimary,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(studentGuardians.studentId, students.id))
    .where(eq(students.tenantId, tenantId));

  const links = allLinks.filter((l) => guardianIds.has(l.guardianId));

  const allAccounts = await db
    .select({ guardianId: parentAccounts.guardianId, email: parentAccounts.email, status: parentAccounts.status })
    .from(parentAccounts)
    .where(eq(parentAccounts.tenantId, tenantId));

  const accounts = allAccounts.filter((a) => guardianIds.has(a.guardianId));

  const childrenByGuardian = new Map<string, typeof links>();
  for (const l of links) {
    const arr = childrenByGuardian.get(l.guardianId) ?? [];
    arr.push(l);
    childrenByGuardian.set(l.guardianId, arr);
  }
  const accountByGuardian = new Map(accounts.map((a) => [a.guardianId, a]));

  return guardianRows.map((g) => ({
    ...g,
    children: (childrenByGuardian.get(g.id) ?? []).map((c) => ({
      studentId: c.studentId,
      name: `${c.firstName} ${c.lastName}`,
      admissionNumber: c.admissionNumber,
      isPrimary: c.isPrimary,
    })),
    portalAccount: accountByGuardian.get(g.id) ?? null,
  }));
}

router.get("/", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const q = z.object({ search: z.string().optional() }).parse(req.query);
    const data = await loadGuardianDirectory(tenant.id, q.search);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get("/:id", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.select().from(guardians).where(and(
      eq(guardians.id, req.params.id),
      eq(guardians.tenantId, tenant.id),
    )).limit(1);
    if (!row) throw new NotFoundError("Guardian not found");
    const enriched = await loadGuardianDirectory(tenant.id);
    const match = enriched.find((g) => g.id === row.id);
    res.json({ success: true, data: match ?? { ...row, children: [], portalAccount: null } });
  } catch (e) { next(e); }
});

router.post("/", ...guard, requirePermission("students.edit"),
  validate({ body: guardianBodySchema.extend({ studentId: z.string().uuid().optional(), isPrimary: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { studentId, isPrimary, ...body } = req.body;
      const [guardian] = await db.insert(guardians).values({
        tenantId: tenant.id,
        firstName: body.firstName,
        lastName: body.lastName,
        relationship: body.relationship,
        phone: body.phone ?? null,
        email: body.email || null,
        address: body.address ?? null,
      }).returning();

      if (studentId) {
        const [student] = await db.select().from(students).where(and(
          eq(students.id, studentId),
          eq(students.tenantId, tenant.id),
        )).limit(1);
        if (!student) throw new NotFoundError("Student not found");
        if (isPrimary) {
          await db.update(studentGuardians).set({ isPrimary: false }).where(eq(studentGuardians.studentId, studentId));
        }
        await db.insert(studentGuardians).values({
          studentId,
          guardianId: guardian.id,
          isPrimary: !!isPrimary,
        }).onConflictDoNothing();
      }

      const created = (await loadGuardianDirectory(tenant.id)).find((g) => g.id === guardian.id);
      res.status(201).json({ success: true, data: created ?? guardian });
    } catch (e) { next(e); }
  },
);

router.patch("/:id", ...guard, requirePermission("students.edit"),
  validate({ body: guardianBodySchema.partial() }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(guardians).where(and(
        eq(guardians.id, req.params.id),
        eq(guardians.tenantId, tenant.id),
      )).limit(1);
      if (!existing) throw new NotFoundError("Guardian not found");

      const patch: Record<string, unknown> = { ...req.body };
      if (patch.email === "") patch.email = null;

      const [updated] = await db.update(guardians).set(patch).where(eq(guardians.id, req.params.id)).returning();
      const enriched = (await loadGuardianDirectory(tenant.id)).find((g) => g.id === updated.id);
      res.json({ success: true, data: enriched ?? updated });
    } catch (e) { next(e); }
  },
);

router.delete("/:id", ...guard, requirePermission("students.edit"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [existing] = await db.select().from(guardians).where(and(
      eq(guardians.id, req.params.id),
      eq(guardians.tenantId, tenant.id),
    )).limit(1);
    if (!existing) throw new NotFoundError("Guardian not found");

    const [portal] = await db.select().from(parentAccounts).where(eq(parentAccounts.guardianId, req.params.id)).limit(1);
    if (portal) throw new ConflictError("Remove the parent portal account before deleting this guardian");

    await db.delete(guardians).where(eq(guardians.id, req.params.id));
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post("/:id/link", ...guard, requirePermission("students.edit"),
  validate({ body: linkSchema }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [guardian] = await db.select().from(guardians).where(and(
        eq(guardians.id, req.params.id),
        eq(guardians.tenantId, tenant.id),
      )).limit(1);
      if (!guardian) throw new NotFoundError("Guardian not found");

      const [student] = await db.select().from(students).where(and(
        eq(students.id, req.body.studentId),
        eq(students.tenantId, tenant.id),
      )).limit(1);
      if (!student) throw new NotFoundError("Student not found");

      if (req.body.isPrimary) {
        await db.update(studentGuardians).set({ isPrimary: false }).where(eq(studentGuardians.studentId, req.body.studentId));
      }
      await db.insert(studentGuardians).values({
        studentId: req.body.studentId,
        guardianId: req.params.id,
        isPrimary: req.body.isPrimary,
      }).onConflictDoNothing();

      const enriched = (await loadGuardianDirectory(tenant.id)).find((g) => g.id === req.params.id);
      res.json({ success: true, data: enriched });
    } catch (e) { next(e); }
  },
);

router.delete("/:id/link/:studentId", ...guard, requirePermission("students.edit"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [guardian] = await db.select().from(guardians).where(and(
      eq(guardians.id, req.params.id),
      eq(guardians.tenantId, tenant.id),
    )).limit(1);
    if (!guardian) throw new NotFoundError("Guardian not found");

    await db.delete(studentGuardians).where(and(
      eq(studentGuardians.guardianId, req.params.id),
      eq(studentGuardians.studentId, req.params.studentId),
    ));

    const enriched = (await loadGuardianDirectory(tenant.id)).find((g) => g.id === req.params.id);
    res.json({ success: true, data: enriched });
  } catch (e) { next(e); }
});

export default router;
