import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db";
import { platformAdmins, platformSessions } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { UnauthorizedError } from "./error";
import { hashPassword, verifyPassword } from "./auth";

export async function createPlatformSession(adminId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const [session] = await db.insert(platformSessions).values({ adminId, token, expiresAt }).returning();
  return session;
}

export async function validatePlatformSession(token: string) {
  const [session] = await db.select().from(platformSessions).where(and(eq(platformSessions.token, token), gt(platformSessions.expiresAt, new Date()))).limit(1);
  if (!session) return null;
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, session.adminId)).limit(1);
  if (!admin) return null;
  return { session, admin };
}

export async function requirePlatformAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.cookies?.session_token && !req.cookies?.platform_session_token) {
      throw new UnauthorizedError("Platform login required — use /platform/login");
    }
    const token = req.cookies?.platform_session_token as string | undefined;
    if (!token) throw new UnauthorizedError("Platform login required");
    const result = await validatePlatformSession(token);
    if (!result) throw new UnauthorizedError("Platform session expired");
    (req as any).platformAdmin = result.admin;
    next();
  } catch (err) {
    next(err);
  }
}

export { hashPassword, verifyPassword };
