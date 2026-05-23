import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { students } from "../db/schema";
import { BadRequestError, NotFoundError } from "../middleware/error";

export type PendingProfileFields = {
  phone?: string;
  email?: string;
  address?: string;
  shortBio?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
};

export async function submitStudentPendingProfile(
  tenantId: string,
  studentId: string,
  fields: PendingProfileFields,
) {
  const [existing] = await db.select().from(students).where(and(
    eq(students.id, studentId),
    eq(students.tenantId, tenantId),
  )).limit(1);
  if (!existing) throw new NotFoundError("Student not found");

  const pending = {
    phone: fields.phone ?? existing.phone ?? "",
    email: fields.email ?? existing.email ?? "",
    address: fields.address ?? existing.address ?? "",
    shortBio: fields.shortBio ?? existing.shortBio ?? "",
    emergencyContact: fields.emergencyContact ?? (existing.medicalJson as any)?.emergencyContact ?? "",
    emergencyPhone: fields.emergencyPhone ?? (existing.medicalJson as any)?.emergencyPhone ?? "",
    submittedAt: new Date().toISOString(),
  };

  await db.update(students).set({
    pendingProfileJson: pending,
    updatedAt: new Date(),
  }).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId)));

  return pending;
}

export async function approveStudentPendingProfile(tenantId: string, studentId: string) {
  const [existing] = await db.select().from(students).where(and(
    eq(students.id, studentId),
    eq(students.tenantId, tenantId),
  )).limit(1);
  if (!existing) throw new NotFoundError("Student not found");
  const pending = existing.pendingProfileJson;
  if (!pending) throw new BadRequestError("No pending profile changes to approve");

  const medical = { ...(existing.medicalJson as object ?? {}) } as Record<string, string>;
  if (pending.emergencyContact !== undefined) medical.emergencyContact = pending.emergencyContact || "";
  if (pending.emergencyPhone !== undefined) medical.emergencyPhone = pending.emergencyPhone || "";

  const [updated] = await db.update(students).set({
    phone: pending.phone || null,
    email: pending.email || null,
    address: pending.address || null,
    shortBio: pending.shortBio || null,
    medicalJson: medical,
    pendingProfileJson: null,
    updatedAt: new Date(),
  }).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).returning();

  return updated;
}

export async function rejectStudentPendingProfile(tenantId: string, studentId: string) {
  const [updated] = await db.update(students).set({
    pendingProfileJson: null,
    updatedAt: new Date(),
  }).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).returning();
  if (!updated) throw new NotFoundError("Student not found");
  return updated;
}

export async function listStudentsWithPendingProfiles(tenantId: string) {
  return db.select({
    id: students.id,
    admissionNumber: students.admissionNumber,
    firstName: students.firstName,
    lastName: students.lastName,
    pendingProfileJson: students.pendingProfileJson,
    updatedAt: students.updatedAt,
  }).from(students).where(and(
    eq(students.tenantId, tenantId),
    isNull(students.deletedAt),
  )).orderBy(desc(students.updatedAt));
}

export function filterPendingOnly(rows: Awaited<ReturnType<typeof listStudentsWithPendingProfiles>>) {
  return rows.filter((r) => r.pendingProfileJson != null);
}
