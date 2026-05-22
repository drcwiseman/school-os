import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  libraryBooks, libraryCopies, libraryLoans, libraryFines, libraryEbooks, libraryReservations, libraryCards,
  students, staff,
} from "../db/schema";
import { eq, and, desc, asc, sql, isNull, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { safeList } from "../lib/safe-route";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/books", ...guard, requirePermission("library.view"), safeList("library-books", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select().from(libraryBooks).where(eq(libraryBooks.tenantId, tenant.id));
}));

router.get("/books/enriched", ...guard, requirePermission("library.view"), safeList("library-books-enriched", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select({
    id: libraryBooks.id,
    title: libraryBooks.title,
    author: libraryBooks.author,
    isbn: libraryBooks.isbn,
    createdAt: libraryBooks.createdAt,
    totalCopies: sql<number>`coalesce((select count(*)::int from library_copies c where c.book_id = ${libraryBooks.id} and c.tenant_id = ${tenant.id}), 0)`,
    availableCopies: sql<number>`coalesce((select count(*)::int from library_copies c where c.book_id = ${libraryBooks.id} and c.tenant_id = ${tenant.id} and c.status = 'available'), 0)`,
  }).from(libraryBooks).where(eq(libraryBooks.tenantId, tenant.id)).orderBy(asc(libraryBooks.title));
}));

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

router.patch("/books/:id", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ title: z.string().optional(), author: z.string().optional(), isbn: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [book] = await db.update(libraryBooks).set(req.body).where(and(
        eq(libraryBooks.id, req.params.id),
        eq(libraryBooks.tenantId, tenant.id),
      )).returning();
      if (!book) throw new NotFoundError("Book not found");
      res.json({ success: true, data: book });
    } catch (e) { next(e); }
  },
);

router.delete("/books/:id", ...guard, requirePermission("library.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const copies = await db.select({ id: libraryCopies.id }).from(libraryCopies).where(and(
      eq(libraryCopies.bookId, req.params.id),
      eq(libraryCopies.tenantId, tenant.id),
    ));
    const copyIds = copies.map((c) => c.id);
    if (copyIds.length) {
      const [active] = await db.select({ n: sql<number>`count(*)` }).from(libraryLoans).where(and(
        eq(libraryLoans.tenantId, tenant.id),
        inArray(libraryLoans.copyId, copyIds),
        isNull(libraryLoans.returnedAt),
      ));
      if (Number(active?.n ?? 0) > 0) {
        return res.status(400).json({ success: false, message: "Return all active loans before deleting this book" });
      }
      await db.delete(libraryLoans).where(and(eq(libraryLoans.tenantId, tenant.id), inArray(libraryLoans.copyId, copyIds)));
      await db.delete(libraryCopies).where(and(eq(libraryCopies.tenantId, tenant.id), inArray(libraryCopies.id, copyIds)));
    }
    const [book] = await db.delete(libraryBooks).where(and(
      eq(libraryBooks.id, req.params.id),
      eq(libraryBooks.tenantId, tenant.id),
    )).returning();
    if (!book) throw new NotFoundError("Book not found");
    res.json({ success: true, data: book });
  } catch (e) { next(e); }
});

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

