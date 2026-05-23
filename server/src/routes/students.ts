import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { students, studentGuardians, guardians, studentClassHistory, studentDocuments, classes, parentAccounts, studentAccounts } from "../db/schema";
import { hashPassword } from "../middleware/auth";
import fs from "fs";
import path from "path";
import { eq, and, ilike, or, desc, sql, isNull } from "drizzle-orm";
import { resolveTenantFile } from "../lib/uploads";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { createAuditLog } from "../services/audit";
import { softDeleteStudent } from "../services/soft-delete";
import { writeTenantFile } from "../lib/uploads";
import { NotFoundError, ConflictError } from "../middleware/error";
import { paginationSchema, paginate, paginatedResponse } from "../utils/pagination";
import { getCampusId, campusCondition } from "../lib/campus-scope";
import { getStudent360 } from "../services/student-360";
import { listStudentsEnriched } from "../services/student-list";
import { z } from "zod";

const router = Router();
const guard  = [requireAuth, requireTenantMatch];

const studentCreateSchema = z.object({
  admissionNumber: z.string().min(1),
  firstName:       z.string().min(1),
  lastName:        z.string().min(1),
  middleName:      z.string().optional(),
  dob:             z.string().optional(),
  gender:          z.enum(["male","female","other"]).optional(),
  nationality:     z.string().optional(),
  religion:        z.string().optional(),
  bloodGroup:      z.string().optional(),
  phone:           z.string().optional(),
  email:           z.string().optional(),
  address:         z.string().optional(),
  shortBio:        z.string().optional(),
  photoUrl:        z.string().optional(),
  classId:         z.string().uuid().optional(),
  streamId:        z.string().uuid().optional(),
  termId:          z.string().uuid().optional(),
  parentFirstName: z.string().optional(),
  parentLastName:  z.string().optional(),
  parentPhone:     z.string().optional(),
  parentEmail:     z.string().optional(),
  parentRelationship: z.string().optional(),
});

const studentUpdateSchema = studentCreateSchema.partial();

// GET /s/:schoolSlug/api/students
router.get("/", ...guard, requirePermission("students.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const q = await paginationSchema.merge(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      roll: z.string().optional(),
      name: z.string().optional(),
      classId: z.string().uuid().optional(),
      enriched: z.coerce.boolean().optional(),
    })).parseAsync(req.query);
    const { limit, offset } = paginate(q.page, q.limit);

    if (q.enriched !== false) {
      const { rows, total } = await listStudentsEnriched({
        tenantId: tenant.id,
        campusId: getCampusId(req),
        search: q.search,
        roll: q.roll,
        name: q.name,
        classId: q.classId,
        status: q.status,
        limit,
        offset,
      });
      return res.json(paginatedResponse(rows, total, q.page, q.limit));
    }

    const conditions = [eq(students.tenantId, tenant.id), isNull(students.deletedAt)];
    const c = campusCondition(students, getCampusId(req));
    if (c) conditions.push(c);
    if (q.status) conditions.push(eq(students.status, q.status as any));
    if (q.search) {
      const s = `%${q.search}%`;
      conditions.push(or(ilike(students.firstName, s), ilike(students.lastName, s), ilike(students.admissionNumber, s))!);
    }

    const rows = await db.select().from(students).where(and(...conditions)).orderBy(desc(students.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(students).where(and(...conditions));

    res.json(paginatedResponse(rows, Number(count), q.page, q.limit));
  } catch (err) { next(err); }
});

