import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  students, studentLeaveRequests, studentTransfers, studentCertificates,
  announcements, studentClassHistory,
} from "../db/schema";
import { eq, and, desc, isNull, isNotNull, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { createAuditLog } from "../services/audit";
import { NotFoundError } from "../middleware/error";
import { getCampusId, campusCondition } from "../lib/campus-scope";
import { promoteScheduledAnnouncements } from "../services/announcements";
import {
  generateStudentIdCardPdf,
  generateTransferCertificatePdf,
  generateAchievementCertificatePdf,
  generateStudentFeeReportPdf,
} from "../services/pdf";
import { z } from "zod";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

function sendPdf(res: Response, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

// GET /birthdays/upcoming
router.get("/birthdays/upcoming", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const days = Math.min(60, Math.max(1, Number(req.query.days) || 30));
    const campusId = getCampusId(req);
    const conditions = [
      eq(students.tenantId, tenant.id),
      isNull(students.deletedAt),
      isNotNull(students.dob),
    ];
    const c = campusCondition(students, campusId);
    if (c) conditions.push(c);

    const rows = await db.select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
      dob: students.dob,
      photoUrl: students.photoUrl,
    }).from(students).where(and(...conditions)).limit(500);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = rows
      .filter((r) => r.dob)
      .map((r) => {
        const d = new Date(r.dob!);
        const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
        return { ...r, daysUntil };
      })
      .filter((r) => r.daysUntil >= 0 && r.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    res.json({ success: true, data: upcoming });
  } catch (err) { next(err); }
});

