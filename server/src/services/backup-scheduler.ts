import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { platformBackups } from "../db/schema";
import { getBackupPolicy, createBackupSnapshot } from "./platform-backup";
import { sendPlatformEmailWithTemplate } from "./platform-email-settings";

export async function tickBackupScheduler() {
  const policy = await getBackupPolicy();
  if (!policy.scheduleEnabled) return;

  const now = new Date();
  if (now.getUTCHours() !== policy.scheduleHourUtc) return;

  const dayKey = now.toISOString().slice(0, 10);
  const hourMarker = `${dayKey}-${policy.scheduleHourUtc}`;
  if ((global as { __backupSchedulerMarker?: string }).__backupSchedulerMarker === hourMarker) return;
  (global as { __backupSchedulerMarker?: string }).__backupSchedulerMarker = hourMarker;

  const [recent] = await db
    .select()
    .from(platformBackups)
    .where(eq(platformBackups.trigger, "scheduled"))
    .orderBy(desc(platformBackups.createdAt))
    .limit(1);

  if (recent?.createdAt) {
    const age = Date.now() - recent.createdAt.getTime();
    const minInterval =
      policy.scheduleFrequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 20 * 60 * 60 * 1000;
    if (age < minInterval) return;
  }

  try {
    await createBackupSnapshot({
      label: `Scheduled backup ${dayKey}`,
      trigger: "scheduled",
      includeDatabase: policy.includeDatabase,
      includeUploads: policy.includeUploads,
    });

    if (policy.notifyEmail?.trim()) {
      try {
        const marketing = await import("./platform-settings").then((m) => m.getPlatformMarketing());
        const site = await marketing;
        await sendPlatformEmailWithTemplate({
          to: policy.notifyEmail.trim(),
          templateCode: "smtp_test",
          vars: {
            siteName: site.siteName,
            sentAt: `Scheduled backup started at ${now.toISOString()}`,
          },
        });
      } catch {
        /* notify optional */
      }
    }
  } catch (err) {
    console.error("[backup-scheduler]", (err as Error).message);
  }
}
