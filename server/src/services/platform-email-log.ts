import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { platformEmailLogs } from "../db/schema";

export type PlatformEmailLogRow = {
  id: string;
  templateCode: string | null;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export async function logPlatformEmailSend(input: {
  templateCode?: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
}) {
  await db.insert(platformEmailLogs).values({
    templateCode: input.templateCode ?? null,
    recipient: input.recipient,
    subject: input.subject,
    status: input.status,
    error: input.error ?? null,
  });
}

export async function emailLogStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [sent24] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformEmailLogs)
    .where(and(eq(platformEmailLogs.status, "sent"), gte(platformEmailLogs.createdAt, since)));
  const [failed24] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformEmailLogs)
    .where(and(eq(platformEmailLogs.status, "failed"), gte(platformEmailLogs.createdAt, since)));
  const [totalSent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformEmailLogs)
    .where(eq(platformEmailLogs.status, "sent"));
  const [totalFailed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformEmailLogs)
    .where(eq(platformEmailLogs.status, "failed"));
  return {
    sent24h: Number(sent24?.count ?? 0),
    failed24h: Number(failed24?.count ?? 0),
    totalSent: Number(totalSent?.count ?? 0),
    totalFailed: Number(totalFailed?.count ?? 0),
  };
}

export async function listPlatformEmailLogs(opts?: { limit?: number; status?: string }): Promise<PlatformEmailLogRow[]> {
  const limit = Math.min(opts?.limit ?? 100, 500);
  const conditions = opts?.status && opts.status !== "all" ? [eq(platformEmailLogs.status, opts.status)] : [];
  const rows = await db
    .select()
    .from(platformEmailLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(platformEmailLogs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    templateCode: r.templateCode,
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  }));
}