// GET /noticeboard
router.get("/noticeboard", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    await promoteScheduledAnnouncements(tenant.id);
    const rows = await db.select().from(announcements).where(and(
      eq(announcements.tenantId, tenant.id),
      eq(announcements.published, true),
      or(
        eq(announcements.audience, "all"),
        eq(announcements.audience, "students"),
        eq(announcements.audience, "parents"),
      )!,
    )).orderBy(desc(announcements.createdAt)).limit(50);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── Student leaves ───
router.get("/leaves", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const status = req.query.status as string | undefined;
    const conditions = [eq(studentLeaveRequests.tenantId, tenant.id)];
    if (status) conditions.push(eq(studentLeaveRequests.status, status));
    const rows = await db.select({
      leave: studentLeaveRequests,
      student: {
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      },
    }).from(studentLeaveRequests)
      .innerJoin(students, eq(studentLeaveRequests.studentId, students.id))
      .where(and(...conditions))
      .orderBy(desc(studentLeaveRequests.createdAt))
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/leaves", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({
    studentId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().min(1),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(
        eq(students.id, req.body.studentId), eq(students.tenantId, tenant.id),
      )).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [row] = await db.insert(studentLeaveRequests).values({
        tenantId: tenant.id,
        studentId: student.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        reason: req.body.reason,
        status: "approved",
        reviewedBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

router.patch("/leaves/:id", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ status: z.enum(["pending", "approved", "rejected"]), reviewNote: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.update(studentLeaveRequests).set({
        status: req.body.status,
        reviewNote: req.body.reviewNote,
        reviewedBy: user.id,
      }).where(and(eq(studentLeaveRequests.id, req.params.id), eq(studentLeaveRequests.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("Leave request not found");
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

// ─── School transfers ───
router.get("/transfers", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      transfer: studentTransfers,
      student: {
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        admissionNumber: students.admissionNumber,
      },
    }).from(studentTransfers)
      .innerJoin(students, eq(studentTransfers.studentId, students.id))
      .where(eq(studentTransfers.tenantId, tenant.id))
      .orderBy(desc(studentTransfers.createdAt))
      .limit(100);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/transfers", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({
    studentId: z.string().uuid(),
    destinationSchool: z.string().min(1),
    destinationBranch: z.string().optional(),
    reason: z.string().optional(),
    effectiveDate: z.string().optional(),
    direction: z.enum(["outbound", "inbound"]).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(
        eq(students.id, req.body.studentId), eq(students.tenantId, tenant.id),
      )).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [row] = await db.insert(studentTransfers).values({
        tenantId: tenant.id,
        studentId: student.id,
        direction: req.body.direction ?? "outbound",
        destinationSchool: req.body.destinationSchool,
        destinationBranch: req.body.destinationBranch,
        reason: req.body.reason,
        effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : undefined,
        processedBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

router.patch("/transfers/:id", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({
    status: z.enum(["pending", "completed", "cancelled"]).optional(),
    issueTc: z.boolean().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [existing] = await db.select().from(studentTransfers).where(and(
        eq(studentTransfers.id, req.params.id), eq(studentTransfers.tenantId, tenant.id),
      )).limit(1);
      if (!existing) throw new NotFoundError("Transfer not found");

      const patch: Record<string, unknown> = {};
      if (req.body.status) patch.status = req.body.status;
      if (req.body.issueTc) patch.tcIssuedAt = new Date();
      if (req.body.status === "completed") {
        patch.processedBy = user.id;
        await db.update(students).set({ status: "transferred", updatedAt: new Date() }).where(and(
          eq(students.id, existing.studentId), eq(students.tenantId, tenant.id),
        ));
        await db.update(studentClassHistory).set({ toDate: new Date() }).where(and(
          eq(studentClassHistory.studentId, existing.studentId),
          eq(studentClassHistory.tenantId, tenant.id),
          isNull(studentClassHistory.toDate),
        ));
      }
      const [row] = await db.update(studentTransfers).set(patch).where(eq(studentTransfers.id, existing.id)).returning();
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "student.transfer",
        entityType: "student_transfer", entityId: row!.id, after: row, ip: req.ip,
      });
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

// ─── Certificates log ───
router.get("/certificates", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const studentId = req.query.studentId as string | undefined;
    const conditions = [eq(studentCertificates.tenantId, tenant.id)];
    if (studentId) conditions.push(eq(studentCertificates.studentId, studentId));
    const rows = await db.select({
      cert: studentCertificates,
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
    }).from(studentCertificates)
      .innerJoin(students, eq(studentCertificates.studentId, students.id))
      .where(and(...conditions))
      .orderBy(desc(studentCertificates.issuedAt))
      .limit(50);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/certificates", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({
    studentId: z.string().uuid(),
    certType: z.enum(["achievement", "participation", "completion", "custom"]),
    title: z.string().min(1),
    body: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(
        eq(students.id, req.body.studentId), eq(students.tenantId, tenant.id),
      )).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [row] = await db.insert(studentCertificates).values({
        tenantId: tenant.id,
        studentId: student.id,
        certType: req.body.certType,
        title: req.body.title,
        body: req.body.body,
        issuedBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  },
);

// ─── PDFs ───
router.get("/students/:studentId/pdf/id-card", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateStudentIdCardPdf(tenant.id, req.params.studentId);
    sendPdf(res, bytes, `id-card-${req.params.studentId.slice(0, 8)}.pdf`);
  } catch (err) { next(err); }
});

router.get("/students/:studentId/pdf/transfer-certificate", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const transferId = req.query.transferId as string | undefined;
    const bytes = await generateTransferCertificatePdf(tenant.id, req.params.studentId, transferId);
    sendPdf(res, bytes, `transfer-certificate-${req.params.studentId.slice(0, 8)}.pdf`);
  } catch (err) { next(err); }
});

router.post("/students/:studentId/pdf/achievement-certificate", ...guard, requirePermission("students.view"),
  validate({ body: z.object({ title: z.string().min(1), body: z.string().optional(), certType: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const bytes = await generateAchievementCertificatePdf(tenant.id, req.params.studentId, {
        title: req.body.title,
        body: req.body.body,
      });
      await db.insert(studentCertificates).values({
        tenantId: tenant.id,
        studentId: req.params.studentId,
        certType: req.body.certType ?? "achievement",
        title: req.body.title,
        body: req.body.body,
        issuedBy: user.id,
      });
      sendPdf(res, bytes, `certificate-${req.params.studentId.slice(0, 8)}.pdf`);
    } catch (err) { next(err); }
  },
);

router.get("/students/:studentId/pdf/fee-report", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const bytes = await generateStudentFeeReportPdf(tenant.id, req.params.studentId);
    sendPdf(res, bytes, `fee-report-${req.params.studentId.slice(0, 8)}.pdf`);
  } catch (err) { next(err); }
});

export default router;
