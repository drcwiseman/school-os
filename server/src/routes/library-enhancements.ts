import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  libraryBooks, libraryCopies, libraryLoans, libraryFines, libraryCards,
  students, staff,
} from "../db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";

export const libraryEnhancementsRouter = Router();
libraryEnhancementsRouter.use(requireAuth, requireTenantMatch);

libraryEnhancementsRouter.get("/dashboard", requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [books] = await db.select({ n: sql<number>`count(*)` }).from(libraryBooks).where(eq(libraryBooks.tenantId, tenant.id));
    const [copies] = await db.select({
      total: sql<number>`count(*)`,
      available: sql<number>`count(*) filter (where ${libraryCopies.status} = 'available')`,
      loaned: sql<number>`count(*) filter (where ${libraryCopies.status} = 'loaned')`,
    }).from(libraryCopies).where(eq(libraryCopies.tenantId, tenant.id));
    const [loans] = await db.select({
      active: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null)`,
      overdue: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null and ${libraryLoans.dueAt} < now())`,
    }).from(libraryLoans).where(eq(libraryLoans.tenantId, tenant.id));
    const [cards] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${libraryCards.status} = 'active')`,
    }).from(libraryCards).where(eq(libraryCards.tenantId, tenant.id));
    const [fines] = await db.select({ unpaid: sql<number>`count(*) filter (where ${libraryFines.paid} = false)` })
      .from(libraryFines).where(eq(libraryFines.tenantId, tenant.id));
    res.json({
      success: true,
      data: {
        books: Number(books?.n ?? 0),
        copies: copies,
        loans: loans,
        cards: cards,
        unpaidFines: Number(fines?.unpaid ?? 0),
      },
    });
  } catch (e) { next(e); }
});

libraryEnhancementsRouter.get("/loans/enriched", requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
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
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

libraryEnhancementsRouter.get("/member-activity", requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const studentId = req.query.studentId as string | undefined;
    const staffId = req.query.staffId as string | undefined;
    const conds = [eq(libraryLoans.tenantId, tenant.id)];
    if (studentId) conds.push(eq(libraryLoans.studentId, studentId));
    if (staffId) conds.push(eq(libraryLoans.staffId, staffId));
    const rows = await db.select({
      loan: libraryLoans,
      book: { title: libraryBooks.title, author: libraryBooks.author },
      copy: { barcode: libraryCopies.barcode },
    }).from(libraryLoans)
      .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
      .innerJoin(libraryBooks, eq(libraryCopies.bookId, libraryBooks.id))
      .where(and(...conds))
      .orderBy(desc(libraryLoans.loanedAt))
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

libraryEnhancementsRouter.get("/cards", requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      card: libraryCards,
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
      staffMember: { firstName: staff.firstName, lastName: staff.lastName, employeeNo: staff.employeeNo },
    }).from(libraryCards)
      .leftJoin(students, eq(libraryCards.studentId, students.id))
      .leftJoin(staff, eq(libraryCards.staffId, staff.id))
      .where(eq(libraryCards.tenantId, tenant.id))
      .orderBy(desc(libraryCards.issuedAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

libraryEnhancementsRouter.post("/cards", requirePermission("library.manage"),
  validate({
    body: z.object({
      memberType: z.enum(["student", "staff"]),
      studentId: z.string().uuid().optional(),
      staffId: z.string().uuid().optional(),
      cardNumber: z.string().optional(),
      expiresAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { memberType, studentId, staffId, expiresAt, notes } = req.body;
      if (memberType === "student" && !studentId) return res.status(400).json({ success: false, message: "studentId required" });
      if (memberType === "staff" && !staffId) return res.status(400).json({ success: false, message: "staffId required" });
      let cardNumber = req.body.cardNumber as string | undefined;
      if (!cardNumber) {
        const [cnt] = await db.select({ n: sql<number>`count(*)` }).from(libraryCards).where(eq(libraryCards.tenantId, tenant.id));
        cardNumber = `LIB-${String(Number(cnt?.n ?? 0) + 1).padStart(5, "0")}`;
      }
      const [row] = await db.insert(libraryCards).values({
        tenantId: tenant.id,
        cardNumber,
        memberType,
        studentId: memberType === "student" ? studentId : null,
        staffId: memberType === "staff" ? staffId : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes ?? null,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

libraryEnhancementsRouter.patch("/cards/:id", requirePermission("library.manage"),
  validate({ body: z.object({ status: z.enum(["active", "suspended", "lost"]).optional(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(libraryCards).set(req.body).where(and(
        eq(libraryCards.id, req.params.id),
        eq(libraryCards.tenantId, tenant.id),
      )).returning();
      if (!row) throw new NotFoundError("Card not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

libraryEnhancementsRouter.post("/loans/issue", requirePermission("library.manage"),
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

libraryEnhancementsRouter.get("/lookup/copies", requirePermission("library.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      copy: libraryCopies,
      book: { id: libraryBooks.id, title: libraryBooks.title, author: libraryBooks.author },
    }).from(libraryCopies)
      .innerJoin(libraryBooks, eq(libraryCopies.bookId, libraryBooks.id))
      .where(and(eq(libraryCopies.tenantId, tenant.id), eq(libraryCopies.status, "available")));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});
