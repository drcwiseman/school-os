import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "../db";
import { users, sessions } from "../db/schema";
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

export async function createSession(userId: string, tenantId: string, ip?: string, ua?: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  const [session] = await db.insert(sessions).values({
    userId,
    tenantId,
    token,
    ipAddress: ip,
    userAgent: ua,
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
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.status, "active")))
    .limit(1);
  if (!user) return null;

  return { session, user };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

// ─── Express middleware ───────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
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