router.get("/export/csv", ...guard, requirePermission("students.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(students).where(eq(students.tenantId, tenant.id));
    const header = "admissionNumber,firstName,lastName,status,gender\n";
    const body = rows.map((s) =>
      [s.admissionNumber, s.firstName, s.lastName, s.status, s.gender ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=students.csv");
    res.send(header + body);
  } catch (err) { next(err); }
});

router.post("/import/csv", ...guard, requirePermission("students.create"),
  validate({ body: z.object({ csv: z.string().min(1) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user   = (req as any).user;
      const lines = req.body.csv.trim().split("\n").slice(1);
      let imported = 0;
      for (const line of lines) {
        const [admissionNumber, firstName, lastName, status, gender] = line.split(",").map((s: string) => s.replace(/^"|"$/g, "").trim());
        if (!admissionNumber || !firstName || !lastName) continue;
        await db.insert(students).values({
          tenantId: tenant.id, admissionNumber, firstName, lastName,
          status: (status as any) || "active",
          gender: gender ? (gender as any) : undefined,
        }).onConflictDoNothing();
        imported++;
      }
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "students.import", entityType: "student", after: { imported }, ip: req.ip });
      res.json({ success: true, data: { imported } });
    } catch (err) { next(err); }
  }
);

// GET /s/:schoolSlug/api/students/:id
router.get("/:id", ...guard, requirePermission("students.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
    if (!student) throw new NotFoundError("Student not found");
    const [portalAccount] = await db.select({ email: studentAccounts.email, status: studentAccounts.status })
      .from(studentAccounts).where(eq(studentAccounts.studentId, student.id)).limit(1);
    res.json({ success: true, data: { ...student, portalAccount: portalAccount ?? null } });
  } catch (err) { next(err); }
});

// POST /s/:schoolSlug/api/students
router.post("/", ...guard, requirePermission("students.create"), validate({ body: studentCreateSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const user   = (req as any).user;
    const [existing] = await db.select().from(students).where(and(eq(students.tenantId, tenant.id), eq(students.admissionNumber, req.body.admissionNumber))).limit(1);
    if (existing) throw new ConflictError("Admission number already exists");
    const {
      classId, streamId, termId,
      parentFirstName, parentLastName, parentPhone, parentEmail, parentRelationship,
      email, ...studentFields
    } = req.body;
    const [student] = await db.insert(students).values({
      ...studentFields,
      tenantId: tenant.id,
      dob: studentFields.dob ? new Date(studentFields.dob) : undefined,
      email: email || undefined,
    }).returning();
    if (classId) {
      await db.insert(studentClassHistory).values({
        tenantId: tenant.id, studentId: student.id, classId, streamId, termId,
      });
    }
    if (parentFirstName && parentLastName) {
      const [guardian] = await db.insert(guardians).values({
        tenantId: tenant.id,
        firstName: parentFirstName,
        lastName: parentLastName,
        relationship: parentRelationship || "parent",
        phone: parentPhone,
        email: parentEmail,
        address: studentFields.address,
      }).returning();
      await db.insert(studentGuardians).values({ studentId: student.id, guardianId: guardian.id, isPrimary: true });
    }
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "student.create", entityType: "student", entityId: student.id, after: student, ip: req.ip });
    res.status(201).json({ success: true, data: student });
  } catch (err) { next(err); }
});

// PATCH /s/:schoolSlug/api/students/:id
router.patch("/:id", ...guard, requirePermission("students.edit"), validate({ body: studentUpdateSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const user   = (req as any).user;
    const [before] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
    if (!before) throw new NotFoundError("Student not found");
    const [updated] = await db.update(students).set({ ...req.body, updatedAt: new Date() }).where(eq(students.id, req.params.id)).returning();
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "student.update", entityType: "student", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /s/:schoolSlug/api/students/:id
router.delete("/:id", ...guard, requirePermission("students.delete"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const user   = (req as any).user;
    const [before] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
    if (!before) throw new NotFoundError("Student not found");
    const updated = await softDeleteStudent(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "student.soft_delete", entityType: "student", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /s/:schoolSlug/api/students/:id/guardians
router.get("/:id/guardians", ...guard, requirePermission("students.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
    if (!student) throw new NotFoundError("Student not found");
    const links = await db
      .select({
        guardian: guardians,
        isPrimary: studentGuardians.isPrimary,
        portalEmail: parentAccounts.email,
        portalStatus: parentAccounts.status,
      })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .leftJoin(parentAccounts, eq(parentAccounts.guardianId, guardians.id))
      .where(eq(studentGuardians.studentId, student.id));
    res.json({ success: true, data: links });
  } catch (err) { next(err); }
});

// POST /s/:schoolSlug/api/students/:id/guardians
router.post("/:id/guardians", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), relationship: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional(), address: z.string().optional(), isPrimary: z.boolean().default(false) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const { isPrimary, ...guardianData } = req.body;
      const [guardian] = await db.insert(guardians).values({ ...guardianData, tenantId: tenant.id }).returning();
      await db.insert(studentGuardians).values({ studentId: student.id, guardianId: guardian.id, isPrimary });
      res.status(201).json({ success: true, data: guardian });
    } catch (err) { next(err); }
  }
);

router.post("/:id/student-portal", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(8) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [existingEmail] = await db.select().from(studentAccounts).where(and(
        eq(studentAccounts.tenantId, tenant.id),
        eq(studentAccounts.email, req.body.email),
      )).limit(1);
      if (existingEmail) throw new ConflictError("A student portal account with this email already exists");
      const [existingStudent] = await db.select().from(studentAccounts).where(and(
        eq(studentAccounts.tenantId, tenant.id),
        eq(studentAccounts.studentId, student.id),
      )).limit(1);
      if (existingStudent) throw new ConflictError("This student already has a portal account");
      const passwordHash = await hashPassword(req.body.password);
      const [account] = await db.insert(studentAccounts).values({
        tenantId: tenant.id,
        email: req.body.email,
        passwordHash,
        studentId: student.id,
        status: "active",
      }).returning();
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "student_portal.create",
        entityType: "student_account", entityId: account.id, after: { email: account.email, studentId: student.id }, ip: req.ip,
      });
      res.status(201).json({ success: true, data: { id: account.id, email: account.email, status: account.status } });
    } catch (err) { next(err); }
  }
);

