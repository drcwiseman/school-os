import { db } from "../db";
import {
  tenantSettings, academicYears, terms, classes, streams, users, students, roles, announcements,
} from "../db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export type WizardStep = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export async function getSetupWizardStatus(tenantId: string) {
  const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const branding = (settings?.brandingJson ?? {}) as Record<string, string>;
  const wizard = (settings?.setupWizardJson ?? {}) as { completedAt?: string; skippedSteps?: string[] };

  const [yearCount] = await db.select({ n: sql<number>`count(*)` }).from(academicYears).where(eq(academicYears.tenantId, tenantId));
  const [termCount] = await db.select({ n: sql<number>`count(*)` }).from(terms).where(eq(terms.tenantId, tenantId));
  const [classCount] = await db.select({ n: sql<number>`count(*)` }).from(classes).where(eq(classes.tenantId, tenantId));
  const [streamCount] = await db.select({ n: sql<number>`count(*)` }).from(streams).where(eq(streams.tenantId, tenantId));
  const [userCount] = await db.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)));
  const [roleCount] = await db.select({ n: sql<number>`count(*)` }).from(roles).where(eq(roles.tenantId, tenantId));
  const [studentCount] = await db.select({ n: sql<number>`count(*)` }).from(students).where(and(eq(students.tenantId, tenantId), isNull(students.deletedAt)));

  const steps: WizardStep[] = [
    {
      id: "school_profile",
      label: "School profile & branding",
      done: Boolean(branding.name || branding.logoText || settings?.country),
      hint: "Set school name, country, and logo in Settings or complete below",
    },
    {
      id: "academic_session",
      label: "Academic year & term",
      done: Number(yearCount?.n ?? 0) > 0 && Number(termCount?.n ?? 0) > 0,
      hint: "Create at least one academic year and term",
    },
    {
      id: "classes_sections",
      label: "Classes & sections",
      done: Number(classCount?.n ?? 0) > 0,
      hint: "Add classes; optional sections (streams) per class",
    },
    {
      id: "users_roles",
      label: "Staff users & roles",
      done: Number(userCount?.n ?? 0) > 1 && Number(roleCount?.n ?? 0) > 0,
      hint: "Invite administrators and teachers; assign roles",
    },
    {
      id: "students",
      label: "Student records",
      done: Number(studentCount?.n ?? 0) > 0,
      hint: "Enroll students via Admissions or Students",
    },
    {
      id: "noticeboard",
      label: "First announcement",
      done: (await db.select({ n: sql<number>`count(*)` }).from(announcements).where(eq(announcements.tenantId, tenantId)))[0]?.n > 0,
      hint: "Publish a welcome notice for parents and students",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const complete = Boolean(wizard.completedAt) || doneCount >= steps.length - 1;

  return {
    steps,
    doneCount,
    totalSteps: steps.length,
    percentComplete: Math.round((doneCount / steps.length) * 100),
    complete,
    completedAt: wizard.completedAt ?? null,
    streamCount: Number(streamCount?.n ?? 0),
  };
}
