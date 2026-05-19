import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db";
import {
  parentAccounts, studentAccounts, parentSessions, studentSessions,
} from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { UnauthorizedError } from "./error";
import { hashPassword, verifyPassword } from "./auth";

export type PortalPrincipal =
  | { kind: "parent"; account: typeof parentAccounts.$inferSelect; session: typeof parentSessions.$inferSelect }
  | { kind: "student"; account: typeof studentAccounts.$inferSelect; session: typeof studentSessions.$inferSelect };

const ACTIVE_STATUSES = ["active"] as const;

export async function createParentSession(parentAccountId: string, tenantId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const [session] = await db.insert(parentSessions).values({
    parentAccountId, tenantId, token, expiresAt,
  }).returning();
  return session;
}

export async function createStudentSession(studentAccountId: string, tenantId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const [session] = await db.insert(studentSessions).values({
    studentAccountId, tenantId, token, expiresAt,
  }).returning();
  return session;
}

export async function validatePortalSession(token: string): Promise<PortalPrincipal | null> {
  const [parentSession] = await db
    .select()
    .from(parentSessions)
    .where(and(eq(parentSessions.token, token), gt(parentSessions.expiresAt, new Date())))
    .limit(1);

  if (parentSession) {
    const [account] = await db
      .select()
      .from(parentAccounts)
      .where(and(
        eq(parentAccounts.id, parentSession.parentAccountId),
        eq(parentAccounts.status, "active"),
      ))
      .limit(1);
    if (account) return { kind: "parent", account, session: parentSession };
  }

  const [studentSession] = await db
    .select()
    .from(studentSessions)
    .where(and(eq(studentSessions.token, token), gt(studentSessions.expiresAt, new Date())))
    .limit(1);

  if (studentSession) {
    const [account] = await db
      .select()
      .from(studentAccounts)
      .where(and(
        eq(studentAccounts.id, studentSession.studentAccountId),
        eq(studentAccounts.status, "active"),
      ))
      .limit(1);
    if (account) return { kind: "student", account, session: studentSession };
  }

  return null;
}

export async function deletePortalSession(token: string) {
  await db.delete(parentSessions).where(eq(parentSessions.token, token));
  await db.delete(studentSessions).where(eq(studentSessions.token, token));
}

export async function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.cookies?.session_token && !req.cookies?.portal_session_token) {
      throw new UnauthorizedError("Portal login required — staff cannot use parent/student portal APIs");
    }
    const token = req.cookies?.portal_session_token as string | undefined;
    if (!token) throw new UnauthorizedError("Portal login required");

    const principal = await validatePortalSession(token);
    if (!principal) throw new UnauthorizedError("Portal session expired");

    const tenant = (req as any).tenant;
    const accountTenantId = principal.account.tenantId;
    if (tenant && accountTenantId !== tenant.id) {
      throw new UnauthorizedError("Portal account does not belong to this school");
    }

    (req as any).portalPrincipal = principal;
    (req as any).portalAccount = principal.account;
    (req as any).portalKind = principal.kind;
    next();
  } catch (err) {
    next(err);
  }
}

export { hashPassword, verifyPassword };
