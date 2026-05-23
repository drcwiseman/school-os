import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { roles, staff, userRoles, users } from "../db/schema";
import { userAuthColumns } from "../lib/user-columns";
import { hashPassword } from "../middleware/auth";

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

async function findRoleByName(tenantId: string, roleName: string) {
  const want = roleName.trim().toLowerCase();
  const rows = await db.select().from(roles).where(eq(roles.tenantId, tenantId));
  return rows.find((r) => r.name.toLowerCase() === want) ?? null;
}

/** Create (or reuse) an ERP user for an HR staff row and link staff.user_id. */
export async function provisionErpLoginForStaff(
  tenantId: string,
  staffId: string,
  opts?: { roleName?: string; password?: string },
) {
  const [member] = await db.select().from(staff).where(and(
    eq(staff.id, staffId),
    eq(staff.tenantId, tenantId),
    isNull(staff.deletedAt),
  )).limit(1);
  if (!member) throw new Error("Staff member not found");

  if (member.userId) {
    const [linked] = await db.select(userAuthColumns).from(users).where(and(
      eq(users.id, member.userId),
      eq(users.tenantId, tenantId),
      isNull(users.deletedAt),
    )).limit(1);
    if (linked && linked.status === "active") {
      return { user: linked, temporaryPassword: null as string | null, created: false };
    }
  }

  const email = (member.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Staff must have an email before creating an ERP login");

  const roleName = opts?.roleName?.trim() || inferStaffRoleName(member.department, member.jobTitle);
  const role = await findRoleByName(tenantId, roleName);
  if (!role) throw new Error(`Role "${roleName}" not found — seed school roles or create it in Settings`);

  let [user] = await db.select(userAuthColumns).from(users).where(and(
    eq(users.tenantId, tenantId),
    eq(users.email, email),
  )).limit(1);

  const temporaryPassword = opts?.password ?? generateTemporaryPassword();
  let created = false;

  if (!user) {
    const passwordHash = await hashPassword(temporaryPassword);
    [user] = await db.insert(users).values({
      tenantId,
      email,
      passwordHash,
      firstName: member.firstName,
      lastName: member.lastName,
      status: "active",
    }).returning();
    created = true;
  } else if (user.status !== "active") {
    throw new Error("A user with this email exists but is not active");
  }

  await db.insert(userRoles).values({
    userId: user.id,
    roleId: role.id,
    tenantId,
  }).onConflictDoNothing();

  await db.update(staff).set({ userId: user.id, email }).where(eq(staff.id, member.id));

  return { user, temporaryPassword: created ? temporaryPassword : null, created };
}

function inferStaffRoleName(department?: string | null, jobTitle?: string | null): string {
  const blob = `${department ?? ""} ${jobTitle ?? ""}`.toLowerCase();
  if (/head\s*teacher|headteacher|principal/.test(blob)) return "Headteacher";
  if (/deputy/.test(blob)) return "Deputy Admin";
  if (/bursar|finance/.test(blob)) return "Bursar";
  if (/secretary|reception/.test(blob)) return "Receptionist";
  if (/hr|human resource/.test(blob)) return "HR Manager";
  return "Teacher";
}
