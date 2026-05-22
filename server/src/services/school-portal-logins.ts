import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  guardians,
  parentAccounts,
  studentAccounts,
  students,
  studentGuardians,
} from "../db/schema";
import { portalLoginPath } from "../lib/app-origin";

export const DEMO_PARENT_PORTAL_PASSWORD = "Parent123!";
export const DEMO_STUDENT_PORTAL_PASSWORD = "Student123!";

export type PortalLoginRow = {
  type: "parent" | "student";
  email: string;
  status: string;
  studentAdmissionNumber: string | null;
  studentName: string | null;
  guardianName: string | null;
  isDemoAccount: boolean;
  suggestedPassword: string | null;
};

export async function listSchoolPortalLogins(tenantId: string, slug: string) {
  const portalUrl = await portalLoginPath(slug);

  const parentRows = await db
    .select({
      email: parentAccounts.email,
      status: parentAccounts.status,
      admissionNumber: students.admissionNumber,
      studentFirst: students.firstName,
      studentLast: students.lastName,
      guardianFirst: guardians.firstName,
      guardianLast: guardians.lastName,
    })
    .from(parentAccounts)
    .innerJoin(guardians, eq(guardians.id, parentAccounts.guardianId))
    .innerJoin(studentGuardians, eq(studentGuardians.guardianId, guardians.id))
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .where(eq(parentAccounts.tenantId, tenantId))
    .orderBy(students.admissionNumber);

  const studentRows = await db
    .select({
      email: studentAccounts.email,
      status: studentAccounts.status,
      admissionNumber: students.admissionNumber,
      studentFirst: students.firstName,
      studentLast: students.lastName,
    })
    .from(studentAccounts)
    .innerJoin(students, eq(students.id, studentAccounts.studentId))
    .where(eq(studentAccounts.tenantId, tenantId))
    .orderBy(students.admissionNumber);

  const demoSuffix = `@${slug}.demo`;

  const parents: PortalLoginRow[] = parentRows.map((r) => {
    const isDemo = r.email.endsWith(demoSuffix);
    return {
      type: "parent" as const,
      email: r.email,
      status: r.status,
      studentAdmissionNumber: r.admissionNumber,
      studentName: `${r.studentFirst} ${r.studentLast}`.trim(),
      guardianName: `${r.guardianFirst} ${r.guardianLast}`.trim(),
      isDemoAccount: isDemo,
      suggestedPassword: isDemo ? DEMO_PARENT_PORTAL_PASSWORD : null,
    };
  });

  const studentLogins: PortalLoginRow[] = studentRows.map((r) => {
    const isDemo = r.email.endsWith(demoSuffix);
    return {
      type: "student" as const,
      email: r.email,
      status: r.status,
      studentAdmissionNumber: r.admissionNumber,
      studentName: `${r.studentFirst} ${r.studentLast}`.trim(),
      guardianName: null,
      isDemoAccount: isDemo,
      suggestedPassword: isDemo ? DEMO_STUDENT_PORTAL_PASSWORD : null,
    };
  });

  const [parentTotal] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(parentAccounts)
    .where(eq(parentAccounts.tenantId, tenantId));
  const [studentTotal] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(studentAccounts)
    .where(eq(studentAccounts.tenantId, tenantId));

  const samples = {
    parent: parents.filter((p) => p.isDemoAccount).slice(0, 3),
    student: studentLogins.filter((s) => s.isDemoAccount).slice(0, 3),
  };

  return {
    portalUrl,
    parentPortalUrl: portalUrl,
    studentPortalUrl: portalUrl,
    note: "Parents and students use the same login page; the system detects account type by email.",
    demoPasswords: {
      parent: DEMO_PARENT_PORTAL_PASSWORD,
      student: DEMO_STUDENT_PORTAL_PASSWORD,
    },
    counts: {
      parents: Number(parentTotal?.n ?? 0),
      students: Number(studentTotal?.n ?? 0),
    },
    parents,
    students: studentLogins,
    samples,
  };
}
