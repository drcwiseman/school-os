import { db } from "../db";
import { jobs, platformBackups, platformSupportTickets } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";

export type PlatformAlert = {
  id: string;
  type: "job_failed" | "backup_failed" | "support_open" | "backup_success";
  severity: "error" | "warn" | "info";
  title: string;
  message: string;
  href: string;
  createdAt: string;
};

export type PlatformNotificationsHub = {
  unreadCount: number;
  alerts: PlatformAlert[];
};

export async function getPlatformNotificationsHub(): Promise<PlatformNotificationsHub> {
  const alerts: PlatformAlert[] = [];

  const failedJobs = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      error: jobs.error,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.status, "failed"))
    .orderBy(desc(jobs.createdAt))
    .limit(8);

  for (const j of failedJobs) {
    alerts.push({
      id: j.id,
      type: "job_failed",
      severity: "error",
      title: `Failed job: ${j.type}`,
      message: j.error?.slice(0, 120) ?? "Unknown error",
      href: "/platform/system/queue",
      createdAt: j.createdAt.toISOString(),
    });
  }

  const failedBackups = await db
    .select()
    .from(platformBackups)
    .where(eq(platformBackups.status, "failed"))
    .orderBy(desc(platformBackups.createdAt))
    .limit(5);

  for (const b of failedBackups) {
    alerts.push({
      id: b.id,
      type: "backup_failed",
      severity: "error",
      title: "Backup failed",
      message: b.error?.slice(0, 120) ?? b.label,
      href: "/platform/settings/backup",
      createdAt: b.createdAt.toISOString(),
    });
  }

  const openTickets = await db
    .select({
      id: platformSupportTickets.id,
      subject: platformSupportTickets.subject,
      priority: platformSupportTickets.priority,
      createdAt: platformSupportTickets.createdAt,
    })
    .from(platformSupportTickets)
    .where(sql`${platformSupportTickets.status} IN ('open', 'in_progress')`)
    .orderBy(desc(platformSupportTickets.updatedAt))
    .limit(8);

  for (const t of openTickets) {
    alerts.push({
      id: t.id,
      type: "support_open",
      severity: t.priority === "urgent" ? "error" : "warn",
      title: t.subject,
      message: `Priority: ${t.priority}`,
      href: "/platform/support",
      createdAt: t.createdAt.toISOString(),
    });
  }

  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    unreadCount: alerts.filter((a) => a.severity !== "info").length,
    alerts: alerts.slice(0, 20),
  };
}
