import { Request, Response, NextFunction } from "express";

const hits = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const MAX_PORTAL_REQUESTS = 400;

function shouldSkipRateLimit(req: Request): boolean {
  if (req.method === "GET") {
    const p = req.path;
    if (p.includes("/profile/photo")) return true;
    if (p.includes("/student/materials/") && p.endsWith("/file")) return true;
  }
  return false;
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  if (shouldSkipRateLimit(req)) return next();

  const isPortal = req.path.includes("/api/portal");
  const max = isPortal ? MAX_PORTAL_REQUESTS : MAX_REQUESTS;
  const key = isPortal
    ? `${req.ip}:portal:${req.method}:${req.path}`
    : `${req.ip}:${req.path.split("/").slice(0, 4).join("/")}`;

  const now = Date.now();
  let entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(key, entry);
  }
  entry.count++;
  res.setHeader("X-RateLimit-Limit", String(max));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
  if (entry.count > max) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }
  next();
}
