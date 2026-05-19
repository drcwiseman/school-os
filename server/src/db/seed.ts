import dotenv from "dotenv";
dotenv.config();

import { db } from "./index";
import {
  tenants, tenantSettings, users, permissions, roles, rolePermissions, userRoles,
  students, classes, studentClassHistory, academicYears, terms,
  guardians, studentGuardians, platformAdmins, plans, planRegionalPrices, tenantPlans,
  parentAccounts, studentAccounts, messageTemplates, announcements, campaigns,
  features, tenantFeatures,
} from "./schema";
import { hashPassword } from "../middleware/auth";

const PERMISSION_DEFS = [
  // students
  { code: "students.view",           module: "students",    description: "View students" },
  { code: "students.create",         module: "students",    description: "Create students" },
  { code: "students.edit",           module: "students",    description: "Edit students" },
  { code: "students.delete",         module: "students",    description: "Delete/deactivate students" },
  // admissions
  { code: "admissions.view",         module: "admissions",  description: "View applicants" },
  { code: "admissions.create",       module: "admissions",  description: "Create applicants" },
  { code: "admissions.edit",         module: "admissions",  description: "Edit applicants" },
  { code: "admissions.enroll",       module: "admissions",  description: "Enroll applicant as student" },
  // attendance
  { code: "attendance.view",         module: "attendance",  description: "View attendance" },
  { code: "attendance.take",         module: "attendance",  description: "Take attendance" },
  { code: "attendance.edit",         module: "attendance",  description: "Edit attendance records" },
  // academics
  { code: "academics.view",          module: "academics",   description: "View academic setup" },
  { code: "academics.manage",        module: "academics",   description: "Manage classes/subjects/terms" },
  // exams
  { code: "exams.view",              module: "exams",       description: "View exams and marks" },
  { code: "exams.enter_marks",       module: "exams",       description: "Enter marks" },
  { code: "exams.moderate",          module: "exams",       description: "Moderate submitted marks" },
  { code: "exams.publish",           module: "exams",       description: "Publish results" },
  { code: "exams.override.after_deadline", module: "exams", description: "Override marks after deadline" },
  // finance
  { code: "finance.view",            module: "finance",     description: "View finance records" },
  { code: "finance.invoice.create",  module: "finance",     description: "Create invoices" },
  { code: "finance.payment.create",  module: "finance",     description: "Record payments" },
  { code: "finance.refund.create",   module: "finance",     description: "Process refunds" },
  { code: "finance.override.backdate", module: "finance",   description: "Backdate financial entries" },
  // hr
  { code: "hr.view",                 module: "hr",          description: "View staff records" },
  { code: "hr.manage",               module: "hr",          description: "Manage staff records" },
  // payroll
  { code: "payroll.view",            module: "payroll",     description: "View payroll" },
  { code: "payroll.run",             module: "payroll",     description: "Run payroll" },
  { code: "payroll.approve",         module: "payroll",     description: "Approve payroll" },
  // discipline
  { code: "discipline.view",         module: "discipline",  description: "View discipline records" },
  { code: "discipline.manage",       module: "discipline",  description: "Manage discipline records" },
  // health
  { code: "health.view",             module: "health",      description: "View health records" },
  { code: "health.manage",           module: "health",      description: "Manage health records" },
  // library
  { code: "library.view",            module: "library",     description: "View library records" },
  { code: "library.manage",          module: "library",     description: "Manage library records" },
  // inventory
  { code: "inventory.view",          module: "inventory",   description: "View inventory" },
  { code: "inventory.manage",        module: "inventory",   description: "Manage inventory" },
  // transport
  { code: "transport.view",          module: "transport",   description: "View transport" },
  { code: "transport.manage",        module: "transport",   description: "Manage transport" },
  // boarding
  { code: "boarding.view",           module: "boarding",    description: "View boarding" },
  { code: "boarding.manage",         module: "boarding",    description: "Manage boarding" },
  // messaging
  { code: "messaging.view",          module: "messaging",   description: "View messages" },
  { code: "messaging.send",          module: "messaging",   description: "Send messages/campaigns" },
  // reports
  { code: "reports.view",            module: "reports",     description: "View reports" },
  { code: "reports.export",          module: "reports",     description: "Export reports" },
  // settings
  { code: "settings.view",           module: "settings",    description: "View settings" },
  { code: "settings.manage",         module: "settings",    description: "Manage school settings" },
  { code: "settings.users.view",     module: "settings",    description: "View users list" },
  { code: "settings.users.manage",   module: "settings",    description: "Manage users" },
  // rbac
  { code: "rbac.manage.roles",       module: "rbac",        description: "Manage roles" },
  { code: "rbac.manage.permissions", module: "rbac",        description: "Manage permissions" },
  // audit
  { code: "audit.view",              module: "audit",       description: "View audit logs" },
];

