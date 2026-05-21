import { Router } from "express";
import { db } from "../db";
import { students, users, invoices, staff } from "../db/schema";
import { eq, and, or, ilike, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { getCampusId, campusCondition } from "../lib/campus-scope";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const q = String(req.query.q ?? "").trim();
    const campusId = getCampusId(req);
    if (q.length < 2) return res.json({ success: true, data: { students: [], staff: [], invoices: [], users: [] } });

    const pattern = `%${q}%`;
    const studentCampus = campusCondition(students, campusId);
    const invoiceCampus = campusCondition(invoices, campusId);

    const studentRows = await db.select({
      id: students.id,
      label: sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
      sub: students.admissionNumber,
      type: sql<string>`'student'`,
    }).from(students).where(and(
      eq(students.tenantId, tenant.id),
      isNull(students.deletedAt),
      studentCampus ?? sql`true`,
      or(ilike(students.firstName, pattern), ilike(students.lastName, pattern), ilike(students.admissionNumber, pattern)),
    )).limit(8);

    const invoiceRows = await db.select({
      id: invoices.id,
      label: invoices.invoiceNo,
      sub: invoices.status,
      type: sql<string>`'invoice'`,
    }).from(invoices).where(and(
      eq(invoices.tenantId, tenant.id),
      isNull(invoices.deletedAt),
      invoiceCampus ?? sql`true`,
      ilike(invoices.invoiceNo, pattern),
    )).limit(8);

    const userRows = await db.select({
      id: users.id,
      label: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      sub: users.email,
      type: sql<string>`'user'`,
    }).from(users).where(and(
      eq(users.tenantId, tenant.id),
      isNull(users.deletedAt),
      or(ilike(users.firstName, pattern), ilike(users.lastName, pattern), ilike(users.email, pattern)),
    )).limit(8);

    const staffRows = await db.select({
      id: staff.id,
      label: sql<string>`${staff.firstName} || ' ' || ${staff.lastName}`,
      sub: staff.employeeNo,
      type: sql<string>`'staff'`,
    }).from(staff).where(and(
      eq(staff.tenantId, tenant.id),
      or(ilike(staff.firstName, pattern), ilike(staff.lastName, pattern), ilike(staff.employeeNo, pattern)),
    )).limit(8);

    res.json({
      success: true,
      data: {
        students: studentRows,
        invoices: invoiceRows,
        users: userRows,
        staff: staffRows,
      },
    });
  } catch (e) { next(e); }
});

export default router;