router.patch("/copies/:id", ...guard, requirePermission("library.manage"),
  validate({ body: z.object({ barcode: z.string().optional(), status: z.enum(["available", "loaned", "lost", "damaged"]).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(libraryCopies).where(and(
        eq(libraryCopies.id, req.params.id),
        eq(libraryCopies.tenantId, tenant.id),
      )).limit(1);
      if (!existing) throw new NotFoundError("Copy not found");
      if (req.body.status && req.body.status !== existing.status) {
        const [active] = await db.select({ n: sql<number>`count(*)` }).from(libraryLoans).where(and(
          eq(libraryLoans.copyId, existing.id),
          eq(libraryLoans.tenantId, tenant.id),
          isNull(libraryLoans.returnedAt),
        ));
        if (Number(active?.n ?? 0) > 0) {
          return res.status(400).json({ success: false, message: "Return the active loan before changing copy status" });
        }
      }
      const [copy] = await db.update(libraryCopies).set(req.body).where(and(
        eq(libraryCopies.id, req.params.id),
        eq(libraryCopies.tenantId, tenant.id),
      )).returning();
      res.json({ success: true, data: copy });
    } catch (e) { next(e); }
  },
);

router.delete("/copies/:id", ...guard, requirePermission("library.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [existing] = await db.select().from(libraryCopies).where(and(
      eq(libraryCopies.id, req.params.id),
      eq(libraryCopies.tenantId, tenant.id),
    )).limit(1);
    if (!existing) throw new NotFoundError("Copy not found");
    const [active] = await db.select({ n: sql<number>`count(*)` }).from(libraryLoans).where(and(
      eq(libraryLoans.copyId, existing.id),
      eq(libraryLoans.tenantId, tenant.id),
      isNull(libraryLoans.returnedAt),
    ));
    if (Number(active?.n ?? 0) > 0) {
      return res.status(400).json({ success: false, message: "Return the active loan before deleting this copy" });
    }
    await db.delete(libraryLoans).where(and(eq(libraryLoans.tenantId, tenant.id), eq(libraryLoans.copyId, existing.id)));
    const [copy] = await db.delete(libraryCopies).where(and(
      eq(libraryCopies.id, req.params.id),
      eq(libraryCopies.tenantId, tenant.id),
    )).returning();
    res.json({ success: true, data: copy });
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

/** Dashboard + enriched loans (also in library-enhancements; duplicated here for VPS deploys). */
router.get("/dashboard", ...guard, requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const data: Record<string, unknown> = {
      books: 0,
      copies: { total: 0, available: 0, loaned: 0 },
      loans: { active: 0, overdue: 0 },
      cards: { total: 0, active: 0 },
      unpaidFines: 0,
    };
    try {
      const [books] = await db.select({ n: sql<number>`count(*)` }).from(libraryBooks).where(eq(libraryBooks.tenantId, tenant.id));
      data.books = Number(books?.n ?? 0);
    } catch { /* ignore */ }
    try {
      const [copies] = await db.select({
        total: sql<number>`count(*)`,
        available: sql<number>`count(*) filter (where ${libraryCopies.status} = 'available')`,
        loaned: sql<number>`count(*) filter (where ${libraryCopies.status} = 'loaned')`,
      }).from(libraryCopies).where(eq(libraryCopies.tenantId, tenant.id));
      data.copies = copies;
    } catch { /* ignore */ }
    try {
      const [loans] = await db.select({
        active: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null)`,
        overdue: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null and ${libraryLoans.dueAt} < now())`,
      }).from(libraryLoans).where(eq(libraryLoans.tenantId, tenant.id));
      data.loans = loans;
    } catch { /* ignore */ }
    try {
      const [cards] = await db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${libraryCards.status} = 'active')`,
      }).from(libraryCards).where(eq(libraryCards.tenantId, tenant.id));
      data.cards = cards;
    } catch { /* ignore */ }
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get("/loans/enriched", ...guard, requirePermission("library.view"), safeList("library-loans-enriched", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select({
    loan: libraryLoans,
    copy: libraryCopies,
    book: libraryBooks,
    student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
    staffMember: { firstName: staff.firstName, lastName: staff.lastName, employeeNo: staff.employeeNo },
    card: { cardNumber: libraryCards.cardNumber },
  }).from(libraryLoans)
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryBooks, eq(libraryCopies.bookId, libraryBooks.id))
    .leftJoin(students, eq(libraryLoans.studentId, students.id))
    .leftJoin(staff, eq(libraryLoans.staffId, staff.id))
    .leftJoin(libraryCards, eq(libraryLoans.libraryCardId, libraryCards.id))
    .where(eq(libraryLoans.tenantId, tenant.id))
    .orderBy(desc(libraryLoans.loanedAt))
    .limit(200);
}));

router.get("/lookup/copies", ...guard, requirePermission("library.view"), safeList("library-lookup-copies", [], async (req) => {
  const tenant = (req as any).tenant;
  return db.select({
    copy: libraryCopies,
    book: { id: libraryBooks.id, title: libraryBooks.title, author: libraryBooks.author },
  }).from(libraryCopies)
    .innerJoin(libraryBooks, eq(libraryCopies.bookId, libraryBooks.id))
    .where(and(eq(libraryCopies.tenantId, tenant.id), eq(libraryCopies.status, "available")));
}));

router.post("/loans/issue", ...guard, requirePermission("library.manage"),
  validate({
    body: z.object({
      copyId: z.string().uuid(),
      studentId: z.string().uuid().optional(),
      staffId: z.string().uuid().optional(),
      libraryCardId: z.string().uuid().optional(),
      dueAt: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      if (!req.body.studentId && !req.body.staffId) {
        return res.status(400).json({ success: false, message: "studentId or staffId required" });
      }
      const [copy] = await db.select().from(libraryCopies).where(and(
        eq(libraryCopies.id, req.body.copyId),
        eq(libraryCopies.tenantId, tenant.id),
      )).limit(1);
      if (!copy) throw new NotFoundError("Copy not found");
      await db.update(libraryCopies).set({ status: "loaned" }).where(eq(libraryCopies.id, copy.id));
      const [loan] = await db.insert(libraryLoans).values({
        tenantId: tenant.id,
        copyId: copy.id,
        studentId: req.body.studentId ?? null,
        staffId: req.body.staffId ?? null,
        libraryCardId: req.body.libraryCardId ?? null,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : undefined,
      }).returning();
      res.status(201).json({ success: true, data: loan });
    } catch (e) { next(e); }
  },
);

export default router;
