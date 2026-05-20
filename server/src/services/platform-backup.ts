import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { platformBackups, platformSettings } from "../db/schema";

const execFileAsync = promisify(execFile);
const SETTINGS_KEY = "backup";
const BACKUP_ROOT = path.resolve(process.cwd(), "uploads", "backups");

export type BackupPolicy = {
  scheduleEnabled: boolean;
  scheduleFrequency: "daily" | "weekly";
  scheduleHourUtc: number;
  retentionDays: number;
  includeDatabase: boolean;
  includeUploads: boolean;
  notifyEmail: string;
};

const DEFAULT_POLICY: BackupPolicy = {
  scheduleEnabled: false,
  scheduleFrequency: "daily",
  scheduleHourUtc: 2,
  retentionDays: 14,
  includeDatabase: true,
  includeUploads: true,
  notifyEmail: "",
};

export type BackupSnapshotRow = {
  id: string;
  label: string;
  trigger: string;
  status: string;
  includesDatabase: boolean;
  includesUploads: boolean;
  fileName: string | null;
  sizeBytes: number;
  sizeHuman: string;
  error: string | null;
  createdBy: string | null;
  completedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
};

export type PlatformBackupHub = {
  policy: BackupPolicy;
  summary: {
    totalSnapshots: number;
    completed: number;
    failed: number;
    running: number;
    lastSuccessAt: string | null;
    totalStorageBytes: number;
    totalStorageHuman: string;
    pgDumpAvailable: boolean;
  };
  snapshots: BackupSnapshotRow[];
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function pgDumpAvailable(): Promise<boolean> {
  try {
    await execFileAsync("which", ["pg_dump"]);
    return Boolean(process.env.DATABASE_URL);
  } catch {
    return false;
  }
}

export async function getBackupPolicy(): Promise<BackupPolicy> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTINGS_KEY)).limit(1);
  const v = (row?.value ?? {}) as Partial<BackupPolicy>;
  return { ...DEFAULT_POLICY, ...v };
}