router.post("/:id/guardians/:guardianId/parent-portal", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(8) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [link] = await db.select().from(studentGuardians).where(and(
        eq(studentGuardians.studentId, student.id),
        eq(studentGuardians.guardianId, req.params.guardianId),
      )).limit(1);
      if (!link) throw new NotFoundError("Guardian not linked to this student");
      const [existingEmail] = await db.select().from(parentAccounts).where(and(
        eq(parentAccounts.tenantId, tenant.id),
        eq(parentAccounts.email, req.body.email),
      )).limit(1);
      if (existingEmail) throw new ConflictError("A parent portal account with this email already exists");
      const [existingGuardian] = await db.select().from(parentAccounts).where(and(
        eq(parentAccounts.tenantId, tenant.id),
        eq(parentAccounts.guardianId, req.params.guardianId),
      )).limit(1);
      if (existingGuardian) throw new ConflictError("This guardian already has a portal account");
      const passwordHash = await hashPassword(req.body.password);
      const [account] = await db.insert(parentAccounts).values({
        tenantId: tenant.id,
        email: req.body.email,
        passwordHash,
        guardianId: req.params.guardianId,
        status: "active",
      }).returning();
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "parent_portal.create",
        entityType: "parent_account", entityId: account.id, after: { email: account.email, guardianId: account.guardianId }, ip: req.ip,
      });
      res.status(201).json({ success: true, data: { id: account.id, email: account.email, status: account.status } });
    } catch (err) { next(err); }
  }
);

// POST /s/:schoolSlug/api/students/:id/promote
router.post("/:id/promote", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ classId: z.string().uuid(), streamId: z.string().uuid().optional(), termId: z.string().uuid().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user   = (req as any).user;
      const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [cls] = await db.select().from(classes).where(and(eq(classes.id, req.body.classId), eq(classes.tenantId, tenant.id))).limit(1);
      if (!cls) throw new NotFoundError("Class not found");
      await db.update(studentClassHistory).set({ toDate: new Date() }).where(and(eq(studentClassHistory.studentId, student.id), eq(studentClassHistory.tenantId, tenant.id)));
      const [history] = await db.insert(studentClassHistory).values({
        tenantId: tenant.id, studentId: student.id, classId: req.body.classId,
        streamId: req.body.streamId, termId: req.body.termId,
      }).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "student.promote", entityType: "student", entityId: student.id, after: history, ip: req.ip });
      res.json({ success: true, data: history });
    } catch (err) { next(err); }
  }
);

