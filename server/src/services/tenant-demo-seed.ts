import { db } from "../db";
import {
  tenants, tenantSettings, roles, rolePermissions, permissions, users, userRoles,
  staff, students, academicYears, terms, classes, streams, studentClassHistory,
  subjects, teacherAssignments, guardians, studentGuardians, parentAccounts, studentAccounts,
  announcements, feeHeads, invoices, messageTemplates,
} from "../db/schema";
import { eq, and, sql, like, inArray } from "drizzle-orm";
import { hashPassword } from "../middleware/auth";
import { resetTenantOperationalData } from "./tenant-data-reset";

export type DemoSeedOptions = { full?: boolean };

export type DemoSeedResult = {
  message: string;
  created: string[];
  stats: {
    students: number;
    parents: number;
    staff: number;
    teachers: number;
    classes: number;
    subjects: number;
  };
  credentials: { label: string; email: string; password: string }[];
};

const DEMO_PASSWORD = "Demo123!";
const PARENT_PASSWORD = "Parent123!";
const STUDENT_PORTAL_PASSWORD = "Student123!";

const UG_SUBJECTS: { code: string; name: string }[] = [
  { code: "MATH", name: "Mathematics" },
  { code: "ENG", name: "English Language" },
  { code: "BIO", name: "Biology" },
  { code: "CHEM", name: "Chemistry" },
  { code: "PHY", name: "Physics" },
  { code: "HIST", name: "History" },
  { code: "GEO", name: "Geography" },
  { code: "CRE", name: "Christian Religious Education" },
  { code: "LIT", name: "Literature in English" },
  { code: "AGR", name: "Agriculture" },
  { code: "ICT", name: "Computer Studies" },
  { code: "LUG", name: "Luganda" },
];

const MALE_FIRST = ["James", "Brian", "David", "Moses", "Patrick", "Samuel", "Henry", "Joseph", "Emmanuel", "Allan", "Ivan", "Oscar"];
const FEMALE_FIRST = ["Grace", "Sarah", "Mary", "Joan", "Ruth", "Faith", "Mercy", "Patricia", "Amina", "Rebecca", "Sharon", "Diana"];
const LAST_NAMES = ["Okello", "Nakato", "Mukasa", "Nabukenya", "Ssemakula", "Kato", "Asiimwe", "Opio", "Aber", "Luwemba", "Tumwine", "Nambi"];

const SENIOR_LEVELS = [
  { name: "Senior 1", level: 1 },
  { name: "Senior 2", level: 2 },
  { name: "Senior 3", level: 3 },
  { name: "Senior 4", level: 4 },
  { name: "Senior 5", level: 5 },
  { name: "Senior 6", level: 6 },
];

/** Uganda secondary calendar for academic year 2025/2026 (avoids invalid month arithmetic). */
const UG_TERM_WINDOWS = [
  { start: "2025-02-03", end: "2025-05-02" },
  { start: "2025-05-26", end: "2025-08-22" },
  { start: "2025-09-15", end: "2025-12-12" },
] as const;

