import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { applicants, applicantEvents, students } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { AppError } from "../middleware/error";
import { createAuditLog } from "../services/audit";

export const admissionsRouter = Router();

admissionsRouter.use(requireAuth, requireTenantMatch);

// List all applicants
admissionsRouter.get("/", requirePermission("admissions.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const list = await db.select()
      .from(applicants)
      .where(eq(applicants.tenantId, tenantId))
      .orderBy(desc(applicants.createdAt));
    
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

// Create a new applicant
const createApplicantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  dob: z.string().optional(), // ISO date string
  gender: z.enum(["male", "female", "other"]).optional(),
});

admissionsRouter.post("/", requirePermission("admissions.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const body = createApplicantSchema.parse(req.body);

    const [newApplicant] = await db.insert(applicants).values({
      tenantId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone,
      dob: body.dob ? new Date(body.dob) : null,
      gender: body.gender,
      stage: "inquiry",
    }).returning();

    await createAuditLog({
      tenantId,
      actorUserId: (req as any).user!.id,
      action: "CREATE",
      entityType: "applicant",
      entityId: newApplicant.id,
      after: newApplicant,
      ip: req.ip,
    });

    res.status(201).json({ success: true, data: newApplicant });
  } catch (error) {
    next(error);
  }
});

// Update applicant stage
const updateStageSchema = z.object({
  stage: z.string().min(1),
  notes: z.string().optional(),
});

admissionsRouter.patch("/:id/stage", requirePermission("admissions.edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const { id } = req.params;
    const body = updateStageSchema.parse(req.body);

    const [existing] = await db.select().from(applicants).where(and(eq(applicants.id, id), eq(applicants.tenantId, tenantId)));
    if (!existing) throw new AppError("Applicant not found", 404);

    const [updated] = await db.update(applicants)
      .set({ stage: body.stage, notes: body.notes, updatedAt: new Date() })
      .where(eq(applicants.id, id))
      .returning();

    // Log the event in applicantEvents for timeline
    await db.insert(applicantEvents).values({
      tenantId,
      applicantId: id,
      eventType: "stage_changed",
      notes: `Stage changed from ${existing.stage} to ${body.stage}`,
      createdBy: (req as any).user!.id,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Enroll applicant as a student
const enrollSchema = z.object({
  admissionNumber: z.string().min(1),
});

admissionsRouter.post("/:id/enroll", requirePermission("admissions.enroll"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenant!.id;
    const { id } = req.params;
    const body = enrollSchema.parse(req.body);

    const [existing] = await db.select().from(applicants).where(and(eq(applicants.id, id), eq(applicants.tenantId, tenantId)));
    if (!existing) throw new AppError("Applicant not found", 404);
    if (existing.convertedTo) throw new AppError("Applicant already enrolled", 400);

    // Create student
    const [newStudent] = await db.insert(students).values({
      tenantId,
      admissionNumber: body.admissionNumber,
      firstName: existing.firstName,
      lastName: existing.lastName,
      dob: existing.dob,
      gender: existing.gender,
      status: "active",
    }).returning();

    // Mark applicant as converted
    const [updatedApplicant] = await db.update(applicants)
      .set({ stage: "enrolled", convertedTo: newStudent.id, updatedAt: new Date() })
      .where(eq(applicants.id, id))
      .returning();

    await db.insert(applicantEvents).values({
      tenantId,
      applicantId: id,
      eventType: "enrolled",
      notes: `Enrolled as student ${body.admissionNumber}`,
      createdBy: (req as any).user!.id,
    });

    res.json({ success: true, data: { applicant: updatedApplicant, student: newStudent } });
  } catch (error) {
    next(error);
  }
});
