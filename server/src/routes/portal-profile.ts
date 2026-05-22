import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  guardians, parentAccounts, studentGuardians, students,
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
    },
    preferences: {
      theme: prefs.theme === "light" ? "light" as const : "dark" as const,
    },
    children,
    contacts: [...contactsById.values()].sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : 0)),
  };
}

portalProfileRouter.get("/profile", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = requireParent(req);
    const data = await loadParentProfile(tenant.id, principal.account);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

portalProfileRouter.patch("/profile",
  validate({ body: guardianBodySchema.partial() }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = requireParent(req);
      const patch: Record<string, unknown> = { ...req.body };
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
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
);

portalProfileRouter.patch("/profile/preferences",
  validate({ body: z.object({ theme: z.enum(["light", "dark"]) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = requireParent(req);
      const prefs = { theme: req.body.theme };
      const [updated] = await db.update(parentAccounts).set({
        preferencesJson: prefs,
        updatedAt: new Date(),
      }).where(and(
        eq(parentAccounts.id, principal.account.id),
        eq(parentAccounts.tenantId, tenant.id),
      )).returning();
      if (!updated) throw new NotFoundError("Account not found");

      const data = await loadParentProfile(tenant.id, updated);
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
      const principal = requireParent(req);
      const ok = await verifyPassword(req.body.currentPassword, principal.account.passwordHash);
      if (!ok) throw new UnauthorizedError("Current password is incorrect");

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
      const principal = requireParent(req);
      const ok = await verifyPassword(req.body.currentPassword, principal.account.passwordHash);
      if (!ok) throw new UnauthorizedError("Current password is incorrect");

      const passwordHash = await hashPassword(req.body.newPassword);
      await db.update(parentAccounts).set({ passwordHash, updatedAt: new Date() })
        .where(eq(parentAccounts.id, principal.account.id));
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