async function seedTenantRole(tenantId: string, name: string, perms: { id: string }[]) {
  const { eq, and } = await import("drizzle-orm");
  const [existing] = await db.select().from(roles).where(and(eq(roles.tenantId, tenantId), eq(roles.name, name))).limit(1);
  if (existing) return;
  const [role] = await db.insert(roles).values({ tenantId, name }).returning();
  if (role && perms.length) {
    await db.insert(rolePermissions).values(perms.map((p) => ({ roleId: role.id, permissionId: p.id }))).onConflictDoNothing();
  }
}

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Upsert global permissions
  console.log("  → permissions...");
  for (const p of PERMISSION_DEFS) {
    await db.insert(permissions).values(p).onConflictDoNothing();
  }
  const allPerms = await db.select().from(permissions);

  // Platform admin + plans
  console.log("  → platform...");
  const planDefs = [
    {
      code: "starter", name: "Starter", priceMonthly: 0,
      featuresJson: { messaging_enabled: true, portal_enabled: false, results_visible: true, fees_must_be_clear: false } as Record<string, boolean>,
    },
    {
      code: "pro", name: "Professional", priceMonthly: 9900,
      featuresJson: { messaging_enabled: true, portal_enabled: true, results_visible: true, fees_must_be_clear: false } as Record<string, boolean>,
    },
  ];
  for (const p of planDefs) {
    await db.insert(plans).values(p).onConflictDoNothing();
  }
  const seededPlans = await db.select().from(plans);
  const regionalDefs: { code: string; countryCode: string; currency: string; priceMonthly: number }[] = [
    { code: "starter", countryCode: "*", currency: "USD", priceMonthly: 0 },
    { code: "pro", countryCode: "*", currency: "USD", priceMonthly: 9900 },
    { code: "starter", countryCode: "KE", currency: "KES", priceMonthly: 0 },
    { code: "pro", countryCode: "KE", currency: "KES", priceMonthly: 499900 },
    { code: "starter", countryCode: "NG", currency: "NGN", priceMonthly: 0 },
    { code: "pro", countryCode: "NG", currency: "NGN", priceMonthly: 4500000 },
    { code: "starter", countryCode: "GB", currency: "GBP", priceMonthly: 0 },
    { code: "pro", countryCode: "GB", currency: "GBP", priceMonthly: 7900 },
    { code: "starter", countryCode: "EU", currency: "EUR", priceMonthly: 0 },
    { code: "pro", countryCode: "*", currency: "EUR", priceMonthly: 8900 },
  ];
  for (const r of regionalDefs) {
    const plan = seededPlans.find((p) => p.code === r.code);
    if (!plan) continue;
    await db.insert(planRegionalPrices).values({
      planId: plan.id,
      countryCode: r.countryCode,
      currency: r.currency,
      priceMonthly: r.priceMonthly,
    }).onConflictDoNothing();
  }
  const [platformAdmin] = await db.select().from(platformAdmins).where((await import("drizzle-orm")).eq(platformAdmins.email, "platform@schoolos.local")).limit(1);
  if (!platformAdmin) {
    const passwordHash = await hashPassword("Platform123!");
    await db.insert(platformAdmins).values({
      email: "platform@schoolos.local", passwordHash, name: "Platform Operator",
    });
  }

  // 2. Seed two demo tenants
  const demos = [
    { slug: "school-a", name: "Greenfield Academy", adminEmail: "admin@school-a.com", adminFirst: "Alice", adminLast: "Admin" },
    { slug: "school-b", name: "Sunridge High School", adminEmail: "admin@school-b.com", adminFirst: "Bob", adminLast: "Admin" },
  ];

  for (const demo of demos) {
    console.log(`  → tenant: ${demo.slug}...`);
    const [existing] = await db.select().from(tenants).where((t: any) => t.slug.equals ? undefined : undefined).limit(0);

    // idempotent: skip if slug exists
    const { eq } = await import("drizzle-orm");
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, demo.slug)).limit(1);
    const resolvedTenant = tenant ?? (await db.insert(tenants).values({ slug: demo.slug, name: demo.name, status: "active" }).returning())[0];

    // settings
    const { eq: eq2 } = await import("drizzle-orm");
    const [existingSettings] = await db.select().from(tenantSettings).where(eq2(tenantSettings.tenantId, resolvedTenant.id)).limit(1);
    if (!existingSettings) {
      await db.insert(tenantSettings).values({
        tenantId: resolvedTenant.id,
        country: demo.slug === "school-a" ? "KE" : "US",
        currency: demo.slug === "school-a" ? "KES" : "USD",
        timezone: demo.slug === "school-a" ? "Africa/Nairobi" : "UTC",
      });
    }

    // Admin role with all permissions
    let [adminRole] = await db.select().from(roles).where(eq2(roles.tenantId, resolvedTenant.id)).limit(1);
    if (!adminRole) {
      [adminRole] = await db.insert(roles).values({ tenantId: resolvedTenant.id, name: "Tenant Admin", isSystem: true }).returning();
      await db.insert(rolePermissions).values(allPerms.map((p: any) => ({ roleId: adminRole.id, permissionId: p.id })));
    }

    await seedTenantRole(resolvedTenant.id, "Bursar",
      allPerms.filter((p: any) => p.module === "finance" || p.code === "reports.view"));
    await seedTenantRole(resolvedTenant.id, "Teacher",
      allPerms.filter((p: any) => ["attendance.view","attendance.take","academics.view","exams.view","exams.enter_marks","students.view"].includes(p.code)));
    await seedTenantRole(resolvedTenant.id, "HR Manager",
      allPerms.filter((p: any) => p.module === "hr" || p.code === "payroll.view"));
    await seedTenantRole(resolvedTenant.id, "Librarian", allPerms.filter((p: any) => p.module === "library"));
    await seedTenantRole(resolvedTenant.id, "Nurse", allPerms.filter((p: any) => p.module === "health"));
    await seedTenantRole(resolvedTenant.id, "Transport Officer", allPerms.filter((p: any) => p.module === "transport"));
    await seedTenantRole(resolvedTenant.id, "Boarding Master", allPerms.filter((p: any) => p.module === "boarding"));
    await seedTenantRole(resolvedTenant.id, "Deputy Admin",
      allPerms.filter((p: any) =>
        ["students", "admissions", "attendance", "academics", "exams", "messaging", "reports", "settings"].includes(p.module)
        && !p.code.startsWith("rbac."),
      ));
    await seedTenantRole(resolvedTenant.id, "Receptionist",
      allPerms.filter((p: any) =>
        ["admissions.view", "admissions.create", "admissions.edit", "students.view", "messaging.view", "messaging.send"].includes(p.code),
      ));

    // Default tenant features (relational)
    const featureRows = await db.select().from(features);
    for (const f of featureRows) {
      await db.insert(tenantFeatures).values({
        tenantId: resolvedTenant.id, featureId: f.id, enabled: true,
      }).onConflictDoNothing();
    }

    // Admin user
    const [existingUser] = await db.select().from(users).where(eq2(users.email, demo.adminEmail)).limit(1);
    if (!existingUser) {
      const passwordHash = await hashPassword("Password123!");
      const [adminUser] = await db.insert(users).values({
        tenantId: resolvedTenant.id, email: demo.adminEmail, passwordHash,
        firstName: demo.adminFirst, lastName: demo.adminLast, status: "active",
      }).returning();
      await db.insert(userRoles).values({ userId: adminUser.id, roleId: adminRole.id, tenantId: resolvedTenant.id }).onConflictDoNothing();
    }

    // Demo students
    const demoStudents = [
      { admissionNumber: "STU-001", firstName: "James", lastName: "Kariuki", gender: "male" as const },
      { admissionNumber: "STU-002", firstName: "Grace", lastName: "Mwangi", gender: "female" as const },
      { admissionNumber: "STU-003", firstName: "Kevin", lastName: "Otieno", gender: "male" as const },
    ];
    for (const s of demoStudents) {
      await db.insert(students).values({ ...s, tenantId: resolvedTenant.id }).onConflictDoNothing();
    }

    // Academic year, term, class for attendance demos
    let [year] = await db.select().from(academicYears).where(eq2(academicYears.tenantId, resolvedTenant.id)).limit(1);
    if (!year) {
      [year] = await db.insert(academicYears).values({
        tenantId: resolvedTenant.id, name: "2025/2026",
        startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true,
      }).returning();
    }
    let [term] = await db.select().from(terms).where(eq2(terms.tenantId, resolvedTenant.id)).limit(1);
    if (!term) {
      [term] = await db.insert(terms).values({
        tenantId: resolvedTenant.id, academicYearId: year.id, name: "Term 1",
        startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isCurrent: true,
      }).returning();
    }
    let [gradeClass] = await db.select().from(classes).where(eq2(classes.tenantId, resolvedTenant.id)).limit(1);
    if (!gradeClass) {
      [gradeClass] = await db.insert(classes).values({ tenantId: resolvedTenant.id, name: "Grade 10", level: 10 }).returning();
    }
    const enrolled = await db.select().from(students).where(eq2(students.tenantId, resolvedTenant.id));
    for (const stu of enrolled) {
      const [hist] = await db.select().from(studentClassHistory).where(eq2(studentClassHistory.studentId, stu.id)).limit(1);
      if (!hist) {
        await db.insert(studentClassHistory).values({
          tenantId: resolvedTenant.id, studentId: stu.id, classId: gradeClass.id, termId: term.id,
        });
      }
    }

    // Plan assignment
    const [starterPlan] = await db.select().from(plans).where(eq2(plans.code, "starter")).limit(1);
    if (starterPlan) {
      const [tp] = await db.select().from(tenantPlans).where(eq2(tenantPlans.tenantId, resolvedTenant.id)).limit(1);
      if (!tp) await db.insert(tenantPlans).values({ tenantId: resolvedTenant.id, planId: starterPlan.id });
    }

    // Demo guardian + parent portal (school-a only)
    if (demo.slug === "school-a") {
      let [guardian] = await db.select().from(guardians).where(eq2(guardians.email, "parent@school-a.com")).limit(1);
      if (!guardian) {
        [guardian] = await db.insert(guardians).values({
          tenantId: resolvedTenant.id, firstName: "Mary", lastName: "Kariuki",
          relationship: "mother", phone: "+15550001", email: "parent@school-a.com",
        }).returning();
      }
      const [firstStudent] = await db.select().from(students).where(eq2(students.tenantId, resolvedTenant.id)).limit(1);
      if (firstStudent && guardian) {
        await db.insert(studentGuardians).values({ studentId: firstStudent.id, guardianId: guardian.id, isPrimary: true }).onConflictDoNothing();
        const [parentAcct] = await db.select().from(parentAccounts).where(eq2(parentAccounts.email, "parent@school-a.com")).limit(1);
        if (!parentAcct) {
          const ph = await hashPassword("Parent123!");
          await db.insert(parentAccounts).values({
            tenantId: resolvedTenant.id, email: "parent@school-a.com", passwordHash: ph,
            guardianId: guardian.id,
          });
        }
      }
      const [secondStudent] = await db.select().from(students).where(eq2(students.admissionNumber, "STU-002")).limit(1);
      if (secondStudent) {
        const [studentAcct] = await db.select().from(studentAccounts).where(eq2(studentAccounts.email, "student@school-a.com")).limit(1);
        if (!studentAcct) {
          const ph = await hashPassword("Student123!");
          await db.insert(studentAccounts).values({
            tenantId: resolvedTenant.id, email: "student@school-a.com", passwordHash: ph,
            studentId: secondStudent.id,
          });
        }
      }
    }

    // Messaging demo
    const [tpl] = await db.select().from(messageTemplates).where(eq2(messageTemplates.tenantId, resolvedTenant.id)).limit(1);
    if (!tpl) {
      const [template] = await db.insert(messageTemplates).values({
        tenantId: resolvedTenant.id, name: "Fee Reminder", channel: "sms",
        body: "Dear parent, please settle outstanding school fees. Thank you.",
      }).returning();
      await db.insert(announcements).values({
        tenantId: resolvedTenant.id, title: "Welcome back", body: "Term has resumed.", published: true,
      });
      await db.insert(campaigns).values({
        tenantId: resolvedTenant.id, name: "Fee reminder blast", templateId: template.id,
        audience: "parents", status: "draft",
      });
    }
  }

  console.log("✅ Seed complete!");
  console.log("   Platform: platform@schoolos.local / Platform123!");
  console.log("   Parent portal (school-a): parent@school-a.com / Parent123!");
  console.log("   Student portal (school-a): student@school-a.com / Student123!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
