import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  guardians, parentAccounts, studentAccounts, studentGuardians, students,
} from "../db/schema";
import { requirePortalAuth, hashPassword, verifyPassword } from "../middleware/portal-auth";
import { validate } from "../utils/validate";
import {
  BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError,
} from "../middleware/error";
import { getParentAccessibleStudentIds } from "../services/portal-access";

export const portalProfileRouter = Router();
portalProfileRouter.use(requirePortalAuth);

function requireParent(req: import("express").Request) {
  const principal = (req as any).portalPrincipal;
  if (principal.kind !== "parent") throw new ForbiddenError("Parent account required");
  return principal as { kind: "parent"; account: typeof parentAccounts.$inferSelect };
}

const guardianBodySchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  relationship: z.string().min(1).max(80),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

const contactCreateSchema = guardianBodySchema.extend({
  studentId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
});

async function loadParentProfile(tenantId: string, account: typeof parentAccounts.$inferSelect) {
  const [guardian] = await db.select().from(guardians).where(and(
    eq(guardians.id, account.guardianId),
    eq(guardians.tenantId, tenantId),
  )).limit(1);
  if (!guardian) throw new NotFoundError("Guardian profile not found");

  const studentIds = await getParentAccessibleStudentIds(account.guardianId);
  const children = studentIds.length
    ? await db.select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    }).from(students).where(and(
      eq(students.tenantId, tenantId),
      inArray(students.id, studentIds),
    ))
    : [];

  const links = studentIds.length
    ? await db.select({
      guardianId: studentGuardians.guardianId,
      studentId: studentGuardians.studentId,
      isPrimary: studentGuardians.isPrimary,
      firstName: guardians.firstName,
      lastName: guardians.lastName,
      relationship: guardians.relationship,
      phone: guardians.phone,
      email: guardians.email,
      address: guardians.address,
    })
      .from(studentGuardians)
      .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(inArray(studentGuardians.studentId, studentIds))
    : [];

  const contactsById = new Map<string, {
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isSelf: boolean;
    students: { studentId: string; isPrimary: boolean }[];
  }>();

  for (const row of links) {
    const existing = contactsById.get(row.guardianId);
    const link = { studentId: row.studentId, isPrimary: row.isPrimary };
    if (existing) {
      existing.students.push(link);
    } else {
      contactsById.set(row.guardianId, {
        id: row.guardianId,
        firstName: row.firstName,
        lastName: row.lastName,
        relationship: row.relationship,
        phone: row.phone,
        email: row.email,
        address: row.address,
        isSelf: row.guardianId === account.guardianId,
        students: [link],
      });
    }
  }

  const prefs = (account.preferencesJson ?? {}) as { theme?: "light" | "dark" };

  return {
    account: {
      id: account.id,
      email: account.email,
      status: account.status,
      createdAt: account.createdAt,
    },
    guardian: {
      id: guardian.id,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email,
      address: guardian.address,
      photoUrl: guardian.photoUrl ?? null,
    },
    photoUrl: guardian.photoUrl ?? null,
    hasPhoto: Boolean(guardian.photoUrl),
    preferences: {
      theme: prefs.theme === "light" ? "light" as const : "dark" as const,
    },
    children,
    contacts: [...contactsById.values()].sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0)),
  };
}