function parseIsoDate(iso: string, label: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label} date: ${iso}`);
  return d;
}

function studentDob(level: number, index: number): Date {
  const year = 2008 - level;
  const month = (index % 12) + 1;
  const day = Math.min(10 + (index % 15), 28);
  return parseIsoDate(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    "student DOB",
  );
}

type StaffSeed = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  emailKey: string;
  roleName?: string;
  subjectCodes?: string[];
  isClassTeacher?: boolean;
};

const STAFF_ROSTER: StaffSeed[] = [
  { employeeNo: "EMP-HT", firstName: "Sarah", lastName: "Nabukenya", department: "Administration", jobTitle: "Head Teacher", emailKey: "headteacher", roleName: "Headteacher" },
  { employeeNo: "EMP-DH", firstName: "Robert", lastName: "Opio", department: "Administration", jobTitle: "Deputy Head Teacher", emailKey: "deputy", roleName: "Deputy Admin" },
  { employeeNo: "EMP-DOS", firstName: "Grace", lastName: "Asiimwe", department: "Administration", jobTitle: "Director of Studies", emailKey: "dos", roleName: "Deputy Admin" },
  { employeeNo: "EMP-BUR", firstName: "Henry", lastName: "Luwemba", department: "Finance", jobTitle: "Bursar", emailKey: "bursar", roleName: "Bursar" },
  { employeeNo: "EMP-SEC", firstName: "Mary", lastName: "Nambi", department: "Administration", jobTitle: "School Secretary", emailKey: "secretary", roleName: "Receptionist" },
  { employeeNo: "EMP-T01", firstName: "Peter", lastName: "Mukasa", department: "Teaching", jobTitle: "Mathematics Teacher", emailKey: "math", roleName: "Teacher", subjectCodes: ["MATH"] },
  { employeeNo: "EMP-T02", firstName: "Joan", lastName: "Nakato", department: "Teaching", jobTitle: "English Teacher", emailKey: "english", roleName: "Teacher", subjectCodes: ["ENG", "LIT"] },
  { employeeNo: "EMP-T03", firstName: "Moses", lastName: "Okello", department: "Teaching", jobTitle: "Biology Teacher", emailKey: "biology", roleName: "Teacher", subjectCodes: ["BIO"] },
  { employeeNo: "EMP-T04", firstName: "Faith", lastName: "Aber", department: "Teaching", jobTitle: "Chemistry Teacher", emailKey: "chemistry", roleName: "Teacher", subjectCodes: ["CHEM"] },
  { employeeNo: "EMP-T05", firstName: "Patrick", lastName: "Kato", department: "Teaching", jobTitle: "Physics Teacher", emailKey: "physics", roleName: "Teacher", subjectCodes: ["PHY"] },
  { employeeNo: "EMP-T06", firstName: "Ruth", lastName: "Tumwine", department: "Teaching", jobTitle: "History Teacher", emailKey: "history", roleName: "Teacher", subjectCodes: ["HIST"] },
  { employeeNo: "EMP-T07", firstName: "Emmanuel", lastName: "Ssemakula", department: "Teaching", jobTitle: "Geography Teacher", emailKey: "geography", roleName: "Teacher", subjectCodes: ["GEO"] },
  { employeeNo: "EMP-T08", firstName: "Mercy", lastName: "Nabukenya", department: "Teaching", jobTitle: "CRE Teacher", emailKey: "cre", roleName: "Teacher", subjectCodes: ["CRE"] },
  { employeeNo: "EMP-T09", firstName: "Samuel", lastName: "Asiimwe", department: "Teaching", jobTitle: "Agriculture Teacher", emailKey: "agriculture", roleName: "Teacher", subjectCodes: ["AGR"] },
  { employeeNo: "EMP-T10", firstName: "Ivan", lastName: "Opio", department: "Teaching", jobTitle: "ICT Teacher", emailKey: "ict", roleName: "Teacher", subjectCodes: ["ICT"] },
  { employeeNo: "EMP-T11", firstName: "Sharon", lastName: "Luwemba", department: "Teaching", jobTitle: "Luganda Teacher", emailKey: "luganda", roleName: "Teacher", subjectCodes: ["LUG"] },
  { employeeNo: "EMP-NUR", firstName: "Patricia", lastName: "Kato", department: "Health", jobTitle: "School Nurse", emailKey: "nurse", roleName: "Nurse" },
  { employeeNo: "EMP-LIB", firstName: "David", lastName: "Mukasa", department: "Library", jobTitle: "Librarian", emailKey: "librarian", roleName: "Librarian" },
  { employeeNo: "EMP-TRN", firstName: "Oscar", lastName: "Okello", department: "Transport", jobTitle: "Transport Officer", emailKey: "transport", roleName: "Transport Officer" },
];

function demoEmail(slug: string, key: string) {
  return `${key}@${slug}.demo`;
}

export function parentEmail(slug: string, admissionNumber: string) {
  return `parent.${admissionNumber.toLowerCase().replace(/-/g, ".")}@${slug}.demo`;
}

export function studentPortalEmail(slug: string, admissionNumber: string) {
  return `student.${admissionNumber.toLowerCase().replace(/-/g, ".")}@${slug}.demo`;
}

/** Create missing demo parent/student portal logins for every student (idempotent). */
export async function ensureDemoPortalAccountsForTenant(tenantId: string, slug: string): Promise<string[]> {
  const created: string[] = [];
  const parentHash = await hashPassword(PARENT_PASSWORD);
  const studentPortalHash = await hashPassword(STUDENT_PORTAL_PASSWORD);
  const studs = await db.select().from(students).where(eq(students.tenantId, tenantId));

  for (const stu of studs) {
    if (!stu.admissionNumber?.trim()) continue;
    const admissionNumber = stu.admissionNumber.trim();
    const isMale = stu.gender === "male";

    const pEmail = parentEmail(slug, admissionNumber);
    let [guardian] = await db.select().from(guardians).where(and(
      eq(guardians.tenantId, tenantId),
      eq(guardians.email, pEmail),
    )).limit(1);
    if (!guardian) {
      [guardian] = await db.insert(guardians).values({
        tenantId,
        firstName: stu.firstName,
        lastName: stu.lastName,
        relationship: isMale ? "father" : "mother",
        phone: null,
        email: pEmail,
        address: null,
      }).returning();
      created.push(`guardian ${admissionNumber}`);
    }

    await db.insert(studentGuardians).values({
      studentId: stu.id,
      guardianId: guardian.id,
      isPrimary: true,
    }).onConflictDoNothing({ target: [studentGuardians.studentId, studentGuardians.guardianId] });

    const [pAcct] = await db.select().from(parentAccounts).where(and(
      eq(parentAccounts.tenantId, tenantId),
      eq(parentAccounts.email, pEmail),
    )).limit(1);
    if (!pAcct) {
      await db.insert(parentAccounts).values({
        tenantId,
        email: pEmail,
        passwordHash: parentHash,
        guardianId: guardian.id,
      });
      created.push(`parent account ${admissionNumber}`);
    }

    const sEmail = studentPortalEmail(slug, admissionNumber);
    const [sAcct] = await db.select().from(studentAccounts).where(and(
      eq(studentAccounts.tenantId, tenantId),
      eq(studentAccounts.email, sEmail),
    )).limit(1);
    if (!sAcct) {
      await db.insert(studentAccounts).values({
        tenantId,
        email: sEmail,
        passwordHash: studentPortalHash,
        studentId: stu.id,
      });
      created.push(`student portal ${admissionNumber}`);
    }
  }

  return created;
}

async function demoStep<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Demo seed (${phase}): ${cause}`);
  }
}

