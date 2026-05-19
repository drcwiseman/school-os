import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db";
import { portalAccounts, portalSessions } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { UnauthorizedError } from "./error";
import { hashPassword, verifyPassword } from "./auth";

export async function createPortalSession(accountId: string, tenantId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const [session] = await db.insert(portalSessions).values({ portalAccountId: accountId, tenantId, token, expiresAt }).returning();
  return session;
}

export async function validatePortalSession(token: string) {
  const [session] = await db.select().from(portalSessions).where(and(eq(portalSessions.token, token), gt(portalSessions.expiresAt, new Date()))).limit(1);
  if (!session) return null;
  const [account] = await db.select().from(portalAccounts).where(and(eq(portalAccounts.id, session.portalAccountId), eq(portalAccounts.status, "active"))).limit(1);
  if (!account) return null;
  return { session, account };
}

export async function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.cookies?.session_token && !req.cookies?.portal_session_token) {
      throw new UnauthorizedError("Portal login required — staff cannot use parent/student portal APIs");
    }
    const token = req.cookies?.portal_session_token as string | undefined;
    if (!token) throw new UnauthorizedError("Portal login required");
    const result = await validatePortalSession(token);
    if (!result) throw new UnauthorizedError("Portal session expired");
    const tenant = (req as any).tenant;
    if (tenant && result.account.tenantId !== tenant.id) {
      throw new UnauthorizedError("Portal account does not belong to this school");
    }
    (req as any).portalAccount = result.account;
    (req as any).portalSession = result.session;
    next();
  } catch (err) {
    next(err);
  }
}

export { hashPassword, verifyPassword };
