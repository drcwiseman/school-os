import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { libraryBooks, libraryCopies, libraryLoans, libraryFines, libraryEbooks, libraryReservations } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/books", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(libraryBooks).where(eq(libraryBooks.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/books", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ title: z.string(), author: z.string().optional(), isbn: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [book] = await db.insert(libraryBooks).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: book });
    } catch (e) { next(e); }
  }
);

router.post("/books/:id/copies", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ barcode: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [copy] = await db.insert(libraryCopies).values({ tenantId: tenant.id, bookId: req.params.id, barcode: req.body.barcode }).returning();
      res.status(201).json({ success: true, data: copy });
    } catch (e) { next(e); }
  }
);

router.get("/loans", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(libraryLoans).where(eq(libraryLoans.tenantId, tenant.id)).orderBy(desc(libraryLoans.loanedAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/loans", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ copyId: z.string().uuid(), studentId: z.string().uuid(), dueAt: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [copy] = await db.select().from(libraryCopies).where(and(eq(libraryCopies.id, req.body.copyId), eq(libraryCopies.tenantId, tenant.id))).limit(1);
      if (!copy) throw new NotFoundError("Copy not found");
      await db.update(libraryCopies).set({ status: "loaned" }).where(eq(libraryCopies.id, copy.id));
      const [loan] = await db.insert(libraryLoans).values({
        tenantId: tenant.id, copyId: copy.id, studentId: req.body.studentId,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : undefined,
      }).returning();
      res.status(201).json({ success: true, data: loan });
    } catch (e) { next(e); }
  }
);

router.get("/books/:id/copies", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(libraryCopies).where(and(eq(libraryCopies.bookId, req.params.id), eq(libraryCopies.tenantId, tenant.id))) });
  } catch (e) { next(e); }
});

router.get("/loans/overdue", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const now = new Date();
    const rows = await db.select().from(libraryLoans).where(and(
      eq(libraryLoans.tenantId, tenant.id),
      sql`${libraryLoans.returnedAt} is null`,
      sql`${libraryLoans.dueAt} < ${now}`,
    ));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/loans/:id/return", ...guard, requirePermission("library.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [loan] = await db.select().from(libraryLoans).where(and(eq(libraryLoans.id, req.params.id), eq(libraryLoans.tenantId, tenant.id))).limit(1);
    if (!loan) throw new NotFoundError("Loan not found");
    await db.update(libraryLoans).set({ returnedAt: new Date() }).where(eq(libraryLoans.id, loan.id));
    await db.update(libraryCopies).set({ status: "available" }).where(eq(libraryCopies.id, loan.copyId));
    if (loan.dueAt && loan.dueAt < new Date() && !loan.returnedAt) {
      const daysLate = Math.ceil((Date.now() - loan.dueAt.getTime()) / 86400000);
      const amount = daysLate * 500;
      await db.insert(libraryFines).values({ tenantId: tenant.id, loanId: loan.id, amount });
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/fines", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(libraryFines).where(eq(libraryFines.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.get("/ebooks", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(libraryEbooks).where(eq(libraryEbooks.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/ebooks", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ title: z.string(), author: z.string().optional(), url: z.string().url() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(libraryEbooks).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/reservations", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(libraryReservations).where(eq(libraryReservations.tenantId, tenant.id)).orderBy(desc(libraryReservations.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/reservations", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ studentId: z.string().uuid(), bookId: z.string().uuid().optional(), ebookId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(libraryReservations).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/analytics", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [stats] = await db.select({
      books: sql<number>`(select count(*) from library_books where tenant_id = ${tenant.id})`,
      activeLoans: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null)`,
      overdue: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null and ${libraryLoans.dueAt} < now())`,
      ebooks: sql<number>`(select count(*) from library_ebooks where tenant_id = ${tenant.id})`,
    }).from(libraryLoans).where(eq(libraryLoans.tenantId, tenant.id));
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
});

export default router;