async function ensureRole(
  tenantId: string,
  name: string,
  created: string[],
  permFilter?: (p: { code: string; module: string }) => boolean,
) {
  let [role] = await db.select().from(roles).where(and(eq(roles.tenantId, tenantId), eq(roles.name, name))).limit(1);
  if (!role) {
    const allPerms = await db.select().from(permissions);
    const picked = permFilter ? allPerms.filter(permFilter) : allPerms;
    [role] = await db.insert(roles).values({ tenantId, name, isSystem: true }).returning();
    if (picked.length) {
      await db.insert(rolePermissions).values(picked.map((p) => ({ roleId: role!.id, permissionId: p.id })))
        .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });
    }
    created.push(`role ${name}`);
  }
  return role!;
}

const MODULES_ACADEMIC = ["students", "admissions", "attendance", "academics", "exams", "messaging", "reports", "settings"];
const teacherPermFilter = (p: { code: string }) =>
  ["attendance.view", "attendance.take", "academics.view", "exams.view", "exams.enter_marks", "students.view"].includes(p.code);
const headPermFilter = (p: { code: string; module: string }) =>
  MODULES_ACADEMIC.includes(p.module) && !p.code.startsWith("rbac.");
const financePermFilter = (p: { code: string; module: string }) =>
  p.module === "finance" || p.code === "reports.view";
const hrPermFilter = (p: { code: string; module: string }) => p.module === "hr" || p.code === "payroll.view";

async function purgeDemoPortalAndUsers(tenantId: string, slug: string) {
  try {
    await db.execute(sql`
      UPDATE streams SET class_teacher_user_id = NULL
      WHERE tenant_id = ${tenantId} AND class_teacher_user_id IS NOT NULL
    `);
  } catch {
    /* class_teacher_user_id may be missing on older DBs */
  }
  await db.delete(teacherAssignments).where(eq(teacherAssignments.tenantId, tenantId));
  const portalDeletes = [
    sql`DELETE FROM parent_sessions WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM student_sessions WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM parent_accounts WHERE tenant_id = ${tenantId}`,
    sql`DELETE FROM student_accounts WHERE tenant_id = ${tenantId}`,
  ];
  for (const stmt of portalDeletes) {
    try {
      await db.execute(stmt);
    } catch {
      /* portal tables optional on older DBs */
    }
  }

  const demoUsers = await db.select({ id: users.id }).from(users).where(and(
    eq(users.tenantId, tenantId),
    like(users.email, `%@${slug}.demo`),
  ));
  const demoUserIds = demoUsers.map((u) => u.id);
  if (demoUserIds.length) {
    await db.delete(userRoles).where(and(
      eq(userRoles.tenantId, tenantId),
      inArray(userRoles.userId, demoUserIds),
    ));
    await db.delete(users).where(inArray(users.id, demoUserIds));
  }
}

