import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  portalAccounts, students, studentGuardians, invoices,
  reportCards, announcements, assignments, tenantSettings,
} from "../db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requirePortalAuth, createPortalSession, verifyPassword } from "../middleware/portal-auth";
import { validate } from "../utils/validate";
import { UnauthorizedError, NotFoundError } from "../middleware/error";
const router = Router();

router.post("/login", validate({ body: z.object({ email: z.string().email(), password: z.string() }) }), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [account] = await db.select().from(portalAccounts)
      .where(and(eq(portalAccounts.tenantId, tenant.id), eq(portalAccounts.email, req.body.email))).limit(1);
    if (!account || account.status !== "active") throw new UnauthorizedError("Invalid credentials");
    const valid = await verifyPassword(req.body.password, account.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");
    const session = await createPortalSession(account.id, tenant.id);
    res.cookie("portal_session_token", session.token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, account: { id: account.id, email: account.email, type: account.type } });
  } catch (e) { next(e); }
});

router.post("/logout", requirePortalAuth, async (_req, res) => {
  res.clearCookie("portal_session_token");
  res.json({ success: true });
});

router.get("/me", requirePortalAuth, async (req, res, next) => {
  try {
    const account = (req as any).portalAccount;
    res.json({ success: true, account: { id: account.id, email: account.email, type: account.type } });
  } catch (e) { next(e); }
});

router.get("/dashboard", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const account = (req as any).portalAccount;
    const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    const flags = (settings?.featureFlagsJson ?? {}) as Record<string, boolean>;
    const resultsVisible = flags.results_visible !== false;
    const feesMustBeClear = flags.fees_must_be_clear === true;

    if (account.type === "parent") {
      const links = await db.select({ studentId: studentGuardians.studentId }).from(studentGuardians).where(eq(studentGuardians.guardianId, account.guardianId!));
      const studentIds = links.map((l) => l.studentId);
      const children = studentIds.length
        ? await db.select().from(students).where(and(eq(students.tenantId, tenant.id), inArray(students.id, studentIds)))
        : [];
      let statements: any[] = [];
      if (studentIds.length) {
        statements = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenant.id), inArray(invoices.studentId, studentIds)));
      }
      const paidOk = !feesMustBeClear || statements.every((i) => i.status === "paid");
      const publishedCards = resultsVisible && paidOk && studentIds.length
        ? await db.select().from(reportCards).where(and(eq(reportCards.tenantId, tenant.id), inArray(reportCards.studentId, studentIds), eq(reportCards.published, true)))
        : [];
      const msgs = await db.select().from(announcements).where(and(eq(announcements.tenantId, tenant.id), eq(announcements.published, true))).orderBy(desc(announcements.createdAt)).limit(10);
      res.json({ success: true, data: { children, statements, reportCards: publishedCards, announcements: msgs } });
    } else {
      const [student] = await db.select().from(students).where(and(eq(students.id, account.studentId!), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const classAssignments = await db.select().from(assignments).where(and(eq(assignments.tenantId, tenant.id))).orderBy(desc(assignments.dueDate)).limit(20);
      let reportCard: unknown = null;
      if (resultsVisible) {
        const [rc] = await db.select().from(reportCards).where(and(eq(reportCards.studentId, student.id), eq(reportCards.published, true))).orderBy(desc(reportCards.createdAt)).limit(1);
        reportCard = rc ?? null;
      }
      res.json({ success: true, data: { student, assignments: classAssignments, reportCard } });
    }
  } catch (e) { next(e); }
});

export default router;
