import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { parentAccounts, studentAccounts } from "../db/schema";
import { verifyPassword } from "../middleware/auth";
import { createParentSession, createStudentSession } from "../middleware/portal-auth";
import { isFeatureAllowedForTenant } from "./plan-features";
import { ForbiddenError, UnauthorizedError } from "../middleware/error";
import { portalLoginPath } from "../lib/app-origin";
import { parentEmail, studentPortalEmail } from "./tenant-demo-seed";

export function normalizePortalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Detect demo emails meant for another school slug (parent.x@other.demo). */
export function detectWrongSchoolDemoEmail(email: string, expectedSlug: string): string | null {
  const m = normalizePortalEmail(email).match(/@([a-z0-9-]+)\.demo$/);
  if (!m) return null;
  if (m[1] === expectedSlug) return null;
  return m[1];
}

export async function getPortalLoginHints(tenantId: string, slug: string) {
  const enabled = await isFeatureAllowedForTenant(tenantId, "portal_enabled");
  const portalUrl = await portalLoginPath(slug);

  const demoSuffix = `@${slug}.demo`;
  const hints: { type: string; email: string; password: string | null }[] = [];
  const seen = new Set<string>();

  async function addHint(type: "parent" | "student", email: string) {
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    const [row] = type === "parent"
      ? await db.select({ email: parentAccounts.email }).from(parentAccounts).where(and(
        eq(parentAccounts.tenantId, tenantId),
        sql`lower(${parentAccounts.email}) = ${key}`,
      )).limit(1)
      : await db.select({ email: studentAccounts.email }).from(studentAccounts).where(and(
        eq(studentAccounts.tenantId, tenantId),
        sql`lower(${studentAccounts.email}) = ${key}`,
      )).limit(1);
    if (!row) return;
    seen.add(key);
    hints.push({
      type,
      email: row.email,
      password: row.email.endsWith(demoSuffix) ? (type === "parent" ? "Parent123!" : "Student123!") : null,
    });
  }

  for (const admission of ["S1-01", "S6-05", "S1-02"]) {
    await addHint("student", studentPortalEmail(slug, admission));
    await addHint("parent", parentEmail(slug, admission));
  }

  if (!hints.some((h) => h.type === "student")) {
    const studentRows = await db.select({ email: studentAccounts.email })
      .from(studentAccounts)
      .where(eq(studentAccounts.tenantId, tenantId))
      .limit(3);
    for (const r of studentRows) await addHint("student", r.email);
  }
  if (!hints.some((h) => h.type === "parent")) {
    const parentRows = await db.select({ email: parentAccounts.email })
      .from(parentAccounts)
      .where(eq(parentAccounts.tenantId, tenantId))
      .limit(3);
    for (const r of parentRows) await addHint("parent", r.email);
  }

  if (!hints.length && slug === "school-a") {
    hints.push({ type: "parent", email: "parent@school-a.com", password: "Parent123!" });
    hints.push({ type: "student", email: "student@school-a.com", password: "Student123!" });
  }

  return {
    slug,
    portalUrl,
    portalEnabled: enabled,
    hints,
    note: "Use an account created for this school only. Emails ending in @other-school.demo will not work here.",
  };
}

export async function authenticatePortalLogin(
  tenant: { id: string; slug: string },
  rawEmail: string,
  password: string,
) {
  const portalAllowed = await isFeatureAllowedForTenant(tenant.id, "portal_enabled");
  if (!portalAllowed) {
    throw new ForbiddenError("Parent/student portal is not enabled for this school. Ask the school to enable it in settings or upgrade the plan.");
  }

  const email = normalizePortalEmail(rawEmail);
  const wrongSlug = detectWrongSchoolDemoEmail(email, tenant.slug);
  if (wrongSlug) {
    const otherUrl = await portalLoginPath(wrongSlug);
    throw new UnauthorizedError(
      `This account is for "${wrongSlug}", not "${tenant.slug}". Open ${otherUrl} or use a ${tenant.slug} portal email.`,
    );
  }

  const [parent] = await db
    .select()
    .from(parentAccounts)
    .where(
      and(
        eq(parentAccounts.tenantId, tenant.id),
        sql`lower(${parentAccounts.email}) = ${email}`,
      ),
    )
    .limit(1);

  if (parent) {
    if (parent.status !== "active") throw new UnauthorizedError("Account is not active");
    const valid = await verifyPassword(password, parent.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid password for this email");
    const session = await createParentSession(parent.id, tenant.id);
    return { session, account: { id: parent.id, email: parent.email, type: "parent" as const } };
  }

  const [student] = await db
    .select()
    .from(studentAccounts)
    .where(
      and(
        eq(studentAccounts.tenantId, tenant.id),
        sql`lower(${studentAccounts.email}) = ${email}`,
      ),
    )
    .limit(1);

  if (student) {
    if (student.status !== "active") throw new UnauthorizedError("Account is not active");
    const valid = await verifyPassword(password, student.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid password for this email");
    const session = await createStudentSession(student.id, tenant.id);
    return { session, account: { id: student.id, email: student.email, type: "student" as const } };
  }

  const hasDemoOther = email.includes(".demo");
  if (hasDemoOther) {
    const isStudentDemo = email.startsWith("student.");
    throw new UnauthorizedError(
      isStudentDemo
        ? `No student portal login for "${email}" at ${tenant.slug}. Ask staff to run Settings → Demo data (or "Sync portal logins"), or create a login on the student profile. Demo password is usually Student123! once the account exists.`
        : `No portal account for "${email}" at ${tenant.slug}. Check Administration → Portal for valid emails, or use the correct school URL.`,
    );
  }
  throw new UnauthorizedError("Invalid email or password");
}
