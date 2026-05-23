import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "../db";
import { users, sessions } from "../db/schema";
import { userAuthColumns } from "../lib/user-columns";
import { eq, and, gt } from "drizzle-orm";
import { UnauthorizedError } from "../middleware/error";
import { Request, Response, NextFunction } from "express";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export async function createSession(
  userId: string,
  tenantId: string,
  ip?: string,
  ua?: string,
  metadata?: Record<string, unknown>,
) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  const [session] = await db.insert(sessions).values({
    userId,
    tenantId,
    token,
    ipAddress: ip,
    userAgent: ua,
    metadata: metadata ?? {},
    expiresAt,
  }).returning();
  return session;
}

export async function validateSession(token: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;

  const [user] = await db
    .select(userAuthColumns)
    .from(users)
    .where(and(
      eq(users.id, session.userId),
      eq(users.status, "active"),
    ))
    .limit(1);
  if (user?.deletedAt) return null;
  if (!user) return null;

  return { session, user };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export function isPlatformImpersonation(session: { metadata?: Record<string, unknown> | null }): boolean {
  const m = (session.metadata ?? {}) as Record<string, unknown>;
  return Boolean(m.impersonation);
}

export function isReadOnlyImpersonation(session: { metadata?: Record<string, unknown> | null }): boolean {
  const m = (session.metadata ?? {}) as Record<string, unknown>;
  return Boolean(m.impersonation && m.readOnly);
}

/** Block mutating HTTP methods during read-only platform impersonation. */
export function blockWriteIfImpersonationReadOnly(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (!session) return next();
  if (!isReadOnlyImpersonation(session)) return next();
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  return next(new UnauthorizedError("Read-only impersonation — changes are not allowed"));
}

// ─── Express middleware ───────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.cookies?.portal_session_token && !req.cookies?.session_token) {
      throw new UnauthorizedError("Staff login required — parents/students use the portal login");
    }
    if (req.cookies?.platform_session_token && !req.cookies?.session_token) {
      throw new UnauthorizedError("Staff login required — platform admins cannot use school staff APIs");
    }
    const token = req.cookies?.session_token as string | undefined;
    if (!token) throw new UnauthorizedError("No session token provided");

    const result = await validateSession(token);
    if (!result) throw new UnauthorizedError("Session expired or invalid");

    (req as any).user    = result.user;
    (req as any).session = result.session;
    next();
  } catch (err) {
    next(err);
  }
}
