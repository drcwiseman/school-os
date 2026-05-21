import { Request, Response, NextFunction } from "express";

/** Respond with empty list/object instead of 500 when DB schema lags (42703). */
export function safeList<T>(label: string, fallback: T, handler: (req: Request) => Promise<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await handler(req);
      res.json({ success: true, data });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = (err as Error).message ?? "";
      if (code === "42703" || code === "42P01" || msg.includes("does not exist")) {
        console.warn(`[safeList:${label}]`, msg.slice(0, 160));
        return res.json({ success: true, data: fallback });
      }
      next(err);
    }
  };
}