// GET /s/:schoolSlug/api/students/:id/documents
router.get("/:id/documents", ...guard, requirePermission("students.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
    if (!student) throw new NotFoundError("Student not found");
    const docs = await db.select().from(studentDocuments).where(and(eq(studentDocuments.studentId, student.id), eq(studentDocuments.tenantId, tenant.id)));
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// POST /s/:schoolSlug/api/students/:id/documents
router.post("/:id/documents", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ documentType: z.string().min(1), fileName: z.string().min(1), contentBase64: z.string().min(1), mimeType: z.string().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const { validateUpload } = await import("../middleware/upload");
      const { safeName, size } = validateUpload(req.body.fileName, req.body.mimeType, req.body.contentBase64);
      const buffer = Buffer.from(req.body.contentBase64, "base64");
      if (buffer.length !== size) throw new ConflictError("Invalid file payload");
      const filePath = writeTenantFile(tenant.id, ["students", student.id], `${Date.now()}_${safeName}`, buffer);
      const [doc] = await db.insert(studentDocuments).values({
        tenantId: tenant.id, studentId: student.id, documentType: req.body.documentType,
        fileName: safeName, filePath, mimeType: req.body.mimeType,
      }).returning();
      res.status(201).json({ success: true, data: doc });
    } catch (err) { next(err); }
  }
);

// GET /s/:schoolSlug/api/students/:id/documents/:docId/file — tenant-scoped file download
router.get("/:id/documents/:docId/file", ...guard, requirePermission("students.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [student] = await db.select().from(students).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id), isNull(students.deletedAt))).limit(1);
    if (!student) throw new NotFoundError("Student not found");
    const [doc] = await db.select().from(studentDocuments).where(and(
      eq(studentDocuments.id, req.params.docId),
      eq(studentDocuments.studentId, student.id),
      eq(studentDocuments.tenantId, tenant.id),
    )).limit(1);
    if (!doc?.filePath) throw new NotFoundError("Document not found");
    const absPath = resolveTenantFile(tenant.id, doc.filePath);
    res.sendFile(absPath);
  } catch (err) { next(err); }
});

router.get("/:id/360", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const data = await getStudent360(tenant.id, req.params.id);
    if (!data) throw new NotFoundError("Student not found");
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch("/:id/medical", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ medicalJson: z.record(z.unknown()), biometricId: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.medicalJson) patch.medicalJson = req.body.medicalJson;
      if (req.body.biometricId !== undefined) patch.biometricId = req.body.biometricId;
      const [updated] = await db.update(students).set(patch).where(and(eq(students.id, req.params.id), eq(students.tenantId, tenant.id))).returning();
      if (!updated) throw new NotFoundError("Student not found");
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },
);

router.post("/batch-promote", ...guard, requirePermission("students.edit"),
  validate({ body: z.object({ studentIds: z.array(z.string().uuid()).min(1), classId: z.string().uuid(), termId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      let promoted = 0;
      for (const sid of req.body.studentIds) {
        const [exists] = await db.select().from(students).where(and(eq(students.id, sid), eq(students.tenantId, tenant.id))).limit(1);
        if (!exists) continue;
        await db.update(studentClassHistory).set({ toDate: new Date() }).where(and(
          eq(studentClassHistory.studentId, sid), eq(studentClassHistory.tenantId, tenant.id), isNull(studentClassHistory.toDate),
        ));
        await db.insert(studentClassHistory).values({
          tenantId: tenant.id, studentId: sid, classId: req.body.classId, termId: req.body.termId,
        });
        promoted++;
      }
      res.json({ success: true, data: { promoted } });
    } catch (err) { next(err); }
  },
);

router.get("/profile-pending", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listStudentsWithPendingProfiles, filterPendingOnly } = await import("../services/student-profile-pending");
    const rows = filterPendingOnly(await listStudentsWithPendingProfiles(tenant.id));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/:id/profile-pending/approve", ...guard, requirePermission("students.edit"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { approveStudentPendingProfile } = await import("../services/student-profile-pending");
    const updated = await approveStudentPendingProfile(tenant.id, req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.post("/:id/profile-pending/reject", ...guard, requirePermission("students.edit"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { rejectStudentPendingProfile } = await import("../services/student-profile-pending");
    const updated = await rejectStudentPendingProfile(tenant.id, req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

export default router;
