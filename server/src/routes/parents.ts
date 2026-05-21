import { Router } from "express";
import { db } from "../db";
import { guardians, studentGuardians, students, parentAccounts } from "../db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { z } from "zod";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const q = z.object({ search: z.string().optional() }).parse(req.query);

    const gWhere = [eq(guardians.tenantId, tenant.id)];
    if (q.search) {
      const s = `%${q.search}%`;
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
      .where(eq(students.tenantId, tenant.id));

    const links = allLinks.filter((l) => guardianIds.has(l.guardianId));

    const allAccounts = await db
      .select({ guardianId: parentAccounts.guardianId, email: parentAccounts.email, status: parentAccounts.status })
      .from(parentAccounts)
      .where(eq(parentAccounts.tenantId, tenant.id));

    const accounts = allAccounts.filter((a) => guardianIds.has(a.guardianId));

    const childrenByGuardian = new Map<string, typeof links>();
    for (const l of links) {
      const arr = childrenByGuardian.get(l.guardianId) ?? [];
      arr.push(l);
      childrenByGuardian.set(l.guardianId, arr);
    }
    const accountByGuardian = new Map(accounts.map((a) => [a.guardianId, a]));

    const data = guardianRows.map((g) => ({
      ...g,
      children: (childrenByGuardian.get(g.id) ?? []).map((c) => ({
        studentId: c.studentId,
        name: `${c.firstName} ${c.lastName}`,
        admissionNumber: c.admissionNumber,
        isPrimary: c.isPrimary,
      })),
      portalAccount: accountByGuardian.get(g.id) ?? null,
    }));

    res.json({ success: true, data });
  } catch (e) { next(e); }
});

export default router;
