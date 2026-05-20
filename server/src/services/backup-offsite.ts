import fs from "fs/promises";
import path from "path";
import type { BackupPolicy } from "./platform-backup";

export type OffsiteConfig = {
  enabled: boolean;
  bucket: string;
  region: string;
  prefix: string;
  endpoint?: string;
};

export function resolveOffsiteConfig(policy: BackupPolicy): OffsiteConfig | null {
  if (!policy.offsiteEnabled || !policy.s3Bucket?.trim()) return null;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY_ID ?? policy.s3AccessKeyId;
  const secretKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY ?? policy.s3SecretAccessKey;
  if (!accessKey || !secretKey) return null;
  return {
    enabled: true,
    bucket: policy.s3Bucket.trim(),
    region: (policy.s3Region || process.env.BACKUP_S3_REGION || "us-east-1").trim(),
    prefix: (policy.s3Prefix || "schoolos-backups").replace(/^\/+|\/+$/g, ""),
    endpoint: process.env.BACKUP_S3_ENDPOINT?.trim() || policy.s3Endpoint?.trim() || undefined,
  };
}

export async function uploadBackupToOffsite(
  localPath: string,
  backupId: string,
  policy: BackupPolicy,
): Promise<{ key: string; status: "uploaded" | "skipped" | "failed"; error?: string }> {
  const cfg = resolveOffsiteConfig(policy);
  if (!cfg) {
    return { key: "", status: "skipped", error: "Off-site copy disabled or S3 credentials missing" };
  }

  const fileName = path.basename(localPath);
  const key = `${cfg.prefix}/${backupId.slice(0, 8)}/${fileName}`;

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const body = await fs.readFile(localPath);
    const client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: Boolean(cfg.endpoint),
      credentials: {
        accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID ?? policy.s3AccessKeyId!,
        secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY ?? policy.s3SecretAccessKey!,
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: "application/gzip",
      }),
    );
    return { key, status: "uploaded" };
  } catch (err) {
    return { key, status: "failed", error: (err as Error).message };
  }
}