/** Populate a Uganda secondary school demo (Senior 1–6, parents, teachers, staff). */
export async function seedDemoDataForTenant(
  tenantId: string,
  options: DemoSeedOptions = {},
): Promise<DemoSeedResult> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant not found");

  const created: string[] = [];
  const slug = tenant.slug;

  if (options.full) {
    await demoStep("reset operational data", () => resetTenantOperationalData(tenantId));
    await demoStep("purge demo portal users", () => purgeDemoPortalAndUsers(tenantId, slug));
    created.push("full reset");
  }

  await demoStep("roles", async () => {
    await ensureRole(tenantId, "School Administrator", created);
    await ensureRole(tenantId, "Teacher", created, teacherPermFilter);
    await ensureRole(tenantId, "Headteacher", created, headPermFilter);
    await ensureRole(tenantId, "Deputy Admin", created, headPermFilter);
    await ensureRole(tenantId, "Bursar", created, financePermFilter);
    await ensureRole(tenantId, "Receptionist", created, (p) =>
      ["admissions.view", "admissions.create", "admissions.edit", "students.view", "messaging.view", "messaging.send"].includes(p.code));
    await ensureRole(tenantId, "Nurse", created, (p) => p.module === "health");
    await ensureRole(tenantId, "Librarian", created, (p) => p.module === "library");
    await ensureRole(tenantId, "Transport Officer", created, (p) => p.module === "transport");
  });

  const roleByName = new Map(
    (await db.select().from(roles).where(eq(roles.tenantId, tenantId))).map((r) => [r.name, r]),
  );

  const [existingSettings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const branding = {
    name: tenant.name,
    logoText: tenant.name,
    footer: `${tenant.name} · Kampala, Uganda · UNEB Centre`,
  };
  const settingsBase = {
    country: "UG",
    currency: "UGX",
    timezone: "Africa/Kampala",
    brandingJson: branding,
    updatedAt: new Date(),
  };
  if (!existingSettings) {
    await db.insert(tenantSettings).values({ tenantId, ...settingsBase });
    try {
      await db.update(tenantSettings).set({ curriculumFramework: "UNEB" }).where(eq(tenantSettings.tenantId, tenantId));
    } catch { /* curriculum_framework column optional on older DBs */ }
    created.push("settings");
  } else {
    const settingsPatch: Record<string, unknown> = {
      ...settingsBase,
      brandingJson: { ...(existingSettings.brandingJson as object ?? {}), ...branding },
    };
    try {
      await db.update(tenantSettings).set({
        ...settingsPatch,
        curriculumFramework: existingSettings.curriculumFramework ?? "UNEB",
      }).where(eq(tenantSettings.tenantId, tenantId));
    } catch {
      await db.update(tenantSettings).set(settingsPatch).where(eq(tenantSettings.tenantId, tenantId));
    }
  }

  let [year] = await db.select().from(academicYears).where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.name, "2025/2026"))).limit(1);
  if (!year) {
    [year] = await db.insert(academicYears).values({
      tenantId,
      name: "2025/2026",
      startDate: new Date("2025-02-01"),
      endDate: new Date("2026-12-15"),
      isCurrent: true,
    }).returning();
    created.push("academic year 2025/2026");
  }
  if (!year?.id) throw new Error("Could not resolve academic year 2025/2026");

  const termNames = ["Term 1", "Term 2", "Term 3"];
  const termRows: { id: string; name: string }[] = [];
  for (let i = 0; i < termNames.length; i++) {
    let [term] = await db.select().from(terms).where(and(eq(terms.tenantId, tenantId), eq(terms.name, termNames[i]))).limit(1);
    if (!term) {
      const window = UG_TERM_WINDOWS[i];
      const start = parseIsoDate(window.start, `${termNames[i]} start`);
      const end = parseIsoDate(window.end, `${termNames[i]} end`);
      [term] = await db.insert(terms).values({
        tenantId,
        academicYearId: year.id,
        name: termNames[i],
        startDate: start,
        endDate: end,
        isCurrent: i === 0,
      }).returning();
      created.push(termNames[i]);
    }
    if (!term?.id) throw new Error(`Could not resolve ${termNames[i]}`);
    termRows.push({ id: term.id, name: term.name });
  }
  const currentTerm = termRows.find((t) => t.name === "Term 1") ?? termRows[0];
  if (!currentTerm?.id) throw new Error("No academic term available — create Term 1 first");

  const classMap = new Map<string, { classId: string; streamId: string; level: number }>();
  for (const sr of SENIOR_LEVELS) {
    let [cls] = await db.select().from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.name, sr.name))).limit(1);
    if (!cls) {
      [cls] = await db.insert(classes).values({ tenantId, name: sr.name, level: sr.level }).returning();
      created.push(`class ${sr.name}`);
    }
    let [stream] = await db.select().from(streams).where(and(eq(streams.tenantId, tenantId), eq(streams.classId, cls.id), eq(streams.name, "A"))).limit(1);
    if (!stream) {
      [stream] = await db.insert(streams).values({ tenantId, classId: cls.id, name: "A" }).returning();
      created.push(`stream ${sr.name} A`);
    }
    classMap.set(sr.name, { classId: cls.id, streamId: stream.id, level: sr.level });
  }

  const subjectMap = new Map<string, string>();
  for (const sub of UG_SUBJECTS) {
    let [row] = await db.select().from(subjects).where(and(eq(subjects.tenantId, tenantId), eq(subjects.code, sub.code))).limit(1);
    if (!row) {
      [row] = await db.insert(subjects).values({ tenantId, code: sub.code, name: sub.name }).returning();
      created.push(`subject ${sub.code}`);
    }
    subjectMap.set(sub.code, row.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const parentHash = await hashPassword(PARENT_PASSWORD);
  const studentPortalHash = await hashPassword(STUDENT_PORTAL_PASSWORD);

  for (const emp of STAFF_ROSTER) {
    const email = demoEmail(slug, emp.emailKey);
    let [user] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.email, email))).limit(1);
    if (!user) {
      [user] = await db.insert(users).values({
        tenantId,
        email,
        passwordHash,
        firstName: emp.firstName,
        lastName: emp.lastName,
        status: "active",
      }).returning();
      created.push(`user ${email}`);
    }
    const role = emp.roleName ? roleByName.get(emp.roleName) : roleByName.get("Teacher");
    if (role) {
      await db.insert(userRoles).values({ userId: user.id, roleId: role.id, tenantId })
        .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] });
    }

    let [row] = await db.select().from(staff).where(and(eq(staff.tenantId, tenantId), eq(staff.employeeNo, emp.employeeNo))).limit(1);
    if (!row) {
      try {
        [row] = await db.insert(staff).values({
          tenantId,
          userId: user.id,
          employeeNo: emp.employeeNo,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email,
          department: emp.department,
          jobTitle: emp.jobTitle,
          status: "active",
          hiredAt: new Date("2020-01-15"),
        }).returning();
      } catch {
        [row] = await db.insert(staff).values({
          tenantId,
          userId: user.id,
          employeeNo: emp.employeeNo,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email,
          department: emp.department,
          status: "active",
          hiredAt: new Date("2020-01-15"),
        }).returning();
      }
      created.push(`staff ${emp.employeeNo}`);
    } else if (!row.userId) {
      await db.update(staff).set({ userId: user.id }).where(eq(staff.id, row.id));
    }

    if (emp.subjectCodes?.length) {
      for (const code of emp.subjectCodes) {
        const subjectId = subjectMap.get(code);
        if (!subjectId) continue;
        for (const [, ctx] of classMap) {
          const [existing] = await db.select().from(teacherAssignments).where(and(
            eq(teacherAssignments.tenantId, tenantId),
            eq(teacherAssignments.userId, user.id),
            eq(teacherAssignments.classId, ctx.classId),
            eq(teacherAssignments.subjectId, subjectId),
          )).limit(1);
          if (!existing) {
            await db.insert(teacherAssignments).values({
              tenantId,
              userId: user.id,
              classId: ctx.classId,
              subjectId,
              termId: currentTerm.id,
              role: "subject",
            });
          }
        }
      }
    }
  }

  const [headUser] = await db.select({ id: users.id }).from(users).where(and(
    eq(users.tenantId, tenantId),
    eq(users.email, demoEmail(slug, "headteacher")),
  )).limit(1);
  const headUserId = headUser?.id;
  const s6 = classMap.get("Senior 6");
  if (headUserId && s6) {
    try {
      await db.update(streams).set({ classTeacherUserId: headUserId }).where(eq(streams.id, s6.streamId));
    } catch {
      /* class_teacher_user_id optional on older DBs */
    }
  }

  const STUDENTS_PER_CLASS = 9;
  let studentIndex = 0;
  for (const sr of SENIOR_LEVELS) {
    const ctx = classMap.get(sr.name)!;
    for (let i = 1; i <= STUDENTS_PER_CLASS; i++) {
      studentIndex++;
      const admissionNumber = `S${sr.level}-${String(i).padStart(2, "0")}`;
      const isMale = studentIndex % 2 === 1;
      const firstName = isMale
        ? MALE_FIRST[(studentIndex + sr.level) % MALE_FIRST.length]
        : FEMALE_FIRST[(studentIndex + sr.level) % FEMALE_FIRST.length];
      const lastName = LAST_NAMES[(studentIndex * 3 + sr.level) % LAST_NAMES.length];
      const gender = isMale ? "male" as const : "female" as const;

      let [stu] = await db.select().from(students).where(and(
        eq(students.tenantId, tenantId),
        eq(students.admissionNumber, admissionNumber),
      )).limit(1);
      if (!stu) {
        [stu] = await db.insert(students).values({
          tenantId,
          admissionNumber,
          firstName,
          lastName,
          gender,
          status: "active",
          dob: studentDob(sr.level, studentIndex),
        }).returning();
        created.push(`student ${admissionNumber}`);
      }

      const [hist] = await db.select().from(studentClassHistory).where(and(
        eq(studentClassHistory.studentId, stu.id),
        eq(studentClassHistory.tenantId, tenantId),
        eq(studentClassHistory.classId, ctx.classId),
      )).limit(1);
      if (!hist) {
        await db.insert(studentClassHistory).values({
          tenantId,
          studentId: stu.id,
          classId: ctx.classId,
          streamId: ctx.streamId,
          termId: currentTerm.id,
        });
      }

      const pEmail = parentEmail(slug, admissionNumber);
      let [guardian] = await db.select().from(guardians).where(and(
        eq(guardians.tenantId, tenantId),
        eq(guardians.email, pEmail),
      )).limit(1);
      if (!guardian) {
        const rel = isMale ? "father" : "mother";
        [guardian] = await db.insert(guardians).values({
          tenantId,
          firstName: isMale ? MALE_FIRST[i % MALE_FIRST.length] : FEMALE_FIRST[i % FEMALE_FIRST.length],
          lastName,
          relationship: rel,
          phone: `+2567${String(100000 + studentIndex).padStart(6, "0")}`,
          email: pEmail,
          address: `Plot ${10 + i}, Kampala`,
        }).returning();
        created.push(`guardian ${admissionNumber}`);
      }

      await db.insert(studentGuardians).values({
        studentId: stu.id,
        guardianId: guardian.id,
        isPrimary: true,
      }).onConflictDoNothing({ target: [studentGuardians.studentId, studentGuardians.guardianId] });

      const [acct] = await db.select().from(parentAccounts).where(and(
        eq(parentAccounts.tenantId, tenantId),
        eq(parentAccounts.email, pEmail),
      )).limit(1);
      if (!acct) {
        await db.insert(parentAccounts).values({
          tenantId,
          email: pEmail,
          passwordHash: parentHash,
          guardianId: guardian.id,
        });
        created.push(`parent account ${admissionNumber}`);
      }

      const sEmail = studentPortalEmail(slug, admissionNumber);
      const [stuAcct] = await db.select().from(studentAccounts).where(and(
        eq(studentAccounts.tenantId, tenantId),
        eq(studentAccounts.email, sEmail),
      )).limit(1);
      if (!stuAcct) {
        await db.insert(studentAccounts).values({
          tenantId,
          email: sEmail,
          passwordHash: studentPortalHash,
          studentId: stu.id,
        });
        created.push(`student portal ${admissionNumber}`);
      }
    }
  }

  let [feeHead] = await db.select().from(feeHeads).where(and(eq(feeHeads.tenantId, tenantId), eq(feeHeads.name, "Tuition"))).limit(1);
  if (!feeHead) {
    [feeHead] = await db.insert(feeHeads).values({
      tenantId,
      name: "Tuition",
      feeType: "tuition",
      description: "Term tuition — Uganda secondary",
    }).returning();
    created.push("fee head Tuition");
  }

  const sampleStudents = await db.select().from(students).where(eq(students.tenantId, tenantId)).limit(12);
  const termFeeMinor = 1_200_000_00;
  for (let i = 0; i < sampleStudents.length; i++) {
    const stu = sampleStudents[i];
    const invoiceNo = `INV-DEMO-${String(i + 1).padStart(4, "0")}`;
    const [ex] = await db.select().from(invoices).where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.invoiceNo, invoiceNo),
    )).limit(1);
    if (!ex) {
      const mod = i % 3;
      const paidAmount = mod === 0 ? termFeeMinor : mod === 1 ? 400_000_00 : 0;
      const status = mod === 0 ? "paid" : mod === 1 ? "partial" : "unpaid";
      await db.insert(invoices).values({
        tenantId,
        studentId: stu.id,
        termId: currentTerm.id,
        invoiceNo,
        totalAmount: termFeeMinor,
        paidAmount,
        status,
        dueDate: new Date("2026-03-31"),
      });
    }
  }

  const [ann] = await db.select().from(announcements).where(eq(announcements.tenantId, tenantId)).limit(1);
  if (!ann) {
    await db.insert(announcements).values({
      tenantId,
      title: "Welcome to Term 1",
      body: "All Senior 1–6 students should report by 8:00 AM. Parents may use the portal to view fees and results.",
      published: true,
      audience: "all",
    });
    created.push("announcement");
  }

  const [tpl] = await db.select().from(messageTemplates).where(eq(messageTemplates.tenantId, tenantId)).limit(1);
  if (!tpl) {
    await db.insert(messageTemplates).values({
      tenantId,
      name: "Fee reminder (SMS)",
      channel: "sms",
      body: "Dear parent, school fees for {{student}} are due. Pay via portal or school bursar. — {{school}}",
    });
    created.push("message template");
  }

  const portalBackfill = await demoStep("portal accounts sync", () => ensureDemoPortalAccountsForTenant(tenantId, slug));
  created.push(...portalBackfill);

  const [studentCount] = await db.select({ n: sql<number>`count(*)::int` }).from(students).where(eq(students.tenantId, tenantId));
  const [parentCount] = await db.select({ n: sql<number>`count(*)::int` }).from(guardians).where(eq(guardians.tenantId, tenantId));
  const [staffCount] = await db.select({ n: sql<number>`count(*)::int` }).from(staff).where(eq(staff.tenantId, tenantId));
  const assignRows = await db.select({ userId: teacherAssignments.userId })
    .from(teacherAssignments)
    .where(eq(teacherAssignments.tenantId, tenantId));
  const teachersAssigned = new Set(assignRows.map((r) => r.userId)).size;

  const credentials: DemoSeedResult["credentials"] = [
    { label: "Head teacher (staff ERP)", email: demoEmail(slug, "headteacher"), password: DEMO_PASSWORD },
    { label: "Mathematics teacher (staff ERP)", email: demoEmail(slug, "math"), password: DEMO_PASSWORD },
    { label: "Parent portal (S1-01)", email: parentEmail(slug, "S1-01"), password: PARENT_PASSWORD },
    { label: "Parent portal (S6-05)", email: parentEmail(slug, "S6-05"), password: PARENT_PASSWORD },
    { label: "Student portal (S1-01)", email: studentPortalEmail(slug, "S1-01"), password: STUDENT_PORTAL_PASSWORD },
    { label: "Student portal (S6-05)", email: studentPortalEmail(slug, "S6-05"), password: STUDENT_PORTAL_PASSWORD },
  ];

  return {
    message: options.full
      ? "Full Uganda secondary demo loaded (reset + seed)."
      : created.length
        ? "Demo data added or updated."
        : "Demo data already complete.",
    created,
    stats: {
      students: Number(studentCount?.n ?? 0),
      parents: Number(parentCount?.n ?? 0),
      staff: Number(staffCount?.n ?? 0),
      teachers: teachersAssigned,
      classes: SENIOR_LEVELS.length,
      subjects: UG_SUBJECTS.length,
    },
    credentials,
  };
}