async function loadStudentProfile(tenantId: string, slug: string, account: typeof studentAccounts.$inferSelect) {
  const [student] = await db.select().from(students).where(and(
    eq(students.id, account.studentId),
    eq(students.tenantId, tenantId),
  )).limit(1);
  if (!student) throw new NotFoundError("Student record not found");

  const medical = (student.medicalJson ?? {}) as {
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  const prefs = (account.preferencesJson ?? {}) as { theme?: "light" | "dark" };

  return {
    account: {
      id: account.id,
      email: account.email,
      status: account.status,
    },
    student: {
      id: student.id,
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      middleName: student.middleName,
      dob: student.dob,
      gender: student.gender,
      nationality: student.nationality,
      religion: student.religion,
      bloodGroup: student.bloodGroup,
      phone: student.phone,
      email: student.email,
      address: student.address,
      shortBio: student.shortBio,
      status: student.status,
      photoUrl: student.photoUrl ?? null,
      emergencyContact: medical.emergencyContact ?? null,
      emergencyPhone: medical.emergencyPhone ?? null,
    },
    preferences: {
      theme: prefs.theme === "light" ? "light" as const : "dark" as const,
    },
    photoUrl: student.photoUrl ?? null,
    hasPhoto: Boolean(student.photoUrl),
    pendingProfile: student.pendingProfileJson ?? null,
    profilePendingApproval: Boolean(student.pendingProfileJson),
  };
}

portalProfileRouter.get("/profile", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    if (principal.kind === "parent") {
      const data = await loadParentProfile(tenant.id, principal.account);
      return res.json({ success: true, data });
    }
    const data = await loadStudentProfile(tenant.id, tenant.slug, principal.account);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

portalProfileRouter.patch("/profile",
  validate({
    body: guardianBodySchema.extend({
      shortBio: z.string().max(1000).optional().or(z.literal("")),
      emergencyContact: z.string().max(120).optional().or(z.literal("")),
      emergencyPhone: z.string().max(40).optional().or(z.literal("")),
    }).partial(),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;

      if (principal.kind === "parent") {
        const patch: Record<string, unknown> = {};
        for (const key of ["firstName", "lastName", "relationship", "phone", "email", "address"] as const) {
          if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        if (patch.email === "") patch.email = null;
        if (patch.phone === "") patch.phone = null;
        if (patch.address === "") patch.address = null;
        if (!Object.keys(patch).length) throw new BadRequestError("No fields to update");

        const [updated] = await db.update(guardians).set(patch).where(and(
          eq(guardians.id, principal.account.guardianId),
          eq(guardians.tenantId, tenant.id),
        )).returning();
        if (!updated) throw new NotFoundError("Guardian profile not found");

        const data = await loadParentProfile(tenant.id, principal.account);
        return res.json({ success: true, data });
      }

      const { emergencyContact, emergencyPhone, ...studentPatch } = req.body as {
        emergencyContact?: string;
        emergencyPhone?: string;
        phone?: string;
        email?: string;
        address?: string;
        shortBio?: string;
      };

      const [existing] = await db.select().from(students).where(and(
        eq(students.id, principal.account.studentId),
        eq(students.tenantId, tenant.id),
      )).limit(1);
      if (!existing) throw new NotFoundError("Student not found");

      const hasBioFields = ["phone", "email", "address", "shortBio", "emergencyContact", "emergencyPhone"]
        .some((k) => (req.body as Record<string, unknown>)[k] !== undefined);

      if (hasBioFields) {
        const { submitStudentPendingProfile } = await import("../services/student-profile-pending");
        await submitStudentPendingProfile(tenant.id, principal.account.studentId, {
          phone: studentPatch.phone,
          email: studentPatch.email,
          address: studentPatch.address,
          shortBio: studentPatch.shortBio,
          emergencyContact,
          emergencyPhone,
        });
        const data = await loadStudentProfile(tenant.id, tenant.slug, principal.account);
        return res.json({
          success: true,
          data,
          message: "Bio changes submitted for admin approval",
        });
      }

      throw new BadRequestError("No fields to update");
    } catch (e) { next(e); }
  },
);

portalProfileRouter.patch("/profile/preferences",
  validate({ body: z.object({ theme: z.enum(["light", "dark"]) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      const prefs = { theme: req.body.theme };

      if (principal.kind === "parent") {
        const [updated] = await db.update(parentAccounts).set({
          preferencesJson: prefs,
          updatedAt: new Date(),
        }).where(and(
          eq(parentAccounts.id, principal.account.id),
          eq(parentAccounts.tenantId, tenant.id),
        )).returning();
        if (!updated) throw new NotFoundError("Account not found");
        const data = await loadParentProfile(tenant.id, updated);
        return res.json({ success: true, data });
      }

      const [updated] = await db.update(studentAccounts).set({
        preferencesJson: prefs,
        updatedAt: new Date(),
      }).where(and(
        eq(studentAccounts.id, principal.account.id),
        eq(studentAccounts.tenantId, tenant.id),
      )).returning();
      if (!updated) throw new NotFoundError("Account not found");
      const data = await loadStudentProfile(tenant.id, tenant.slug, updated);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.patch("/profile/email",
  validate({
    body: z.object({
      email: z.string().email(),
      currentPassword: z.string().min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      const ok = await verifyPassword(req.body.currentPassword, principal.account.passwordHash);
      if (!ok) throw new UnauthorizedError("Current password is incorrect");

      if (principal.kind === "parent") {
        const [existing] = await db.select().from(parentAccounts).where(and(
          eq(parentAccounts.tenantId, tenant.id),
          eq(parentAccounts.email, req.body.email),
        )).limit(1);
        if (existing && existing.id !== principal.account.id) {
          throw new ConflictError("Another parent account already uses this email");
        }
        const [updated] = await db.update(parentAccounts).set({
          email: req.body.email,
          updatedAt: new Date(),
        }).where(eq(parentAccounts.id, principal.account.id)).returning();
        const data = await loadParentProfile(tenant.id, updated);
        return res.json({ success: true, data });
      }

      const [existing] = await db.select().from(studentAccounts).where(and(
        eq(studentAccounts.tenantId, tenant.id),
        eq(studentAccounts.email, req.body.email),
      )).limit(1);
      if (existing && existing.id !== principal.account.id) {
        throw new ConflictError("Another student account already uses this email");
      }
      const [updated] = await db.update(studentAccounts).set({
        email: req.body.email,
        updatedAt: new Date(),
      }).where(eq(studentAccounts.id, principal.account.id)).returning();
      const data = await loadStudentProfile(tenant.id, tenant.slug, updated);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.patch("/profile/password",
  validate({
    body: z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  }),
  async (req, res, next) => {
    try {
      const principal = (req as any).portalPrincipal;
      const ok = await verifyPassword(req.body.currentPassword, principal.account.passwordHash);
      if (!ok) throw new UnauthorizedError("Current password is incorrect");

      const passwordHash = await hashPassword(req.body.newPassword);
      if (principal.kind === "parent") {
        await db.update(parentAccounts).set({ passwordHash, updatedAt: new Date() })
          .where(eq(parentAccounts.id, principal.account.id));
      } else {
        await db.update(studentAccounts).set({ passwordHash, updatedAt: new Date() })
          .where(eq(studentAccounts.id, principal.account.id));
      }
      res.json({ success: true, message: "Password updated" });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.post("/profile/contacts",
  validate({ body: contactCreateSchema }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = requireParent(req);
      const studentIds = await getParentAccessibleStudentIds(principal.account.guardianId);
      if (!studentIds.includes(req.body.studentId)) {
        throw new ForbiddenError("You can only add contacts for your linked children");
      }

      const { studentId, isPrimary, ...body } = req.body;
      const [guardian] = await db.insert(guardians).values({
        tenantId: tenant.id,
        firstName: body.firstName,
        lastName: body.lastName,
        relationship: body.relationship,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
      }).returning();

      if (isPrimary) {
        await db.update(studentGuardians).set({ isPrimary: false })
          .where(eq(studentGuardians.studentId, studentId));
      }
      await db.insert(studentGuardians).values({
        studentId,
        guardianId: guardian.id,
        isPrimary: !!isPrimary,
      }).onConflictDoNothing();

      const data = await loadParentProfile(tenant.id, principal.account);
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.patch("/profile/contacts/:guardianId",
  validate({ body: guardianBodySchema.partial() }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = requireParent(req);
      const guardianId = req.params.guardianId;
      if (guardianId === principal.account.guardianId) {
        throw new BadRequestError("Use profile update for your own details");
      }

      const studentIds = await getParentAccessibleStudentIds(principal.account.guardianId);
      const [link] = await db.select().from(studentGuardians)
        .where(and(
          eq(studentGuardians.guardianId, guardianId),
          inArray(studentGuardians.studentId, studentIds),
        )).limit(1);
      if (!link) throw new NotFoundError("Contact not found");

      const patch: Record<string, unknown> = { ...req.body };
      if (patch.email === "") patch.email = null;
      if (patch.phone === "") patch.phone = null;
      if (patch.address === "") patch.address = null;

      await db.update(guardians).set(patch).where(and(
        eq(guardians.id, guardianId),
        eq(guardians.tenantId, tenant.id),
      ));

      const data = await loadParentProfile(tenant.id, principal.account);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.delete("/profile/contacts/:guardianId", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = requireParent(req);
    const guardianId = req.params.guardianId;
    if (guardianId === principal.account.guardianId) {
      throw new BadRequestError("You cannot remove your own guardian profile");
    }

    const studentIds = await getParentAccessibleStudentIds(principal.account.guardianId);
    const links = await db.select().from(studentGuardians)
      .where(and(
        eq(studentGuardians.guardianId, guardianId),
        inArray(studentGuardians.studentId, studentIds),
      ));
    if (!links.length) throw new NotFoundError("Contact not found");

    for (const link of links) {
      const others = await db.select().from(studentGuardians)
        .where(eq(studentGuardians.studentId, link.studentId));
      if (others.length <= 1) {
        throw new ConflictError("Each child must have at least one guardian on file");
      }
    }

    const [portal] = await db.select().from(parentAccounts)
      .where(eq(parentAccounts.guardianId, guardianId)).limit(1);
    if (portal) throw new ConflictError("This contact has a portal login — ask the school to remove it first");

    await db.delete(studentGuardians).where(eq(studentGuardians.guardianId, guardianId));
    await db.delete(guardians).where(and(
      eq(guardians.id, guardianId),
      eq(guardians.tenantId, tenant.id),
    ));

    const data = await loadParentProfile(tenant.id, principal.account);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

portalProfileRouter.post("/profile/photo",
  validate({
    body: z.object({
      fileName: z.string().min(1),
      contentBase64: z.string().min(1),
      mimeType: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      const { validateUpload } = await import("../middleware/upload");
      const { safeName, size } = validateUpload(req.body.fileName, req.body.mimeType, req.body.contentBase64);
      const buffer = Buffer.from(req.body.contentBase64, "base64");
      if (buffer.length !== size) throw new ConflictError("Invalid file payload");

      const {
        writeProfilePhoto,
        profilePhotoApiPath,
      } = await import("../services/profile-photo");
      const apiUrl = `${profilePhotoApiPath(tenant.slug, "portal")}?v=${Date.now()}`;

      if (principal.kind === "student") {
        writeProfilePhoto(tenant.id, "student", principal.account.studentId, buffer);
        await db.update(students).set({ photoUrl: apiUrl, updatedAt: new Date() }).where(and(
          eq(students.id, principal.account.studentId),
          eq(students.tenantId, tenant.id),
        ));
        const data = await loadStudentProfile(tenant.id, tenant.slug, principal.account);
        return res.json({ success: true, data: { photoUrl: apiUrl, profile: data } });
      }

      writeProfilePhoto(tenant.id, "guardian", principal.account.guardianId, buffer);
      await db.update(guardians).set({ photoUrl: apiUrl }).where(and(
        eq(guardians.id, principal.account.guardianId),
        eq(guardians.tenantId, tenant.id),
      ));
      const data = await loadParentProfile(tenant.id, principal.account);
      res.json({ success: true, data: { photoUrl: apiUrl, profile: data } });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.delete("/profile/photo", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    if (principal.kind === "student") {
      throw new ForbiddenError("Students must keep a profile photo on file");
    }
    const fs = await import("fs");
    const { profilePhotoDiskPath } = await import("../services/profile-photo");
    const p = profilePhotoDiskPath(tenant.id, "guardian", principal.account.guardianId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await db.update(guardians).set({ photoUrl: null }).where(and(
      eq(guardians.id, principal.account.guardianId),
      eq(guardians.tenantId, tenant.id),
    ));
    const data = await loadParentProfile(tenant.id, principal.account);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

portalProfileRouter.get("/profile/photo", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const { readProfilePhotoFile } = await import("../services/profile-photo");
    res.setHeader("Cache-Control", "private, max-age=300");
    if (principal.kind === "student") {
      const abs = readProfilePhotoFile(tenant.id, "student", principal.account.studentId);
      if (!abs) throw new NotFoundError("Photo not uploaded");
      return res.sendFile(abs);
    }
    const abs = readProfilePhotoFile(tenant.id, "guardian", principal.account.guardianId);
    if (!abs) throw new NotFoundError("Photo not uploaded");
    res.sendFile(abs);
  } catch (e) { next(e); }
});
