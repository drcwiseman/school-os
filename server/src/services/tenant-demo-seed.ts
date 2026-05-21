import { db } from "../db";
import {
  tenants, tenantSettings, roles, rolePermissions, permissions, users, userRoles,
  staff, students, academicYears, terms, classes, streams, studentClassHistory,
  subjects, teacherAssignments,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../middleware/auth";

/** Populate a tenant with sample academics, staff, and students (idempotent). */
export async function seedDemoDataForTenant(tenantId: string): Promise<{ message: string; created: string[] }> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant not found");

  const created: string[] = [];
  const allPerms = await db.select().from(permissions);

  let [adminRole] = await db.select().from(roles).where(and(eq(roles.tenantId, tenantId), eq(roles.name, "School Administrator"))).limit(1);
  if (!adminRole) {
    [adminRole] = await db.insert(roles).values({ tenantId, name: "School Administrator", isSystem: true }).returning();
    await db.insert(rolePermissions).values(allPerms.map((p) => ({ roleId: adminRole!.id, permissionId: p.id }))).onConflictDoNothing();
    created.push("admin role");
  }

  const [existingSettings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  if (!existingSettings) {
    await db.insert(tenantSettings).values({ tenantId, country: "UG", currency: "UGX", timezone: "Africa/Kampala" });
    created.push("settings");
  }

  const demoStaff = [
    { employeeNo: "EMP-D01", firstName: "Sarah", lastName: "Nabukenya", department: "Headteacher", email: "headteacher@demo.local" },
    { employeeNo: "EMP-D02", firstName: "John", lastName: "Okello", department: "Teacher", email: "john.teacher@demo.local" },
    { employeeNo: "EMP-D03", firstName: "Peter", lastName: "Mukasa", department: "Teacher", email: "peter.teacher@demo.local" },
  ];
  for (const e of demoStaff) {
    const [ex] = await db.select().from(staff).where(and(eq(staff.tenantId, tenantId), eq(staff.employeeNo, e.employeeNo))).limit(1);
    if (!ex) {
      await db.insert(staff).values({ tenantId, ...e, status: "active" });
      created.push(`staff ${e.employeeNo}`);
    }
  }

  const demoStudents = [
    { admissionNumber: "DEMO-001", firstName: "Amina", lastName: "Nakato", gender: "female" as const },
    { admissionNumber: "DEMO-002", firstName: "Brian", lastName: "Okello", gender: "male" as const },
    { admissionNumber: "DEMO-003", firstName: "Chloe", lastName: "Mirembe", gender: "female" as const },
  ];
  for (const s of demoStudents) {
    const [ex] = await db.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.admissionNumber, s.admissionNumber))).limit(1);
    if (!ex) {
      await db.insert(students).values({ tenantId, ...s, status: "active" });
      created.push(`student ${s.admissionNumber}`);
    }
  }

  let [year] = await db.select().from(academicYears).where(eq(academicYears.tenantId, tenantId)).limit(1);
  if (!year) {
    [year] = await db.insert(academicYears).values({
      tenantId, name: "2025/2026",
      startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true,
    }).returning();
    created.push("academic year");
  }

  let [term] = await db.select().from(terms).where(eq(terms.tenantId, tenantId)).limit(1);
  if (!term) {
    [term] = await db.insert(terms).values({
      tenantId, academicYearId: year.id, name: "Term 1",
      startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true,
    }).returning();
    created.push("term");
  }

  let [cls] = await db.select().from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.name, "Primary 5"))).limit(1);
  if (!cls) {
    [cls] = await db.insert(classes).values({ tenantId, name: "Primary 5", level: 5 }).returning();
    created.push("class");
  }

  let [stream] = await db.select().from(streams).where(and(eq(streams.tenantId, tenantId), eq(streams.classId, cls.id))).limit(1);
  if (!stream) {
    [stream] = await db.insert(streams).values({ tenantId, classId: cls.id, name: "A" }).returning();
    created.push("stream");
  }

  const subjNames = ["Mathematics", "English", "Science"];
  for (const name of subjNames) {
    const code = name.slice(0, 4).toUpperCase().replace(/\s/g, "");
    const [ex] = await db.select().from(subjects).where(and(eq(subjects.tenantId, tenantId), eq(subjects.code, code))).limit(1);
    if (!ex) await db.insert(subjects).values({ tenantId, name, code });
  }

  const enrolled = await db.select().from(students).where(eq(students.tenantId, tenantId)).limit(10);
  for (const st of enrolled) {
    const [hist] = await db.select().from(studentClassHistory).where(and(
      eq(studentClassHistory.studentId, st.id),
      eq(studentClassHistory.tenantId, tenantId),
      eq(studentClassHistory.classId, cls.id),
    )).limit(1);
    if (!hist) {
      await db.insert(studentClassHistory).values({
        tenantId, studentId: st.id, classId: cls.id, streamId: stream.id, termId: term.id,
      });
    }
  }

  const adminEmail = `demo-admin@${tenant.slug}.local`;
  const [existingUser] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!existingUser) {
    const passwordHash = await hashPassword("Demo123!");
    const [u] = await db.insert(users).values({
      tenantId, email: adminEmail, passwordHash, firstName: "Demo", lastName: "Admin", status: "active",
    }).returning();
    await db.insert(userRoles).values({ userId: u.id, roleId: adminRole.id, tenantId }).onConflictDoNothing();
    created.push("demo admin user");
  }

  return {
    message: created.length ? "Demo data added or already present." : "Demo data already complete.",
    created,
  };
}
