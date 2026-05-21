import { db } from "../db";
import { jobs } from "../db/schema";
import { eq } from "drizzle-orm";
import { processCampaignJob } from "./campaign-worker";
import { runPlatformBackupJob } from "./platform-backup";
import { runPlatformEmailCampaignJob } from "./platform-email-campaigns";
import { NotFoundError, BadRequestError } from "../middleware/error";

let processing = false;

export async function enqueueJob(tenantId: string | null, type: string, payload: Record<string, unknown>) {
  const [job] = await db.insert(jobs).values({ tenantId: tenantId ?? undefined, type, payload, status: "pending" }).returning();
  tick();
  return job;
}

export async function tick() {
  if (processing) return;
  processing = true;
  try {
    const pending = await db.select().from(jobs).where(eq(jobs.status, "pending")).limit(5);
    for (const job of pending) {
      await db.update(jobs).set({ status: "running", updatedAt: new Date() }).where(eq(jobs.id, job.id));
      try {
        let result: unknown = null;
        if (job.type === "campaign.send") {
          result = await processCampaignJob(job.tenantId!, job.payload as { campaignId: string });
        } else if (job.type === "platform.backup") {
          const payload = job.payload as { backupId?: string };
          if (!payload?.backupId) throw new Error("Missing backupId in job payload");
          await runPlatformBackupJob(payload.backupId);
          result = { backupId: payload.backupId, ok: true };
        } else if (job.type === "platform.email_campaign") {
          const payload = job.payload as { campaignId?: string };
          if (!payload?.campaignId) throw new Error("Missing campaignId");
          result = await runPlatformEmailCampaignJob(payload.campaignId);
        } else if (job.type === "finance.auto_invoices") {
          const { runDueRecurringSchedules } = await import("./invoice-generation");
          result = await runDueRecurringSchedules(job.tenantId!);
        }
        await db.update(jobs).set({ status: "done", result: result as object, updatedAt: new Date() }).where(eq(jobs.id, job.id));
      } catch (err: any) {
        await db.update(jobs).set({ status: "failed", error: err.message, updatedAt: new Date() }).where(eq(jobs.id, job.id));
      }
    }
  } finally {
    processing = false;
  }
}

export async function retryJob(jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new NotFoundError("Job not found");
  if (job.status === "running") {
    throw new BadRequestError("Cannot retry a job that is currently running");
  }
  const [updated] = await db
    .update(jobs)
    .set({ status: "pending", error: null, updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
    .returning();
  tick();
  return updated;
}
