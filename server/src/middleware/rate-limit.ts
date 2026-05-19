import { Request, Response, NextFunction } from "express";

const hits = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip}:${req.path.split("/").slice(0, 4).join("/")}`;
  const now = Date.now();
  let entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(key, entry);
  }
  entry.count++;
  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - entry.count)));
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }
  next();
}