export async function setBackupPolicy(patch: Partial<BackupPolicy>): Promise<BackupPolicy> {
  const current = await getBackupPolicy();
  const next = { ...current, ...patch };
  await db
    .insert(platformSettings)
    .values({ key: SETTINGS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}

function rowToSnapshot(r: typeof platformBackups.$inferSelect): BackupSnapshotRow {
  return {
    id: r.id,
    label: r.label,
    trigger: r.trigger,
    status: r.status,
    includesDatabase: r.includesDatabase,
    includesUploads: r.includesUploads,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
    sizeHuman: formatBytes(r.sizeBytes),
    error: r.error,
    createdBy: r.createdBy,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    downloadUrl: r.status === "completed" && r.fileName ? `/api/platform/settings/backup/snapshots/${r.id}/download` : null,
  };
}

export async function getPlatformBackupHub(): Promise<PlatformBackupHub> {
  const policy = await getBackupPolicy();
  const rows = await db.select().from(platformBackups).orderBy(desc(platformBackups.createdAt)).limit(50);
  const snapshots = rows.map(rowToSnapshot);

  const completed = snapshots.filter((s) => s.status === "completed");
  const totalStorageBytes = completed.reduce((sum, s) => sum + s.sizeBytes, 0);
  const lastSuccess = completed[0]?.completedAt ?? null;

  return {
    policy,
    summary: {
      totalSnapshots: snapshots.length,
      completed: completed.length,
      failed: snapshots.filter((s) => s.status === "failed").length,
      running: snapshots.filter((s) => s.status === "running" || s.status === "pending").length,
      lastSuccessAt: lastSuccess,
      totalStorageBytes,
      totalStorageHuman: formatBytes(totalStorageBytes),
      pgDumpAvailable: await pgDumpAvailable(),
    },
    snapshots,
  };
}

async function ensureBackupDir(backupId: string) {
  const dir = path.join(BACKUP_ROOT, backupId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function runPlatformBackupJob(backupId: string) {
  const [row] = await db.select().from(platformBackups).where(eq(platformBackups.id, backupId)).limit(1);
  if (!row) throw new Error("Backup record not found");

  await db.update(platformBackups).set({ status: "running", error: null }).where(eq(platformBackups.id, backupId));

  const dir = await ensureBackupDir(backupId);
  const dbUrl = process.env.DATABASE_URL;
  const manifest: Record<string, unknown> = {
    backupId,
    createdAt: new Date().toISOString(),
    includesDatabase: row.includesDatabase,
    includesUploads: row.includesUploads,
  };

  try {
    if (row.includesDatabase) {
      if (!dbUrl) throw new Error("DATABASE_URL is not configured");
      const sqlGz = path.join(dir, "database.sql.gz");
      await execFileAsync("bash", [
        "-c",
        `pg_dump "$DATABASE_URL" --no-owner --no-acl 2>/dev/null | gzip -c > "${sqlGz}"`,
      ], { env: { ...process.env, DATABASE_URL: dbUrl } });
      manifest.databaseFile = "database.sql.gz";
    }

    if (row.includesUploads) {
      const uploadsRoot = path.resolve(process.cwd(), "uploads");
      const uploadsTar = path.join(dir, "uploads.tar.gz");
      await execFileAsync("tar", [
        "-czf",
        uploadsTar,
        "--exclude=backups",
        "-C",
        uploadsRoot,
        ".",
      ]);
      manifest.uploadsFile = "uploads.tar.gz";
    }

    await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

    const archiveName = `schoolos-backup-${backupId.slice(0, 8)}-${Date.now()}.tar.gz`;
    const archivePath = path.join(BACKUP_ROOT, archiveName);
    await execFileAsync("tar", ["-czf", archivePath, "-C", dir, "."]);

    const stat = await fs.stat(archivePath);
    await fs.rm(dir, { recursive: true, force: true });

    await db
      .update(platformBackups)
      .set({
        status: "completed",
        fileName: archiveName,
        storedPath: archivePath,
        sizeBytes: stat.size,
        completedAt: new Date(),
        error: null,
      })
      .where(eq(platformBackups.id, backupId));

    await pruneOldBackups(await getBackupPolicy());
  } catch (err) {
    await db
      .update(platformBackups)
      .set({
        status: "failed",
        error: (err as Error).message,
        completedAt: new Date(),
      })
      .where(eq(platformBackups.id, backupId));
    throw err;
  }
}

async function pruneOldBackups(policy: BackupPolicy) {
  const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
  const old = await db
    .select()
    .from(platformBackups)
    .where(lt(platformBackups.createdAt, cutoff));

  for (const row of old) {
    await deleteBackupSnapshot(row.id);
  }
}

export async function createBackupSnapshot(opts: {
  createdBy?: string;
  label?: string;
  includeDatabase?: boolean;
  includeUploads?: boolean;
  trigger?: string;
}) {
  const policy = await getBackupPolicy();
  const available = await pgDumpAvailable();
  if (opts.includeDatabase !== false && !available) {
    throw new Error("pg_dump and DATABASE_URL are required for database backups on this server");
  }

  const label =
    opts.label ??
    `Backup ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

  const [row] = await db
    .insert(platformBackups)
    .values({
      label,
      trigger: opts.trigger ?? "manual",
      status: "pending",
      includesDatabase: opts.includeDatabase ?? policy.includeDatabase,
      includesUploads: opts.includeUploads ?? policy.includeUploads,
      createdBy: opts.createdBy,
    })
    .returning();

  const { enqueueJob } = await import("./queue");
  await enqueueJob(null, "platform.backup", { backupId: row.id });
  return rowToSnapshot(row);
}

export async function deleteBackupSnapshot(id: string) {
  const [row] = await db.select().from(platformBackups).where(eq(platformBackups.id, id)).limit(1);
  if (!row) throw new Error("Backup not found");

  if (row.storedPath) {
    try {
      await fs.unlink(row.storedPath);
    } catch {
      /* file may already be gone */
    }
  }
  const dir = path.join(BACKUP_ROOT, id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  await db.delete(platformBackups).where(eq(platformBackups.id, id));
  return { success: true };
}

export async function resolveBackupFilePath(id: string): Promise<{ path: string; fileName: string }> {
  const [row] = await db.select().from(platformBackups).where(eq(platformBackups.id, id)).limit(1);
  if (!row || row.status !== "completed" || !row.storedPath || !row.fileName) {
    throw new Error("Backup file not available");
  }
  const resolved = path.resolve(row.storedPath);
  if (!resolved.startsWith(BACKUP_ROOT)) throw new Error("Invalid backup path");
  await fs.access(resolved);
  return { path: resolved, fileName: row.fileName };
}

export async function restoreBackupSnapshot(id: string, confirmPhrase: string) {
  if (confirmPhrase !== "RESTORE") {
    throw new Error('Type RESTORE in the confirmation field to proceed');
  }

  const [row] = await db.select().from(platformBackups).where(eq(platformBackups.id, id)).limit(1);
  if (!row || row.status !== "completed" || !row.storedPath) {
    throw new Error("Only completed backups can be restored");
  }

  const dbUrl = process.env.DATABASE_URL;
  if (row.includesDatabase && !dbUrl) {
    throw new Error("DATABASE_URL is required for database restore");
  }

  const workDir = path.join(BACKUP_ROOT, `restore-${id}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    await execFileAsync("tar", ["-xzf", row.storedPath, "-C", workDir]);

    if (row.includesDatabase) {
      const sqlGz = path.join(workDir, "database.sql.gz");
      await execFileAsync("bash", [
        "-c",
        `gunzip -c "${sqlGz}" | psql "$DATABASE_URL"`,
      ], { env: { ...process.env, DATABASE_URL: dbUrl } });
    }

    if (row.includesUploads) {
      const uploadsTar = path.join(workDir, "uploads.tar.gz");
      const uploadsRoot = path.resolve(process.cwd(), "uploads");
      await execFileAsync("tar", ["-xzf", uploadsTar, "-C", uploadsRoot]);
    }

    return {
      success: true,
      message: "Restore completed. Restart the application and verify tenant data.",
    };
  } catch (err) {
    throw new Error(`Restore failed: ${(err as Error).message}`);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function getBackupStorageStats() {
  try {
    await fs.mkdir(BACKUP_ROOT, { recursive: true });
    const [total] = await db
      .select({ bytes: sql<number>`coalesce(sum(${platformBackups.sizeBytes}), 0)::int` })
      .from(platformBackups)
      .where(eq(platformBackups.status, "completed"));
    return { backupRoot: BACKUP_ROOT, totalBytes: Number(total?.bytes ?? 0) };
  } catch {
    return { backupRoot: BACKUP_ROOT, totalBytes: 0 };
  }
}
